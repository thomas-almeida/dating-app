-- Stories, métricas de perfil e reencontro no deck. Rode depois da 0001.
--
-- O limite diário e quem pode ver o quê ficam nas funções: as tabelas novas não
-- têm policy nem grant para os clientes, então nada chega sem passar por aqui.

-- Tabelas --------------------------------------------------------------------

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_path text not null,
  media_type text not null check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create index stories_user_idx on public.stories (user_id, created_at desc);
create index stories_recent_idx on public.stories (created_at desc);

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table public.story_likes (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

-- Uma visita por pessoa por dia: recarregar a página não infla o número.
create table public.profile_views (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_on date not null default current_date,
  primary key (profile_id, viewer_id, viewed_on)
);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.story_likes enable row level security;
alter table public.profile_views enable row level security;

revoke all on table
  public.stories,
  public.story_views,
  public.story_likes,
  public.profile_views
from anon, authenticated;

grant all on table
  public.stories,
  public.story_views,
  public.story_likes,
  public.profile_views
to service_role;

-- Deck -----------------------------------------------------------------------

-- Quem já passou volta para a lista, mas depois de quem ainda não foi visto.
create or replace function public.discover_profiles(p_limit integer default 20)
returns table (
  id uuid,
  name text,
  nickname text,
  bio text,
  age integer,
  video_path text,
  photo_paths text[],
  is_pro boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, p.gender
    from public.profiles p
    where p.id = (select auth.uid()) and p.onboarded_at is not null
  )
  select p.id, p.name, p.nickname, p.bio, public.age_of(p.birth_date), p.video_path, p.photo_paths, p.is_pro
  from public.profiles p
  cross join me
  where p.onboarded_at is not null
    and p.id <> me.id
    and p.gender <> me.gender
  order by exists (
    select 1 from public.swipes s
    where s.swiper_id = me.id and s.target_id = p.id
  ), random()
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.record_swipe(p_target uuid, p_action public.swipe_action)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_gender public.gender;
  already_liked boolean;
begin
  select p.gender into my_gender
  from public.profiles p
  where p.id = me and p.onboarded_at is not null;

  if my_gender is null then
    raise exception 'not_onboarded' using errcode = '42501';
  end if;

  if p_target = me or not exists (
    select 1 from public.profiles p
    where p.id = p_target and p.onboarded_at is not null and p.gender <> my_gender
  ) then
    raise exception 'invalid_target' using errcode = '22023';
  end if;

  select s.action = 'like' into already_liked
  from public.swipes s
  where s.swiper_id = me and s.target_id = p_target;

  insert into public.swipes (swiper_id, target_id, action)
  values (me, p_target, p_action)
  on conflict (swiper_id, target_id)
  do update set action = excluded.action, created_at = now();

  -- Curtir de novo quem já estava curtido não é um match novo.
  return p_action = 'like' and not coalesce(already_liked, false) and exists (
    select 1 from public.swipes s
    where s.swiper_id = p_target and s.target_id = me and s.action = 'like'
  );
end;
$$;

-- Stories --------------------------------------------------------------------

-- O retorno mudou, e create or replace não aceita isso.
drop function public.story_profiles(integer);

create function public.story_profiles(p_limit integer default 12)
returns table (
  id uuid,
  nickname text,
  photo_path text,
  has_story boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, p.gender
    from public.profiles p
    where p.id = (select auth.uid()) and p.onboarded_at is not null
  )
  select p.id, p.nickname, p.photo_paths[1], story.has_story
  from public.profiles p
  cross join me
  cross join lateral (
    select exists (
      select 1 from public.stories s
      where s.user_id = p.id and s.created_at > now() - interval '24 hours'
    ) as has_story
  ) story
  where p.onboarded_at is not null
    and p.id <> me.id
    and p.gender <> me.gender
    and (cardinality(p.photo_paths) > 0 or story.has_story)
  order by story.has_story desc, p.onboarded_at desc
  limit least(greatest(p_limit, 1), 30);
$$;

create function public.post_story(p_media_path text, p_media_type text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  member_is_pro boolean;
  new_story uuid;
begin
  select p.is_pro into member_is_pro
  from public.profiles p
  where p.id = me and p.onboarded_at is not null;

  if member_is_pro is null then
    raise exception 'not_onboarded' using errcode = '42501';
  end if;

  if (string_to_array(p_media_path, '/'))[1] is distinct from me::text then
    raise exception 'foreign_media' using errcode = 'check_violation';
  end if;

  -- Sem a trava, dois envios simultâneos passariam juntos pela contagem.
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));

  if not member_is_pro and exists (
    select 1 from public.stories s
    where s.user_id = me and s.created_at > now() - interval '24 hours'
  ) then
    raise exception 'story_limit' using errcode = 'check_violation';
  end if;

  insert into public.stories (user_id, media_path, media_type)
  values (me, p_media_path, p_media_type)
  returning id into new_story;

  return new_story;
end;
$$;

-- Quem é free recebe só os próprios stories: a mídia dos outros nem chega ao cliente.
create function public.story_feed()
returns table (
  id uuid,
  user_id uuid,
  media_path text,
  media_type text,
  created_at timestamptz,
  liked boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, p.gender, p.is_pro
    from public.profiles p
    where p.id = (select auth.uid()) and p.onboarded_at is not null
  )
  select
    s.id,
    s.user_id,
    s.media_path,
    s.media_type,
    s.created_at,
    exists (
      select 1 from public.story_likes l
      where l.story_id = s.id and l.user_id = me.id
    )
  from public.stories s
  join public.profiles author on author.id = s.user_id
  cross join me
  where s.created_at > now() - interval '24 hours'
    and (s.user_id = me.id or (me.is_pro and author.gender <> me.gender))
  order by s.created_at;
$$;

create function public.can_view_story(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stories s
    join public.profiles author on author.id = s.user_id
    join public.profiles me on me.id = (select auth.uid())
    where s.id = p_story
      and s.user_id <> me.id
      and s.created_at > now() - interval '24 hours'
      and me.onboarded_at is not null
      and me.is_pro
      and author.gender <> me.gender
  );
$$;

create function public.view_story(p_story uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.can_view_story(p_story) then
    insert into public.story_views (story_id, viewer_id)
    values (p_story, (select auth.uid()))
    on conflict do nothing;
  end if;
end;
$$;

create function public.toggle_story_like(p_story uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not public.can_view_story(p_story) then
    raise exception 'invalid_story' using errcode = '22023';
  end if;

  -- A lista de quem viu sai de story_views: quem curte precisa aparecer nela.
  perform public.view_story(p_story);

  delete from public.story_likes l
  where l.story_id = p_story and l.user_id = me;

  if found then
    return false;
  end if;

  insert into public.story_likes (story_id, user_id)
  values (p_story, me);

  return true;
end;
$$;

-- Só o dono do story recebe alguma linha.
create function public.story_audience(p_story uuid)
returns table (
  user_id uuid,
  nickname text,
  photo_path text,
  viewed_at timestamptz,
  liked boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.viewer_id,
    p.nickname,
    p.photo_paths[1],
    v.viewed_at,
    exists (
      select 1 from public.story_likes l
      where l.story_id = v.story_id and l.user_id = v.viewer_id
    )
  from public.story_views v
  join public.stories s on s.id = v.story_id
  join public.profiles p on p.id = v.viewer_id
  where v.story_id = p_story and s.user_id = (select auth.uid())
  order by v.viewed_at desc;
$$;

-- Métricas -------------------------------------------------------------------

create function public.record_profile_view(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.profile_views (profile_id, viewer_id)
  select target.id, me.id
  from public.profiles target
  join public.profiles me on me.id = (select auth.uid())
  where target.id = p_id
    and target.id <> me.id
    and target.onboarded_at is not null
    and me.onboarded_at is not null
  on conflict do nothing;
$$;

-- Sem linha para quem não é Pro: o número não sai do banco.
create function public.my_insights()
returns table (
  profile_views bigint,
  likes_received bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.profile_views v where v.profile_id = me.id),
    (select count(*) from public.swipes s where s.target_id = me.id and s.action = 'like')
  from public.profiles me
  where me.id = (select auth.uid()) and me.is_pro;
$$;

create function public.my_likers(p_limit integer default 60)
returns table (
  id uuid,
  name text,
  nickname text,
  age integer,
  photo_paths text[],
  liked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.nickname, public.age_of(p.birth_date), p.photo_paths, s.created_at
  from public.swipes s
  join public.profiles me on me.id = (select auth.uid()) and me.is_pro
  join public.profiles p on p.id = s.swiper_id
  where s.target_id = me.id
    and s.action = 'like'
    and p.onboarded_at is not null
  order by s.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- Grants ---------------------------------------------------------------------

revoke execute on function
  public.story_profiles(integer),
  public.post_story(text, text),
  public.story_feed(),
  public.can_view_story(uuid),
  public.view_story(uuid),
  public.toggle_story_like(uuid),
  public.story_audience(uuid),
  public.record_profile_view(uuid),
  public.my_insights(),
  public.my_likers(integer)
from public, anon;

-- É só uma regra interna das outras funções.
revoke execute on function public.can_view_story(uuid) from authenticated;

grant execute on function
  public.story_profiles(integer),
  public.post_story(text, text),
  public.story_feed(),
  public.view_story(uuid),
  public.toggle_story_like(uuid),
  public.story_audience(uuid),
  public.record_profile_view(uuid),
  public.my_insights(),
  public.my_likers(integer)
to authenticated;

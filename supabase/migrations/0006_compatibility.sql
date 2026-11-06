-- Altura, cor da pele e igreja ajudam a compatibilidade, e as preferências decidem quem aparece.
-- Lista vazia significa "sem filtro". Em sexo, vazio mantém a regra de sempre: o sexo oposto.
alter table public.profiles
  add column height_cm smallint check (height_cm between 120 and 230),
  -- Categorias do IBGE. Não sai em nenhuma RPC: serve só para o filtro de quem escolheu ver.
  add column skin_color text check (skin_color in ('branca', 'preta', 'parda', 'amarela', 'indigena')),
  add column church text check (church ~ '^[a-z-]{1,40}$'),
  add column pref_genders text[] not null default '{}'
    check (pref_genders <@ array['male', 'female']),
  add column pref_churches text[] not null default '{}'
    check (cardinality(pref_churches) <= 30),
  add column pref_skin_colors text[] not null default '{}'
    check (pref_skin_colors <@ array['branca', 'preta', 'parda', 'amarela', 'indigena']);

grant update (height_cm, skin_color, church, pref_genders, pref_churches, pref_skin_colors)
  on public.profiles to authenticated;

-- A pessoa quer ver alguém desse sexo?
create function public.wants_gender(p_own public.gender, p_prefs text[], p_target public.gender)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when cardinality(p_prefs) = 0 then p_target <> p_own
    else p_target::text = any(p_prefs)
  end;
$$;

-- Precisa valer nos dois sentidos: curtir quem nunca veria você não vira match.
create function public.can_pair(p_me uuid, p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles other on other.id = p_other
    where me.id = p_me
      and me.gender is not null
      and other.gender is not null
      and public.wants_gender(me.gender, me.pref_genders, other.gender)
      and public.wants_gender(other.gender, other.pref_genders, me.gender)
  );
$$;

-- Deck -----------------------------------------------------------------------

-- O retorno mudou: precisa recriar, porque create or replace não troca as colunas.
drop function public.discover_profiles(integer);
drop function public.get_public_profile(uuid);

create function public.discover_profiles(p_limit integer default 20)
returns table (
  id uuid,
  name text,
  nickname text,
  bio text,
  age integer,
  video_path text,
  photo_paths text[],
  is_pro boolean,
  state text,
  city text,
  neighborhood text,
  hobbies jsonb,
  height_cm smallint,
  church text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, p.church, p.pref_churches, p.pref_skin_colors
    from public.profiles p
    where p.id = (select auth.uid()) and p.onboarded_at is not null
  )
  select
    p.id, p.name, p.nickname, p.bio, public.age_of(p.birth_date), p.video_path, p.photo_paths, p.is_pro,
    p.state, p.city, p.neighborhood, p.hobbies, p.height_cm, p.church
  from public.profiles p
  cross join me
  where p.onboarded_at is not null
    and p.id <> me.id
    and public.can_pair(me.id, p.id)
    and (cardinality(me.pref_churches) = 0 or p.church = any(me.pref_churches))
    and (cardinality(me.pref_skin_colors) = 0 or p.skin_color = any(me.pref_skin_colors))
  -- Quem já passou volta depois de quem ainda não foi visto, e a mesma igreja vem primeiro.
  order by exists (
    select 1 from public.swipes s
    where s.swiper_id = me.id and s.target_id = p.id
  ), (p.church is not distinct from me.church and p.church is not null) desc, random()
  limit least(greatest(p_limit, 1), 50);
$$;

create function public.get_public_profile(p_id uuid)
returns table (
  id uuid,
  name text,
  nickname text,
  bio text,
  age integer,
  video_path text,
  photo_paths text[],
  is_pro boolean,
  state text,
  city text,
  neighborhood text,
  hobbies jsonb,
  height_cm smallint,
  church text,
  is_match boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.name, p.nickname, p.bio, public.age_of(p.birth_date), p.video_path, p.photo_paths, p.is_pro,
    p.state, p.city, p.neighborhood, p.hobbies, p.height_cm, p.church,
    exists (
      select 1
      from public.swipes mine
      join public.swipes theirs
        on theirs.swiper_id = mine.target_id and theirs.target_id = mine.swiper_id
      where mine.swiper_id = (select auth.uid())
        and mine.target_id = p.id
        and mine.action = 'like'
        and theirs.action = 'like'
    )
  from public.profiles p
  where p.id = p_id
    and p.onboarded_at is not null
    and exists (
      select 1 from public.profiles viewer
      where viewer.id = (select auth.uid()) and viewer.onboarded_at is not null
    );
$$;

create or replace function public.record_swipe(p_target uuid, p_action public.swipe_action)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  already_liked boolean;
begin
  if not exists (
    select 1 from public.profiles p where p.id = me and p.onboarded_at is not null
  ) then
    raise exception 'not_onboarded' using errcode = '42501';
  end if;

  if p_target = me or not exists (
    select 1 from public.profiles p where p.id = p_target and p.onboarded_at is not null
  ) or not public.can_pair(me, p_target) then
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

create or replace function public.story_profiles(p_limit integer default 12)
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
    select p.id
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
    and public.can_pair(me.id, p.id)
    and (cardinality(p.photo_paths) > 0 or story.has_story)
  order by story.has_story desc, p.onboarded_at desc
  limit least(greatest(p_limit, 1), 30);
$$;

create or replace function public.story_feed()
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
    select p.id, p.is_pro
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
  cross join me
  where s.created_at > now() - interval '24 hours'
    and (s.user_id = me.id or (me.is_pro and public.can_pair(me.id, s.user_id)))
  order by s.created_at;
$$;

create or replace function public.can_view_story(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stories s
    join public.profiles me on me.id = (select auth.uid())
    where s.id = p_story
      and s.user_id <> me.id
      and s.created_at > now() - interval '24 hours'
      and me.onboarded_at is not null
      and me.is_pro
      and public.can_pair(me.id, s.user_id)
  );
$$;

-- Grants ---------------------------------------------------------------------

revoke execute on function
  public.wants_gender(public.gender, text[], public.gender),
  public.can_pair(uuid, uuid),
  public.discover_profiles(integer),
  public.get_public_profile(uuid)
from public, anon;

-- São regras internas das outras funções.
revoke execute on function
  public.wants_gender(public.gender, text[], public.gender),
  public.can_pair(uuid, uuid)
from authenticated;

grant execute on function
  public.discover_profiles(integer),
  public.get_public_profile(uuid)
to authenticated;

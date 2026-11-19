-- Stories deixam de ser do Pro: todo mundo vê, curte e posta sem limite.
-- O Pro passa a valer só pelo contato no WhatsApp (a RLS de profile_contacts fica como está).
-- O deck para de repetir quem já foi swipado, que era a causa do loop com a base pequena.

-- Deck -----------------------------------------------------------------------

-- Antes, quem já tinha sido swipado só ia para o fim da ordenação e voltava sempre.
-- Agora quem foi curtido não volta nunca, e quem foi passado só reaparece depois de 7 dias.
create or replace function public.discover_profiles(p_limit integer default 20)
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
  left join public.swipes s on s.swiper_id = me.id and s.target_id = p.id
  where p.onboarded_at is not null
    and p.id <> me.id
    and public.can_pair(me.id, p.id)
    and (cardinality(me.pref_churches) = 0 or p.church = any(me.pref_churches))
    and (cardinality(me.pref_skin_colors) = 0 or p.skin_color = any(me.pref_skin_colors))
    and (
      s.swiper_id is null
      or (s.action = 'pass' and s.created_at <= now() - interval '7 days')
    )
  -- Quem nunca foi visto vem primeiro, e a mesma igreja na frente.
  order by (s.swiper_id is not null),
           (p.church is not distinct from me.church and p.church is not null) desc,
           random()
  limit least(greatest(p_limit, 1), 50);
$$;

-- Stories --------------------------------------------------------------------

-- Sem o filtro de Pro: o feed traz o story de qualquer pessoa compatível.
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
    select p.id
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
    and (s.user_id = me.id or public.can_pair(me.id, s.user_id))
  order by s.created_at;
$$;

-- Ver e curtir story não dependem mais do Pro.
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
      and public.can_pair(me.id, s.user_id)
  );
$$;

-- Cai o teto de 1 story por dia de quem é free, e com ele a trava que só servia para contar.
create or replace function public.post_story(p_media_path text, p_media_type text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  new_story uuid;
begin
  if not exists (
    select 1 from public.profiles p where p.id = me and p.onboarded_at is not null
  ) then
    raise exception 'not_onboarded' using errcode = '42501';
  end if;

  if (string_to_array(p_media_path, '/'))[1] is distinct from me::text then
    raise exception 'foreign_media' using errcode = 'check_violation';
  end if;

  insert into public.stories (user_id, media_path, media_type)
  values (me, p_media_path, p_media_type)
  returning id into new_story;

  return new_story;
end;
$$;

-- Métricas -------------------------------------------------------------------

-- Visitas, curtidas recebidas e a lista de quem curtiu passam a ser de todo mundo.
create or replace function public.my_insights()
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
  where me.id = (select auth.uid()) and me.onboarded_at is not null;
$$;

create or replace function public.my_likers(p_limit integer default 60)
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
  join public.profiles me on me.id = (select auth.uid()) and me.onboarded_at is not null
  join public.profiles p on p.id = s.swiper_id
  where s.target_id = me.id
    and s.action = 'like'
    and p.onboarded_at is not null
  order by s.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

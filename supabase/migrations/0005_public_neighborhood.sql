-- O bairro passa a aparecer no card e no perfil, junto com a cidade.
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
  hobbies jsonb
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
  select
    p.id, p.name, p.nickname, p.bio, public.age_of(p.birth_date), p.video_path, p.photo_paths, p.is_pro,
    p.state, p.city, p.neighborhood, p.hobbies
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
  is_match boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.name, p.nickname, p.bio, public.age_of(p.birth_date), p.video_path, p.photo_paths, p.is_pro,
    p.state, p.city, p.neighborhood, p.hobbies,
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

revoke execute on function
  public.discover_profiles(integer),
  public.get_public_profile(uuid)
from public, anon;

grant execute on function
  public.discover_profiles(integer),
  public.get_public_profile(uuid)
to authenticated;

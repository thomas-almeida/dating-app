-- Localização e gostos do perfil. Cidade, estado e gostos aparecem para os outros.
-- O bairro não: as RPCs não devolvem essa coluna, para ninguém ser localizado com precisão.
alter table public.profiles
  add column state text check (state ~ '^[A-Z]{2}$'),
  add column city text check (char_length(city) between 1 and 80),
  add column neighborhood text check (char_length(neighborhood) between 1 and 80),
  add column hobbies jsonb not null default '[]' check (
    jsonb_typeof(hobbies) = 'array'
    and jsonb_array_length(hobbies) <= 3
    and not jsonb_path_exists(
      hobbies,
      '$[*] ? (!(@.emoji.type() == "string" && @.hobbie.type() == "string"
        && @.emoji like_regex "^.{1,16}$" && @.hobbie like_regex "^.{1,30}$"))'
    )
  );

grant update (state, city, neighborhood, hobbies) on public.profiles to authenticated;

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
    p.state, p.city, p.hobbies
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
    p.state, p.city, p.hobbies,
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

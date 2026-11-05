-- Esquema inicial do app.
--
-- Regras gerais:
--   * Toda tabela tem RLS ligado. O que o cliente não precisa ler ou gravar fica
--     sem policy e só é acessado no servidor, com a service role.
--   * Dados de outros usuários só saem pelas funções discover_profiles,
--     story_profiles, get_public_profile e my_matches, que nunca devolvem
--     birth_date nem WhatsApp.
--   * O Supabase concede tudo a anon e authenticated por padrão, por isso os
--     grants abaixo começam com revoke.

create type public.waitlist_status as enum ('pending', 'approved', 'rejected', 'activated');
create type public.swipe_action as enum ('like', 'pass');
create type public.gender as enum ('male', 'female');
create type public.subscription_status as enum ('pending', 'active', 'cancelled');

-- Perfis ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  nickname text check (char_length(nickname) between 1 and 40),
  bio text check (char_length(bio) <= 500),
  gender public.gender,
  birth_date date,
  video_path text,
  photo_paths text[] not null default '{}',
  is_pro boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create index profiles_discover_idx on public.profiles (gender, created_at desc)
  where onboarded_at is not null;

create table public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  whatsapp text not null check (whatsapp ~ '^[0-9]{12,13}$')
);

-- onboarded_at é sempre calculado aqui: o cliente não consegue marcar um perfil
-- incompleto como pronto, nem apontar para arquivos de outra pessoa.
create function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_prefix text := new.id::text || '/%';
begin
  if new.birth_date is not null and new.birth_date > (current_date - interval '18 years')::date then
    raise exception 'underage' using errcode = 'check_violation';
  end if;

  if cardinality(new.photo_paths) > 2 then
    raise exception 'too_many_photos' using errcode = 'check_violation';
  end if;

  if new.video_path is not null and new.video_path not like owner_prefix then
    raise exception 'foreign_media' using errcode = 'check_violation';
  end if;

  if exists (select 1 from unnest(new.photo_paths) as path where path not like owner_prefix) then
    raise exception 'foreign_media' using errcode = 'check_violation';
  end if;

  if new.nickname is not null
    and new.bio is not null
    and new.gender is not null
    and new.birth_date is not null
    and (new.video_path is not null or cardinality(new.photo_paths) > 0)
  then
    new.onboarded_at := coalesce(old.onboarded_at, now());
  else
    new.onboarded_at := null;
  end if;

  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- Lista de espera ------------------------------------------------------------

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null unique check (email = lower(email)),
  phone text not null check (phone ~ '^[0-9]{12,13}$'),
  status public.waitlist_status not null default 'pending',
  invite_token_hash text unique,
  invite_expires_at timestamptz,
  approved_at timestamptz,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index waitlist_status_idx on public.waitlist (status, created_at desc);

-- Swipes ---------------------------------------------------------------------

create table public.swipes (
  swiper_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  action public.swipe_action not null,
  created_at timestamptz not null default now(),
  primary key (swiper_id, target_id),
  check (swiper_id <> target_id)
);

create index swipes_target_idx on public.swipes (target_id, action);

-- Pagamentos -----------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  checkout_id text unique,
  subscription_id text unique,
  customer_id text,
  status public.subscription_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id, status);
create index subscriptions_customer_idx on public.subscriptions (customer_id);

-- Guarda todo webhook recebido, inclusive os que não casaram com nenhum usuário,
-- para conferência manual.
create table public.payment_events (
  id text primary key,
  event text not null,
  dev_mode boolean not null default false,
  user_id uuid references public.profiles (id) on delete set null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Funções de apoio -----------------------------------------------------------

-- Quem usar signUp direto com a chave pública não tem linha em profiles e,
-- portanto, não passa por nenhuma policy.
create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()));
$$;

create function public.is_pro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_pro from public.profiles where id = (select auth.uid())), false);
$$;

create function public.age_of(p_birth_date date)
returns integer
language sql
stable
set search_path = ''
as $$
  select extract(year from age(p_birth_date))::integer;
$$;

-- Leituras -------------------------------------------------------------------

create function public.discover_profiles(p_limit integer default 20)
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
    and not exists (
      select 1 from public.swipes s
      where s.swiper_id = me.id and s.target_id = p.id
    )
  order by random()
  limit least(greatest(p_limit, 1), 50);
$$;

create function public.story_profiles(p_limit integer default 12)
returns table (
  id uuid,
  nickname text,
  photo_path text
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
  select p.id, p.nickname, p.photo_paths[1]
  from public.profiles p
  cross join me
  where p.onboarded_at is not null
    and p.id <> me.id
    and p.gender <> me.gender
    and cardinality(p.photo_paths) > 0
  order by p.onboarded_at desc
  limit least(greatest(p_limit, 1), 30);
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
  is_match boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.name, p.nickname, p.bio, public.age_of(p.birth_date), p.video_path, p.photo_paths, p.is_pro,
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

create function public.my_matches()
returns table (
  id uuid,
  name text,
  nickname text,
  age integer,
  video_path text,
  photo_paths text[],
  matched_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.name, p.nickname, public.age_of(p.birth_date), p.video_path, p.photo_paths,
    greatest(mine.created_at, theirs.created_at) as matched_at
  from public.swipes mine
  join public.swipes theirs
    on theirs.swiper_id = mine.target_id and theirs.target_id = mine.swiper_id
  join public.profiles p on p.id = mine.target_id
  where mine.swiper_id = (select auth.uid())
    and mine.action = 'like'
    and theirs.action = 'like'
    and p.onboarded_at is not null
  order by matched_at desc;
$$;

-- Escrita --------------------------------------------------------------------

-- Devolve true quando o like fecha um match.
create function public.record_swipe(p_target uuid, p_action public.swipe_action)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_gender public.gender;
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

  insert into public.swipes (swiper_id, target_id, action)
  values (me, p_target, p_action)
  on conflict (swiper_id, target_id)
  do update set action = excluded.action, created_at = now();

  return p_action = 'like' and exists (
    select 1 from public.swipes s
    where s.swiper_id = p_target and s.target_id = me and s.action = 'like'
  );
end;
$$;

-- RLS ------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.waitlist enable row level security;
alter table public.swipes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- O número só chega ao cliente de quem é Pro.
create policy "contacts_select_own_or_pro" on public.profile_contacts
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_pro()));

create policy "contacts_update_own" on public.profile_contacts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Grants ---------------------------------------------------------------------

revoke all on table
  public.profiles,
  public.profile_contacts,
  public.waitlist,
  public.swipes,
  public.subscriptions,
  public.payment_events
from anon, authenticated;

grant select on public.profiles to authenticated;
-- is_pro e onboarded_at ficam de fora de propósito.
grant update (name, nickname, bio, gender, birth_date, video_path, photo_paths)
  on public.profiles to authenticated;

grant select on public.profile_contacts to authenticated;
grant update (whatsapp) on public.profile_contacts to authenticated;

grant select on public.subscriptions to authenticated;

grant all on table
  public.profiles,
  public.profile_contacts,
  public.waitlist,
  public.swipes,
  public.subscriptions,
  public.payment_events
to service_role;

revoke execute on function
  public.profiles_guard(),
  public.is_member(),
  public.is_pro(),
  public.age_of(date),
  public.discover_profiles(integer),
  public.story_profiles(integer),
  public.get_public_profile(uuid),
  public.my_matches(),
  public.record_swipe(uuid, public.swipe_action)
from public, anon;

grant execute on function
  public.is_member(),
  public.is_pro(),
  public.discover_profiles(integer),
  public.story_profiles(integer),
  public.get_public_profile(uuid),
  public.my_matches(),
  public.record_swipe(uuid, public.swipe_action)
to authenticated;

-- Storage --------------------------------------------------------------------

-- Bucket privado. Outros membros veem a mídia por URLs assinadas no servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

create policy "media_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "media_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_member())
  );

create policy "media_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "media_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

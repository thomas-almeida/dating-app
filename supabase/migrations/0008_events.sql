-- Eventos: qualquer membro cria e confirma presença. Só quem criou edita e exclui.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null check (char_length(description) between 1 and 1000),
  location text not null check (char_length(location) between 1 and 160),
  organizer text not null check (char_length(organizer) between 1 and 80),
  starts_at timestamptz not null,
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 3),
  created_at timestamptz not null default now()
);

create index events_starts_at_idx on public.events (starts_at);

create table public.event_attendees (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_attendees_user_idx on public.event_attendees (user_id);

-- As fotos ficam na pasta de quem criou: ninguém aponta para o arquivo de outra pessoa.
create function public.events_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_prefix text := new.owner_id::text || '/%';
begin
  if exists (select 1 from unnest(new.photo_paths) as path where path not like owner_prefix) then
    raise exception 'foreign_media' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger events_guard
  before insert or update on public.events
  for each row execute function public.events_guard();

-- Quem cria já vai.
create function public.events_owner_attends()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_attendees (event_id, user_id) values (new.id, new.owner_id);
  return new;
end;
$$;

create trigger events_owner_attends
  after insert on public.events
  for each row execute function public.events_owner_attends();

alter table public.events enable row level security;
alter table public.event_attendees enable row level security;

create policy "events_select_members" on public.events
  for select to authenticated
  using ((select public.is_member()));

create policy "events_insert_own" on public.events
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.is_member()));

create policy "events_update_own" on public.events
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "events_delete_own" on public.events
  for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke all on table public.events, public.event_attendees from public, anon, authenticated;
grant select, delete on public.events to authenticated;
grant insert (owner_id, name, description, location, organizer, starts_at, photo_paths)
  on public.events to authenticated;
grant update (name, description, location, organizer, starts_at, photo_paths)
  on public.events to authenticated;
grant all on table public.events, public.event_attendees to service_role;

-- Os próximos primeiro. Evento de ontem ainda aparece, para quem foi achar.
create function public.list_events()
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  location text,
  organizer text,
  starts_at timestamptz,
  photo_paths text[],
  going_count integer,
  going boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id, e.owner_id, e.name, e.description, e.location, e.organizer, e.starts_at, e.photo_paths,
    (select count(*)::integer from public.event_attendees a where a.event_id = e.id),
    exists (
      select 1 from public.event_attendees a
      where a.event_id = e.id and a.user_id = (select auth.uid())
    )
  from public.events e
  where public.is_member()
    and e.starts_at > now() - interval '1 day'
  order by e.starts_at;
$$;

create function public.get_event(p_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  location text,
  organizer text,
  starts_at timestamptz,
  photo_paths text[],
  going_count integer,
  going boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id, e.owner_id, e.name, e.description, e.location, e.organizer, e.starts_at, e.photo_paths,
    (select count(*)::integer from public.event_attendees a where a.event_id = e.id),
    exists (
      select 1 from public.event_attendees a
      where a.event_id = e.id and a.user_id = (select auth.uid())
    )
  from public.events e
  where e.id = p_id and public.is_member();
$$;

create function public.event_people(p_event uuid)
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
  select p.id, coalesce(p.nickname, p.name), p.photo_paths[1]
  from public.event_attendees a
  join public.profiles p on p.id = a.user_id
  where a.event_id = p_event
    and p.onboarded_at is not null
    and public.is_member()
  order by a.created_at;
$$;

-- Devolve se a pessoa vai, depois do toque.
create function public.toggle_event_attendance(p_event uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not public.is_member() then
    raise exception 'not_onboarded' using errcode = '42501';
  end if;

  if not exists (select 1 from public.events e where e.id = p_event and e.starts_at > now()) then
    raise exception 'event_closed' using errcode = '22023';
  end if;

  delete from public.event_attendees a where a.event_id = p_event and a.user_id = me;
  if found then
    return false;
  end if;

  insert into public.event_attendees (event_id, user_id) values (p_event, me);
  return true;
end;
$$;

revoke execute on function
  public.events_guard(),
  public.events_owner_attends(),
  public.list_events(),
  public.get_event(uuid),
  public.event_people(uuid),
  public.toggle_event_attendance(uuid)
from public, anon;

revoke execute on function public.events_guard(), public.events_owner_attends() from authenticated;

grant execute on function
  public.list_events(),
  public.get_event(uuid),
  public.event_people(uuid),
  public.toggle_event_attendance(uuid)
to authenticated;

-- Chat entre quem deu match. Como stories, as tabelas não têm grant para os clientes:
-- nada chega sem passar pelas funções abaixo, que conferem o match a cada chamada.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index messages_pair_idx on public.messages (sender_id, recipient_id, created_at desc);
create index messages_unread_idx on public.messages (recipient_id, sender_id) where read_at is null;

-- Uma linha por aparelho que autorizou notificações. Só o servidor lê e grava.
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.messages enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on table public.messages, public.push_subscriptions from public, anon, authenticated;
grant all on table public.messages, public.push_subscriptions to service_role;

create function public.is_match(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.swipes mine
    join public.swipes theirs
      on theirs.swiper_id = mine.target_id and theirs.target_id = mine.swiper_id
    where mine.swiper_id = p_a
      and mine.target_id = p_b
      and mine.action = 'like'
      and theirs.action = 'like'
  );
$$;

create function public.send_message(p_to uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  clean_body text := btrim(p_body);
  message_id uuid;
begin
  if not public.is_match(me, p_to) then
    raise exception 'not_matched' using errcode = '42501';
  end if;

  if char_length(clean_body) not between 1 and 1000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  insert into public.messages (sender_id, recipient_id, body)
  values (me, p_to, clean_body)
  returning id into message_id;

  return message_id;
end;
$$;

-- As mais recentes, do fim para o começo: quem chama inverte para mostrar.
create function public.chat_messages(p_with uuid, p_limit integer default 100)
returns table (
  id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz,
  read_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.sender_id, m.body, m.created_at, m.read_at
  from public.messages m
  where public.is_match((select auth.uid()), p_with)
    and (
      (m.sender_id = (select auth.uid()) and m.recipient_id = p_with)
      or (m.sender_id = p_with and m.recipient_id = (select auth.uid()))
    )
  order by m.created_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

create function public.mark_chat_read(p_with uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages m
  set read_at = now()
  where m.sender_id = p_with
    and m.recipient_id = (select auth.uid())
    and m.read_at is null;
$$;

create function public.unread_messages()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.messages m
  where m.recipient_id = (select auth.uid())
    and m.read_at is null
    and public.is_match((select auth.uid()), m.sender_id);
$$;

-- Os matches, de quem falou por último para quem ainda não falou.
create function public.my_conversations()
returns table (
  id uuid,
  name text,
  nickname text,
  age integer,
  photo_paths text[],
  matched_at timestamptz,
  last_body text,
  last_at timestamptz,
  last_from_me boolean,
  unread integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select
    p.id, p.name, p.nickname, public.age_of(p.birth_date), p.photo_paths,
    greatest(mine.created_at, theirs.created_at) as matched_at,
    last.body, last.created_at, last.sender_id = me.id,
    (
      select count(*)::integer
      from public.messages m
      where m.sender_id = p.id and m.recipient_id = me.id and m.read_at is null
    )
  from me
  join public.swipes mine on mine.swiper_id = me.id and mine.action = 'like'
  join public.swipes theirs
    on theirs.swiper_id = mine.target_id and theirs.target_id = me.id and theirs.action = 'like'
  join public.profiles p on p.id = mine.target_id and p.onboarded_at is not null
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.messages m
    where (m.sender_id = me.id and m.recipient_id = p.id)
      or (m.sender_id = p.id and m.recipient_id = me.id)
    order by m.created_at desc
    limit 1
  ) last on true
  order by coalesce(last.created_at, greatest(mine.created_at, theirs.created_at)) desc;
$$;

revoke execute on function
  public.is_match(uuid, uuid),
  public.send_message(uuid, text),
  public.chat_messages(uuid, integer),
  public.mark_chat_read(uuid),
  public.unread_messages(),
  public.my_conversations()
from public, anon;

-- É só uma regra interna das outras funções.
revoke execute on function public.is_match(uuid, uuid) from authenticated;

grant execute on function
  public.send_message(uuid, text),
  public.chat_messages(uuid, integer),
  public.mark_chat_read(uuid),
  public.unread_messages(),
  public.my_conversations()
to authenticated;

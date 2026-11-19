-- Anúncios entre os cards do deck. Quem é Pro não recebe nenhum: o corte é no servidor,
-- em active_ads, e não no cliente. Só o admin escreve, pela service role nos server actions.

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  description text not null check (char_length(description) between 1 and 140),
  image_path text not null check (char_length(image_path) between 1 and 400),
  -- Só https: barra javascript:, data: e afins, que viriam de um admin distraído ou invadido.
  target_url text not null check (target_url ~ '^https://[^[:space:]]+$' and char_length(target_url) <= 600),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index ads_active_idx on public.ads (active, created_at desc);

create type public.ad_event_kind as enum ('impression', 'click');

create table public.ad_events (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads (id) on delete cascade,
  -- Perfil apagado não leva a métrica embora.
  user_id uuid references public.profiles (id) on delete set null,
  kind public.ad_event_kind not null,
  day date not null default current_date,
  created_at timestamptz not null default now()
);

create index ad_events_report_idx on public.ad_events (ad_id, kind, day);

-- Exibição é única por anúncio/pessoa/dia: sem isso, 1 anúncio a cada 3 cards com recarga
-- de deck geraria milhares de linhas por semana. O clique continua contando todos.
create unique index ad_events_impression_once_idx
  on public.ad_events (ad_id, user_id, day)
  where kind = 'impression';

-- RLS ligada e sem nenhuma policy: o cliente não lê nem escreve direto.
-- Todo acesso passa pelas funções abaixo ou pela service role.
alter table public.ads enable row level security;
alter table public.ad_events enable row level security;

revoke all on public.ads from anon, authenticated;
revoke all on public.ad_events from anon, authenticated;

-- Leitura ---------------------------------------------------------------------

-- Devolve zero linhas para quem é Pro, para quem não terminou o perfil e para o anon.
-- A ordem é aleatória: quem chama embaralha e distribui entre as posições do deck.
create function public.active_ads(p_limit integer default 8)
returns table (
  id uuid,
  title text,
  description text,
  image_path text,
  target_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.title, a.description, a.image_path, a.target_url
  from public.ads a
  cross join (
    select p.is_pro
    from public.profiles p
    where p.id = (select auth.uid()) and p.onboarded_at is not null
  ) me
  where a.active
    and not me.is_pro
  order by random()
  limit least(greatest(p_limit, 1), 20);
$$;

-- Escrita ---------------------------------------------------------------------

-- Anúncio desativado não gera evento. A exibição repetida no mesmo dia é descartada
-- em silêncio pelo índice único, então a tela não precisa controlar o que já mandou.
create function public.record_ad_event(p_ad uuid, p_kind public.ad_event_kind)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.onboarded_at is not null
  ) then
    raise exception 'not_onboarded' using errcode = '42501';
  end if;

  if not exists (select 1 from public.ads a where a.id = p_ad and a.active) then
    return;
  end if;

  insert into public.ad_events (ad_id, user_id, kind)
  values (p_ad, (select auth.uid()), p_kind)
  on conflict do nothing;
end;
$$;

-- Grants ----------------------------------------------------------------------

revoke execute on function
  public.active_ads(integer),
  public.record_ad_event(uuid, public.ad_event_kind)
from public, anon;

grant execute on function
  public.active_ads(integer),
  public.record_ad_event(uuid, public.ad_event_kind)
to authenticated;

-- O carrossel de stories listava qualquer perfil compatível que tivesse foto, com ou sem
-- story. Enquanto stories eram do Pro isso era uma vitrine com cadeado; agora que são de
-- graça, virou uma lista de todos os usuários do app. Passa a sair só quem tem story ativo.
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
  select p.id, p.nickname, p.photo_paths[1], true
  from public.profiles p
  cross join me
  cross join lateral (
    select max(s.created_at) as last_at
    from public.stories s
    where s.user_id = p.id and s.created_at > now() - interval '24 hours'
  ) story
  where p.onboarded_at is not null
    and p.id <> me.id
    and public.can_pair(me.id, p.id)
    -- O lateral devolve null quando a pessoa não tem story vivo.
    and story.last_at is not null
  -- Quem postou mais recentemente primeiro.
  order by story.last_at desc
  limit least(greatest(p_limit, 1), 30);
$$;

-- Primeira vez que a pessoa abriu o app instalado. Fica na conta porque, no iPhone, o app
-- instalado e o Safari não dividem storage: é assim que o navegador sabe que pode parar de lembrar.
-- Sem grant de update: como is_pro e onboarded_at, só o servidor marca.
alter table public.profiles add column app_installed_at timestamptz;

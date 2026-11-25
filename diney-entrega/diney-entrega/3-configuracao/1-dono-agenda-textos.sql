-- Passo 1: dono do site, textos e agenda. Cole no Supabase (SQL Editor) e clique em Run.
-- Dono do site

create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

drop policy if exists "diney adiciona" on public.midias;
drop policy if exists "diney apaga" on public.midias;
drop policy if exists "diney envia arquivos" on storage.objects;
drop policy if exists "diney apaga arquivos" on storage.objects;

create policy "dono adiciona" on public.midias for insert to authenticated with check (public.is_admin());
create policy "dono apaga" on public.midias for delete to authenticated using (public.is_admin());
create policy "dono envia arquivos" on storage.objects for insert to authenticated with check (bucket_id = 'midias' and public.is_admin());
create policy "dono apaga arquivos" on storage.objects for delete to authenticated using (bucket_id = 'midias' and public.is_admin());

delete from public.admins;
insert into public.admins (email) values (lower('dineydesouza@gmail.com'));

-- Textos, logo e WhatsApp do site
create table if not exists public.site (id int primary key default 1 check (id = 1), data jsonb not null default '{}'::jsonb);
insert into public.site (id) values (1) on conflict (id) do nothing;
alter table public.site enable row level security;
drop policy if exists "todos leem site" on public.site;
drop policy if exists "dono altera site" on public.site;
create policy "todos leem site" on public.site for select using (true);
create policy "dono altera site" on public.site for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pedidos de data dos clientes
create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  nome text not null check (char_length(nome) between 1 and 120),
  telefone text check (char_length(telefone) <= 30),
  evento text check (char_length(evento) <= 40),
  data date,
  local text check (char_length(local) <= 200),
  msg text check (char_length(msg) <= 2000),
  status text not null default 'novo' check (status in ('novo', 'confirmado'))
);
alter table public.agendamentos enable row level security;
drop policy if exists "clientes pedem data" on public.agendamentos;
drop policy if exists "dono ve agenda" on public.agendamentos;
drop policy if exists "dono confirma" on public.agendamentos;
drop policy if exists "dono apaga pedido" on public.agendamentos;
create policy "clientes pedem data" on public.agendamentos for insert to anon, authenticated
  with check (status = 'novo' and (user_id is null or user_id = auth.uid()));
create policy "dono ve agenda" on public.agendamentos for select to authenticated using (public.is_admin());
create policy "dono confirma" on public.agendamentos for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "dono apaga pedido" on public.agendamentos for delete to authenticated using (public.is_admin());

-- Datas já confirmadas (o site avisa o cliente; mostra só as datas, nada pessoal)
create or replace function public.datas_ocupadas() returns setof date
language sql security definer stable set search_path = public as $$
  select distinct data from public.agendamentos where status = 'confirmado' and data >= current_date;
$$;

-- Números para o dono (contas, logins, pedidos)
create or replace function public.numeros() returns json
language plpgsql security definer stable set search_path = public, auth as $$
declare logins bigint;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  begin
    select count(*) into logins from auth.audit_log_entries
      where payload ->> 'action' = 'login' and created_at > now() - interval '30 days';
  exception when others then logins := null;
  end;
  return json_build_object(
    'contas',   (select count(*) from auth.users),
    'novas30',  (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'ativos7',  (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'logins30', logins,
    'pedidos',  (select count(*) from public.agendamentos),
    'novos',    (select count(*) from public.agendamentos where status = 'novo')
  );
end $$;
revoke execute on function public.numeros() from anon;

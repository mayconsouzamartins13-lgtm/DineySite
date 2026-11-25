-- Passo 4: aceitar / recusar pedidos e valor de cada trabalho (faturamento).
-- Cole no Supabase (SQL Editor > New query) e clique em Run.

alter table public.agendamentos add column if not exists valor numeric(12,2);
alter table public.agendamentos drop constraint if exists agendamentos_valor_check;
alter table public.agendamentos add constraint agendamentos_valor_check check (valor is null or (valor >= 0 and valor < 10000000));

alter table public.agendamentos drop constraint if exists agendamentos_status_check;
alter table public.agendamentos add constraint agendamentos_status_check
  check (status in ('novo', 'confirmado', 'atendido', 'aceito', 'recusado'));

-- O cliente nunca define valor nem status (só o Diney muda isso pelo painel)
create or replace function public.pedido_sem_valor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then new.valor := null; end if;
  return new;
end $$;
drop trigger if exists pedido_sem_valor on public.agendamentos;
create trigger pedido_sem_valor before insert on public.agendamentos for each row execute function public.pedido_sem_valor();

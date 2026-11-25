-- Parte 3: pedidos de orçamento + notificação no celular do Diney.
-- Cole tudo no Supabase (SQL Editor > New query) e clique em Run.

-- Marca de "já visto" e status "atendido"
alter table public.agendamentos add column if not exists visto boolean not null default false;
alter table public.agendamentos drop constraint if exists agendamentos_status_check;
alter table public.agendamentos add constraint agendamentos_status_check check (status in ('novo', 'confirmado', 'atendido'));

-- O sininho do app atualiza na hora quando chega pedido
do $$ begin
  alter publication supabase_realtime add table public.agendamentos;
exception when duplicate_object then null;
end $$;

-- Notificação no celular (app ntfy, canal privado do Diney)
create extension if not exists pg_net;

create or replace function public.avisar_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://ntfy.sh/',
    body := jsonb_build_object(
      'topic', 'diney-pedidos-edac21116bbd',
      'title', 'Novo pedido de orçamento',
      'message', coalesce(new.evento, 'Evento')
                 || coalesce(' · ' || to_char(new.data, 'DD/MM/YYYY'), '')
                 || ' · ' || split_part(new.nome, ' ', 1),
      'tags', jsonb_build_array('movie_camera'),
      'priority', 4,
      'click', 'https://dineydesouza.netlify.app/#pedidos'
    )
  );
  return new;
exception when others then
  return new; -- se a notificação falhar, o pedido é salvo do mesmo jeito
end $$;

drop trigger if exists avisar_pedido on public.agendamentos;
create trigger avisar_pedido after insert on public.agendamentos
  for each row execute function public.avisar_pedido();

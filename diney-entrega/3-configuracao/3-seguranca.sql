-- Parte 4: segurança. Cole no Supabase (SQL Editor > New query) e clique em Run.

-- 1) Pedidos de orçamento: o cliente só consegue criar pedido "novo", nunca marcar nada.
create or replace function public.pedido_seguro() returns trigger
language plpgsql security definer set search_path = public as $$
declare tel text := regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g');
begin
  if public.is_admin() then return new; end if;
  -- limpa o que vem do site
  new.status := 'novo'; new.visto := false; new.user_id := null;
  new.created_at := now();
  new.nome := left(btrim(regexp_replace(new.nome, '[[:cntrl:]]', ' ', 'g')), 120);
  new.evento := left(btrim(coalesce(new.evento, '')), 40);
  new.local := left(btrim(regexp_replace(coalesce(new.local, ''), '[[:cntrl:]]', ' ', 'g')), 200);
  new.msg := left(coalesce(new.msg, ''), 2000);
  if length(tel) < 10 or length(tel) > 13 then raise exception 'telefone invalido'; end if;
  if new.data is not null and (new.data < current_date - 1 or new.data > current_date + 1095) then new.data := null; end if;
  -- anti-spam: no máximo 3 pedidos por telefone por dia e 40 pedidos por hora no total
  if (select count(*) from public.agendamentos a
        where regexp_replace(coalesce(a.telefone, ''), '\D', '', 'g') = tel and a.created_at > now() - interval '1 day') >= 3 then
    raise exception 'muitos pedidos deste telefone';
  end if;
  if (select count(*) from public.agendamentos where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'muitos pedidos agora';
  end if;
  return new;
end $$;
drop trigger if exists pedido_seguro on public.agendamentos;
create trigger pedido_seguro before insert on public.agendamentos for each row execute function public.pedido_seguro();
create index if not exists agendamentos_created_idx on public.agendamentos (created_at desc);

-- 2) Só links https nas fotos e vídeos
alter table public.midias drop constraint if exists midias_url_https;
alter table public.midias add constraint midias_url_https check (url ~ '^https://[^[:space:]"<>]+$') not valid;

-- 3) Pasta de arquivos: só imagem e vídeo, até 50 MB
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm'], file_size_limit = 52428800 where id = 'midias';

-- 4) Funções internas: só quem está logado pode chamar
revoke execute on function public.numeros() from public, anon;
grant execute on function public.numeros() to authenticated;

-- 5) Aviso no celular abre o painel (troque o endereço se o painel tiver outro nome)
create or replace function public.avisar_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://ntfy.sh/',
    body := jsonb_build_object(
      'topic', 'diney-pedidos-edac21116bbd',
      'title', 'Novo pedido de orçamento',
      'message', coalesce(new.evento, 'Evento') || coalesce(' · ' || to_char(new.data, 'DD/MM/YYYY'), '') || ' · ' || split_part(new.nome, ' ', 1),
      'tags', jsonb_build_array('movie_camera'),
      'priority', 4,
      'click', 'https://dineydesouza-painel.netlify.app/#pedidos'
    )
  );
  return new;
exception when others then
  return new;
end $$;

-- Conferência: todas as tabelas com rls = true
select c.relname as tabela, c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'public' order by 1;

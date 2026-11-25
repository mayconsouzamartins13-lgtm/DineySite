# Diney de Souza: como colocar no ar

**Tempo:** cerca de 20 minutos. **Custo:** grátis.

**O que testar com o Diney depois:**
1. Abrir o painel, entrar e instalar no celular.
2. Em **Fotos**, adicionar umas 50 fotos de uma vez e ver passando no site.
3. Em **Vídeos**, colar um link do Instagram e um do YouTube.
4. No site, pelo celular de outra pessoa, mandar um **Pedir orçamento**.
5. No painel, ver o pedido em **Pedidos**, tocar nele, **Chamar no WhatsApp**, e depois **Aceitar** com o valor (ou **Recusar**).
6. Ver o valor somar em **Trabalhos e faturamento**.

São **dois sites** separados, os dois grátis:

| Pasta | O que é | Endereço sugerido |
|---|---|---|
| `1-site-clientes` | O site que os clientes veem. Sem login. | dineydesouza.netlify.app |
| `2-painel-diney` | O painel só do Diney, com e-mail e senha. | dineydesouza-painel.netlify.app |

A pasta `3-configuracao` **não vai para a internet**. Ela tem os comandos do banco e este guia.

---

## 1. Supabase (uma vez só)

Abra o **SQL Editor** em https://supabase.com/dashboard/project/wdxlmfiwtpnbuaugfzrc/sql/new

Rode os 4 arquivos **nesta ordem**. Para cada um: abra o arquivo, copie tudo, cole, clique em **Run** e espere aparecer "Success".

1. `1-dono-agenda-textos.sql`
2. `2-pedidos-e-avisos.sql`
3. `3-seguranca.sql`
4. `4-aceitar-e-faturamento.sql`

Pode rodar de novo sem medo, porque eles não apagam nada.

## 2. Criar a conta do Diney (uma vez só)

1. No Supabase, abra **Authentication** e depois **Users**.
2. Clique em **Add user** e depois em **Create new user**.
3. E-mail: `dineydesouza@gmail.com`. Senha: a que o Diney escolher.
4. Marque **Auto Confirm User** e clique em **Create user**.

## 3. Fechar o cadastro (importante para a segurança)

1. Abra **Authentication**, depois **Sign In / Providers**.
2. **Desligue** "Allow new users to sign up" e clique em **Save**.

Assim ninguém mais consegue criar conta. O site dos clientes não usa login, e só a conta do Diney existe.

## 4. Netlify: site dos clientes

1. Abra https://app.netlify.com/drop
2. Arraste a pasta **1-site-clientes**.
3. Clique em **Claim this site** (é grátis).
4. Em **Site configuration**, clique em **Change site name** e coloque `dineydesouza`.

## 5. Netlify: painel do Diney

1. Na Netlify, clique em **Add new site** e depois em **Deploy manually**.
2. Arraste a pasta **2-painel-diney**.
3. Em **Change site name**, coloque `dineydesouza-painel`.

Se escolher outros nomes, avise o Claude para ajustar os links.

## 6. Celular do Diney

1. Abra `dineydesouza-painel.netlify.app` e entre com o e-mail e a senha.
2. Instale como app:
   - **iPhone:** Compartilhar, depois **Adicionar à Tela de Início**.
   - **Android:** menu ⋮, depois **Instalar app**.
3. Para receber aviso de pedido novo no celular, instale o app grátis **ntfy**, toque em **+** e se inscreva no tópico que está no arquivo `2-pedidos-e-avisos.sql` (a linha `'topic'`). **Não divulgue esse nome.**

---

## O que protege o site

- O site dos clientes **só lê** informações. Ele não consegue mudar nada.
- Tudo que muda (fotos, textos, pedidos) passa pelo banco, que **só aceita a conta do Diney**.
- **Pedidos:**
  - no máximo 3 por telefone por dia e 40 por hora no total;
  - o telefone tem que ser válido;
  - um campo invisível pega robôs de spam.
- **Arquivos:** só imagem e vídeo, até 50 MB. Links só começando com https.
- **Navegador:** proteções fortes (arquivo `_headers`) impedem código de fora, o site ser colocado dentro de outro site e o roubo de dados.
- **Painel:** fica escondido do Google e bloqueia por 1 minuto depois de 5 senhas erradas.
- **Quedas:** o Netlify e o Supabase aguentam muito acesso. Os vídeos grandes devem ir pelo YouTube, para não gastar o limite grátis.

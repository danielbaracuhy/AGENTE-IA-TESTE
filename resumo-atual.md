# Resumo do Projeto — AGENTE-IA-TESTE (atualizado 05/06/2026)

## Visão geral
App de gestão de tráfego com IA para PMEs (marca: Digitalizando Negócios). Funciona como um
gestor de tráfego dentro de um app: cria campanhas no Meta Ads, acompanha ao vivo, escala e
analisa criativos. Objetivo: vender pra várias empresas. Caso de teste: infoproduto próprio
(óleo de fritura usado — Hotmart, R$597).

## Modo de trabalho
Claude Code é o EXECUTOR; Daniel e Claude são os PENSADORES. Daniel decide o rumo, Claude
desenha a solução, e todo pedido de execução sai como prompt pronto pra colar no Claude Code —
nunca instrução manual passo a passo. Uma mudança por vez, revisar diff antes do commit.
Comunicação direta, sem bajulação. Daniel se comunica muito por screenshots.

## Onde fica (IMPORTANTE)
- Repo: `C:\Users\NetSolutions\Desktop\...\AGENTE-IA-TESTE` (git, publica na Vercel).
- GitHub: danielbaracuhy/AGENTE-IA-TESTE · branch master · Site: agente-ia-teste-roan.vercel.app
- Deploy: editar → git add/commit → git push origin master → a Vercel publica sozinha.
- NÃO confundir com a pasta "AGENTE ANALISE ADS" (não é o dashboard).
- A raiz serve `index.html`.

## Stack
HTML/CSS/JS puro (sem bundler), ESM via CDN; serverless Vercel (Node 18+, fetch nativo);
Vercel Blob (vídeo); Graph API v25.0 em todos os endpoints; orçamento CBO no nível da campanha.
Banco: Supabase (Postgres + Auth). Frontend importa supabase-js via esm.sh.

---

## O QUE ESTÁ PRONTO E VALIDADO

### 1. CRIADOR
Campanha (CBO) → conjunto (WhatsApp/site) → criativo(s) → anúncio(s). Multi-criativo (1 imagem
+ 1 vídeo competindo). Vídeo via Blob. Continua simples (sem pixel/venda — decisão consciente).

### 2. MINHAS CAMPANHAS
Lista ao vivo; Ativar/Pausar (cascata, start_time=now); Excluir; ESCALAR orçamento (+20%/+50%/
personalizado; detecta CBO vs ABO).

### 3. ANALISADOR — LEITOR UNIVERSAL DE CONVERSÃO (validado)
`detectarConversao(actions)` escolhe a conversão por prioridade explícita:
purchase → fb_pixel_purchase → lead → fb_pixel_lead → lead_grouped → conversa (regex
`messaging_conversation_started`) → landing_page_view → fallback. Sem somar duplicatas
(`actionValue` usa `===` exato). O rótulo segue o que foi contado. Lê `objective` só pra debug.
VALIDADO com dados reais: venda/pixel Hotmart = "compra" (CPP R$167,24); site = "visita na
página" (CPP R$0,44); todas as campanhas = soma correta com subtexto vazio (misto).
Loader e rodapé do PDF com wording de tempo real (sem resquício de CSV). Card "Conv. Landing
Page" some quando a conversão é "visita na página" (era redundante, mostrava ~100%).

### 4. LOGIN / MULTI-CLIENTE (Supabase) — construído nesta sessão
- **Passo 1 ✓** — Supabase Auth (login/senha): overlay de login, botão "Sair", sessão
  persistente, `onAuthStateChange`. `config.js` na raiz (frontend, PÚBLICO: `SUPABASE_URL` +
  publishable key `sb_publishable_…`) — DEVE ser commitado (Vercel publica do git; é público).
  Site URL do Supabase Auth = `https://agente-ia-teste-roan.vercel.app` (corrigido; antes
  apontava localhost). Confirmação por e-mail funcionando. VALIDADO no Vercel.
- **Passo 2 ✓** — Gatilho `on_auth_user_created` → `handle_new_user()` cria registro em
  `clientes` (status=trial, role=cliente) ao cadastrar; backfill feito pros usuários de teste.
  Frontend lê o cliente ao logar (`window.clienteAtivo`) e mostra e-mail + status no cabeçalho.
  VALIDADO.
- **Passo 3 ✓ — CONCLUÍDO (sessão 05/06):**
  - 3a ✓ — `SUPABASE_URL` e `SUPABASE_SECRET_KEY` cadastradas na Vercel.
  - 3b ✓ — `meta_config` dos clientes de teste apontando pra `act_908604161717895` /
    `949892491548927`.
  - 3c ✓ **VALIDADO** — helper `lib/meta-config.js` (na RAIZ, fora de `api/`): lê token Bearer
    → `user.id` (Supabase Auth) → `clientes.id` → `meta_config`. FALLBACK pro env em qualquer
    falha. Log da Vercel confirma `[meta-config] fonte: db` em `/api/listar-campanhas`.
    Causa do erro anterior: `SUPABASE_URL` errada na Vercel (corrigida); env nova só vale após
    redeploy. Rotação da secret: nova `sb_secret_` criada, atualizada na Vercel, redeploy,
    `fonte: db` validado, secret antiga (vazada) REVOGADA.
  - **Replicação getMetaConfig em todos os endpoints (sessão 05/06) ✓:**
    - `listar-campanhas`: `getMetaConfig` (ACT) — validado (fonte: db).
    - `insights-campanhas`: `getMetaConfig` (ACT) — **VALIDADO** (fonte: db, 200 OK).
    - `insights-anuncios`: SÓ header Authorization no frontend (opera só por ID; helper = código morto).
    - `campanha-acao`: só header no frontend (opera só por ID).
    - `escalar-campanha`: só header no frontend (opera só por ID).
    - `anuncio-acao`: só header no frontend (opera só por ID; 1 fetch).
    - `criar-campanha`: `getMetaConfig` (ACT + PAGE_ID) + Authorization nos 2 fetches (linha 1255:
      `getSession()` encadeado na frente da cadeia `.then()`, sem mudar assinatura; linha 1453:
      `async/await`). `META_WHATSAPP_NUMBER` continua do env. Commitado e deployado —
      **⚠ PENDENTE DE VALIDAÇÃO AO VIVO** (faltam os dois testes de criação).

### Ciclo completo do gestor (funcionando)
criar (imagem+vídeo) → analisar → comparar criativos → excluir o perdedor → escalar o campeão.

---

## BANCO (Supabase)
- Projeto ref: `hboghsnggybnwvunnqju` → `SUPABASE_URL = https://hboghsnggybnwvunnqju.supabase.co`
- Tabela `clientes`: id (uuid), auth_user_id (uuid, unique → auth.users), nome_empresa,
  status (trial|ativo|suspenso, default trial), role (cliente|admin, default cliente), created_at.
- Tabela `meta_config`: id, cliente_id (→ clientes), meta_ad_account_id, meta_page_id,
  meta_business_id, conectado_em, ativo. **(meta_config NÃO tem auth_user_id — liga ao cliente
  por cliente_id; o auth_user_id está em `clientes`.)**
- RLS ligado: cada cliente vê/edita só o seu (SELECT/UPDATE por auth_user_id = auth.uid());
  o acesso de admin/agência é feito no backend com a SECRET key (passa por cima do RLS).
- Gatilho `on_auth_user_created` cria o `clientes` no cadastro.
- Chaves novas do Supabase (legadas anon/service_role saem no fim de 2026):
  publishable (`sb_publishable_…`, frontend, no config.js) + secret (`sb_secret_…`, backend, na
  Vercel como `SUPABASE_SECRET_KEY`). Secret rotacionada em 05/06 — segurança fechada.
- Dica: o painel do Supabase quebra com o tradutor do Chrome ligado — manter em inglês.

---

## DECISÕES DE ARQUITETURA / NEGÓCIO
- Duas camadas: **identidade** (login/senha próprio + banco — controla pagamento, histórico,
  guarda-chuva) separada do **acesso ao Meta** (conexão por cliente).
- Acesso ao Meta = modelo **agência/system-user**: a agência configura uma vez na conta do
  cliente (parceria na Business Manager); token de system user (NÃO expira) fica no env; per-cliente
  o banco guarda só os IDs (conta/página). Não usar OAuth do cliente (token de 60 dias expira).
- Não existe integração "silenciosa": o cliente sempre autoriza 1 vez (regra do Meta).
- CRIADOR fica simples (WhatsApp/site). Criação de venda/pixel = futuro, COM guarda-corpos
  (campanha de compra precisa de ~50 conv/semana pra sair do aprendizado; pixel depende de
  config externa do cliente).
- Serviço PRO/agência (arte/criativo, criação de página, assistência) = trabalho da agência,
  NÃO feature do app.
- Princípio de migração: **fallback pro env var** — o caminho novo (banco) só ativa quando há
  config do cliente; senão usa o env. Assim nada quebra durante a virada multi-cliente.

---

## ENV VARS
- Vercel (backend): META_ACCESS_TOKEN, META_AD_ACCOUNT_ID (act_908604161717895),
  META_PAGE_ID (949892491548927), META_WHATSAPP_NUMBER (5517991414397), BLOB_*,
  SUPABASE_URL, SUPABASE_SECRET_KEY.
- Frontend (config.js, público): SUPABASE_URL + publishable key.
- Meta: App "analista de ads" (App ID 1720446445748871), token de 60 dias (migrar p/ system user).

## ENDPOINTS (api/) + helper
criar-campanha ✓, blob-upload, video-start, video-status, blob-delete,
listar-campanhas ✓, campanha-acao ✓, escalar-campanha ✓,
insights-campanhas ✓, insights-anuncios ✓, anuncio-acao ✓. + `lib/meta-config.js` (helper, raiz).
(✓ = Authorization header no frontend; endpoints com conta/página também usam `getMetaConfig`.)

---

## PENDÊNCIAS / PRÓXIMOS (em ordem)
1. **⚠ VALIDAR criar-campanha ao vivo (PRIMEIRA coisa)**: criar 1 campanha de IMAGEM (fluxo
   `.then`, linha 1255) e 1 de VÍDEO (fluxo async/await + blob, linha 1453). Conferir em cada:
   campanha criada e PAUSADA, `[meta-config] fonte: db` no log de `/api/criar-campanha`,
   conta/página corretas.
2. **Passo 4 — trava de status no backend**: bloquear endpoints quando `status != 'ativo'`.
   Infra pronta (todos os endpoints já mandam Bearer). Começar manual (Daniel liga/desliga
   o status na mão).
3. **Onboarding por cliente**: botão "Conectar Meta" / nome_empresa.
4. **Papel admin/agência**.
5. **DÍVIDA TÉCNICA**: trocar `url.parse()` legado por `new URL()` (WHATWG) — warning DEP0169
   no insights-campanhas (e talvez outros). Passe de limpeza dedicada.
6. **SCHEMA FUTURO**: adicionar coluna de whatsapp no `meta_config` + helper devolver, pra
   WhatsApp por cliente (hoje o número é global, vem do env).
7. **Meta App Review + Business Verification** (Advanced Access a ads_management).
8. Relatório semanal consolidado; próximos agentes (atendimento/vendas WhatsApp; follow-up
   de quem não comprou).

## APRENDIZADOS / GOTCHAS
- `actionValue` usa `===` exato (não soma variantes de compra duplicadas).
- Helper de backend fora de `api/` (senão a Vercel cria uma rota inútil).
- Em static frontend sem bundler, `.env` NÃO funciona no navegador; chaves públicas vão no
  config.js (commitado). Secret só no backend (Vercel).
- Supabase: chaves novas publishable/secret; Site URL deve ser o domínio do Vercel; painel
  quebra com tradutor do Chrome.
- Variável de ambiente nova na Vercel só vale após Redeploy.
- **Padrão getMetaConfig**: endpoints que usam conta/página → `getMetaConfig` (com fallback env
  no helper); endpoints que operam só por ID → só o header Bearer no frontend (helper seria
  código morto), como preparação pra trava de status (#4).
- **Fetch POST com Authorization**: mesclar via `Object.assign({'Content-Type':'application/json'},
  _ses ? {'Authorization':'Bearer '+_ses.access_token} : {})` para preservar Content-Type.
  Fetch em cadeia `.then()` que não pode usar `await`: encadear `getSession()` na frente
  (`supabase.auth.getSession().then(({data:{session:_ses}}) => fetch(...))`) sem mudar assinatura
  da função envolvente.
- **Erro "Unexpected token '<', <!DOCTYPE ... not valid JSON"** = fetch recebeu HTML =
  `SUPABASE_URL` errada/ausente OU chave errada no `SUPABASE_SECRET_KEY`. Se for a publishable
  no lugar da secret: conexão funciona mas RLS não é ignorado → consulta volta vazia →
  "cliente não encontrado".
- Logs da Vercel só mostram invocação ao vivo: acionar a function enquanto observa.
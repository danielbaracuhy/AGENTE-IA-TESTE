# Resumo do Projeto — AGENTE-IA-TESTE (atualizado 09/06/2026)

## Visão geral
App de gestão de tráfego com IA para PMEs (marca: Digitalizando Negócios). Cria campanhas no
Meta Ads, acompanha ao vivo, escala e analisa criativos. Objetivo: vender pra várias empresas.
Caso de teste: infoproduto próprio (óleo de fritura usado — Hotmart, R$597).

## Modo de trabalho
Claude Code ("Cláudio") = EXECUTOR; Daniel e Claude = PENSADORES. Daniel decide o rumo, Claude
desenha, e todo pedido de execução sai como prompt pronto pra colar — nunca passo a passo manual.
Uma mudança por vez, revisar diff antes do commit, nunca auto-commitar sem aprovação. Direto, sem
bajulação. Daniel se comunica muito por screenshots.
DISCIPLINA (reforçada nesta sessão): diagnosticar antes de corrigir; quando o executor propõe um
fix, conferir se ele bate com o SINTOMA real antes de aplicar (um fix de "contador de geração" foi
proposto e REJEITADO por resolver um problema que não era o observado).

## Onde fica (IMPORTANTE — caminho corrigido)
- Repo: `C:\Users\NetSolutions\Desktop\EMPRESA AGENCIA 2026\PASTA AGENTES DE IA\AGENTE-IA-TESTE`
  (CAMINHO MUDOU — agora dentro de "EMPRESA AGENCIA 2026").
- GitHub: danielbaracuhy/AGENTE-IA-TESTE · branch master · Site: agente-ia-teste-roan.vercel.app
- Deploy: editar → git add/commit → git push origin master → a Vercel publica sozinha.
- NÃO confundir com a pasta "AGENTE ANALISE ADS".
- A raiz serve `index.html`.
- HEAD atual em master: `b38ce5b` (refactor: consolida endpoints admin em api/admin.js).

## Stack
HTML/CSS/JS puro (sem bundler), ESM via CDN; serverless Vercel (Node 18+, fetch nativo);
Vercel Blob (vídeo); Graph API v25.0 em todos os endpoints; orçamento CBO no nível da campanha.
Banco: Supabase (Postgres + Auth). Frontend importa supabase-js via esm.sh.

---

## O QUE ESTÁ PRONTO E VALIDADO

### 1. CRIADOR
Campanha (CBO) → conjunto (WhatsApp/site) → criativo(s) → anúncio(s). Multi-criativo (imagem +
vídeo competindo). Vídeo via Blob. Simples de propósito (sem pixel/venda). Multi-cliente VALIDADO
(`getMetaConfig`, fonte: db).

### 2. MINHAS CAMPANHAS
Lista ao vivo; Ativar/Pausar (cascata); Excluir; ESCALAR (+20%/+50%/personalizado; CBO vs ABO).

- Status honesto — `estadoDaCampanha(c)` lidera pelo status CONFIGURADO. Árvore de 5 (1ª que bate
  vence): (1) anúncio DISAPPROVED/WITH_ISSUES → "Reprovada"; (2) `c.status != ACTIVE` → "Pausada";
  (3) ligada + PENDING_REVIEW/IN_PROCESS/PREAPPROVED/PENDING_BILLING_INFO → "Em análise";
  (4) ligada + ACTIVE → "No ar"; (5) fallback → "Pausada". Multi-anúncio: DISAPPROVED >
  PENDING_REVIEW > ACTIVE. VALIDADO.
- Estado "Reprovada" — `listar-campanhas` busca ads.limit(10){effective_status,ad_review_feedback,
  creative{thumbnail_url,image_url}}; `agregateAds()` ordena por prioridade e extrai
  `motivo_reprovacao` achatando global + placement_specific com Object.values (join '\n', null no
  fallback).
- Modal de confirmação de orçamento ao Ativar — daily/lifetime (centavos /100 no backend), BRL.
  VALIDADO.
- Fix start_time — `activateAdset` tenta {status:ACTIVE, start_time:now}; se o Meta recusar (adset
  já iniciado) refaz só com status:ACTIVE; propaga erro real se o retry falhar. VALIDADO.
- Miniaturas do criativo nos cards (até 2). VALIDADO.
- Analisar POR CAMPANHA — VALIDADO AO VIVO (09/06): botão "Analisar" no card abre o analisador
  escopado na campanha (header "Analisando: X", criativos só dela); botão global continua mostrando
  tudo.
- AUTO-REFRESH (LEVA 2b) — APLICADO E VALIDADO EM PRODUÇÃO (09/06): enquanto houver campanha "Em
  análise", recarrega a lista a cada 45s. UM timer só (`setTimeout`, NÃO setInterval; clearTimeout
  antes de reagendar). `_agendarAutoRefresh()` é chamado no FIM do render (carregarCampanhas) — é
  isso que rearma o ciclo a cada renderização. Pausa com aba oculta (document.hidden → clearTimeout)
  e faz refresh imediato ao voltar o foco (visibilitychange). Listener uma vez só
  (`_autoRefreshBound`). Guarda de modal: não busca com modal-ativar/modal-escalar/modalCampanha
  abertos (detecta por el.style.display!=='none', com null-guard `el&&`). Selo "ao vivo"
  (`camps-refresh-hint`) ligado ao `_temEmAnalise()`. VALIDADO: campanha ativada ficou "Em análise"
  e virou "No ar" sozinha em ~2,5 min.
- ATUALIZAÇÃO OTIMISTA AO ATIVAR — APLICADO E VALIDADO (09/06): depois do 200 da ativação, NÃO
  chama carregarCampanhas() imediato (correria com a propagação do Meta e pegaria PAUSED). Renderiza
  local marcando {status:'ACTIVE', effective_status:'PENDING_REVIEW'} → card vira "Em análise" na
  hora → _temEmAnalise()=true → auto-refresh agenda → 45s depois busca o status real. Pausar/excluir
  seguem com carregarCampanhas()/row.remove(). Corrigiu o bug da tela "resetar pro estado inicial"
  pós-ativação.

### 3. TRAVA DE STATUS (backend) — APLICADO E VALIDADO (09/06)
Helper `lib/verificar-status.js` (na RAIZ, mesmo padrão do meta-config) → verificarStatus(req)
retorna {permitido, status, fonte, motivo}:
- Sem Authorization → {permitido:true, fonte:'env'} (agência).
- Erro de infra no Supabase → {permitido:true, fonte:'fallback'} + warn (não trava por infra).
- Token válido sem cliente → {permitido:true, fonte:'fallback'}.
- Cliente ativo/trial → permitido (fonte:db).
- Suspenso/outro → {permitido:false, motivo:'Conta suspensa. Regularize para criar ou alterar
  campanhas.'}.
Plugado SÓ nos 4 endpoints de ESCRITA (criar-campanha, campanha-acao, escalar-campanha,
anuncio-acao), depois do método HTTP e antes de qualquer chamada ao Meta. Leitura (listar/insights)
e vídeo/blob ficam liberados. VALIDADO nos dois caminhos: suspenso → 403 nos logs da Vercel
([verificar-status] fonte: db status: suspenso); trial → 200.
Mensagem no frontend: os handlers de escrita leem `data.erro || data.error` antes do genérico, então
o 403 mostra "Conta suspensa..." (antes mostrava "resposta inesperada"). VALIDADO.

### 4. ANALISADOR — LEITOR UNIVERSAL DE CONVERSÃO (validado)
detectarConversao(actions) por prioridade: purchase → fb_pixel_purchase → lead → fb_pixel_lead →
lead_grouped → conversa → landing_page_view → fallback. actionValue usa === exato (não soma
duplicatas). Rótulo segue o que foi contado. VALIDADO com dados reais. CSV = código morto (a remover).

### 5. LOGIN / MULTI-CLIENTE (Supabase)
Passos 1–3 concluídos: Auth (login/senha, overlay, sessão persistente), gatilho on_auth_user_created
cria clientes (trial/cliente), getMetaConfig (Bearer → user.id → clientes.id → meta_config) com
fallback env. config.js na raiz (público, publishable key). Secret rotacionada. VALIDADO.

### Ciclo completo do gestor (funcionando)
criar (imagem+vídeo) → analisar → comparar criativos → excluir o perdedor → escalar o campeão; a
lista se atualiza sozinha enquanto há campanha em análise; contas suspensas são barradas na escrita.

---

## BANCO (Supabase)
- Projeto ref: hboghsnggybnwvunnqju → SUPABASE_URL = https://hboghsnggybnwvunnqju.supabase.co
- Tabela clientes: id (uuid), auth_user_id (uuid, unique → auth.users), nome_empresa,
  status (trial|ativo|suspenso, default trial), role (cliente|admin, default cliente), created_at.
- Tabela meta_config: id, cliente_id (→ clientes), meta_ad_account_id, meta_page_id,
  meta_business_id, conectado_em, ativo. (meta_config NÃO tem auth_user_id — liga por cliente_id.)
- RLS ligado: cada cliente vê/edita só o seu (por auth_user_id = auth.uid()); admin/agência opera no
  backend com a SECRET key (passa por cima do RLS).
- Gatilho on_auth_user_created cria o clientes no cadastro.
- Chaves novas: publishable (sb_publishable_…, frontend, no config.js) + secret (sb_secret_…,
  backend, na Vercel como SUPABASE_SECRET_KEY). Secret já rotacionada.
- Dica: o painel do Supabase quebra com o tradutor do Chrome — manter em inglês.

## DECISÕES DE ARQUITETURA / NEGÓCIO
- Duas camadas: identidade (login/senha + banco) separada do acesso ao Meta (por cliente).
- Acesso ao Meta = modelo agência/system-user: token de system user (NÃO expira) no env; por cliente
  o banco guarda só os IDs (conta/página). OAuth do cliente rejeitado (token de 60 dias expira).
- CRIADOR simples (WhatsApp/site). Venda/pixel = futuro, com guarda-corpos.
- Serviço PRO/agência (arte, página, assistência) = trabalho da agência, não feature do app.
- Migração com fallback pro env: o caminho novo (banco) só ativa quando há config do cliente.

## ENV VARS
- Vercel (backend): META_ACCESS_TOKEN, META_AD_ACCOUNT_ID (act_908604161717895),
  META_PAGE_ID (949892491548927), META_WHATSAPP_NUMBER (5517991414397), BLOB_*,
  SUPABASE_URL, SUPABASE_SECRET_KEY.
- Frontend (config.js, público): SUPABASE_URL + publishable key.
- Meta: App "analista de ads" (App ID 1720446445748871), token de 60 dias (migrar p/ system user).

## ENDPOINTS (api/) + helpers
criar-campanha, blob-upload, video-start, video-status, blob-delete, listar-campanhas,
campanha-acao, escalar-campanha, insights-campanhas, insights-anuncios, anuncio-acao.
Helpers na RAIZ: lib/meta-config.js, lib/verificar-status.js.
Trava de status (verificarStatus): criar-campanha, campanha-acao, escalar-campanha, anuncio-acao.
listar-campanhas traz: status configurado + effective_status agregado + motivo_reprovacao +
thumbnails + daily/lifetime budget. campanha-acao usa activateAdset (start_time best-effort).

## PENDÊNCIAS / PRÓXIMOS (em ordem)
1. ~~Limpeza concluída (09/06): código morto CSV removido (commit bf39693);
   url.parse() já estava substituído por new URL() em commit anterior.~~
2. ~~2a concluída (10/06): coluna whatsapp em meta_config; getMetaConfig expõe whatsapp;
   criar-campanha usa número do cliente com fallback env (commits b7a4937, 5a8a9c9).~~
   ~~2b concluída (10/06): painel admin em /admin.html — lista clientes, ativar/suspender,
   config Meta por cliente; endpoints consolidados em api/admin.js (limite Vercel Hobby).
   Commits eb760e6→b38ce5b.~~
   2c pendente: onboarding por cliente.
3. Meta App Review + Business Verification — EM ANDAMENTO (09/06):
   ✅ Business Verification enviada (aguardando aprovação do Meta)
   ✅ privacidade.html publicada (agente-ia-teste-roan.vercel.app/privacidade.html)
   ✅ exclusao-dados.html publicada (agente-ia-teste-roan.vercel.app/exclusao-dados.html)
   ⏳ Falta: conta de teste, screencast do fluxo, justificativa por permissão, submissão.
4. Relatório semanal consolidado.
5. Próximos agentes: atendimento/vendas WhatsApp; follow-up de quem não comprou.
(Opcional, só se aparecer: contador de geração no carregarCampanhas pra blindar contra um fetch em
andamento sobrescrever o update otimista — NÃO é problema observado; aplicar só se algum dia o card
piscar de "Em análise" pra "Pausada" sozinho.)

## APRENDIZADOS / GOTCHAS
- Auto-refresh = setTimeout (one-shot), não setInterval. O ciclo só se renova porque
  _agendarAutoRefresh() é chamado no FIM do render. Cancela com a aba oculta e retoma no foco; quem
  sai da aba e recarrega (em vez de voltar pra aba) não vê o resume.
- "Em análise" → "No ar" depende da revisão do Facebook, que leva MAIS que 45s (minutos a horas).
  Auto-refresh funcionando mantém "Em análise" até o FB aprovar; NÃO é bug.
- Atualização otimista ao ativar evita a corrida com a propagação do Meta. estadoDaCampanha precisa
  de status:'ACTIVE' (pra não cair em Pausada) E effective_status:'PENDING_REVIEW' (pra acertar Em
  análise). renderCampanhas(camps) atualiza _ultimasCampanhas=camps na 1ª linha, então o
  _agendarAutoRefresh no fim lê a global já otimista.
- Erros de escrita no frontend: ler data.erro || data.error (chaves não são uniformes entre
  endpoints). 403 de conta suspensa usa a chave error.
- Console.log do navegador NÃO aparece nos logs da Vercel (esses são só do servidor /api). Logs de
  cliente vão no DevTools (F12) da própria página.
- Diagnosticar antes de corrigir; conferir o fix contra o SINTOMA. Um fix pode estar tecnicamente
  certo e ainda resolver o problema errado.
- actionValue usa === exato (não soma variantes de compra duplicadas).
- Helper de backend fora de api/ (senão a Vercel cria rota inútil).
- Static frontend sem bundler: .env não funciona no navegador; chaves públicas no config.js
  (commitado). Secret só no backend (Vercel).
- Supabase: Site URL = domínio do Vercel; painel quebra com tradutor do Chrome.
- Variável de ambiente nova na Vercel só vale após Redeploy.
- Padrão getMetaConfig: endpoints com conta/página → getMetaConfig (fallback env); endpoints que
  operam só por ID → só o header Bearer no frontend.
- "Unexpected token '<', <!DOCTYPE..." = fetch recebeu HTML = SUPABASE_URL errada/ausente OU chave
  errada. Publishable no lugar da secret: conecta mas não ignora RLS → consulta vazia.
- Status do card lidera pelo CONFIGURADO (on/off); revisão vem do effective_status do anúncio.
- ad_review_feedback é objeto aninhado (global + placement_specific) — achatar com Object.values.
- Orçamento do Meta vem em CENTAVOS (string) → /100 + BRL, uma vez só no backend.
- start_time não é editável em adset já iniciado → ativação best-effort (tenta com, retry sem).
- DEP0169 (url.parse): já estava corrigido antes do resumo registrar — grep confirmou new URL()
  nos dois únicos endpoints que leem query params (insights-campanhas, insights-anuncios). Ao
  registrar pendências técnicas, verificar no código antes de assumir que ainda existe.
- App Review do Meta: Business Verification (CNPJ) é só um portão de confiança — não dá acesso a
  contas de clientes sozinho. O que libera operar em produção é o Advanced Access ao
  ads_management, via App Review separado. Páginas de privacidade e exclusão de dados são
  pré-requisitos obrigatórios.

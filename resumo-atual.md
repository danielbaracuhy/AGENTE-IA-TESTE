# Resumo do Projeto — AGENTE-IA-TESTE / VendeMais Ads (atualizado 12/06/2026)

## Visão geral
App de gestão de tráfego com IA para PMEs. Marca: **VendeMais Ads** (renomeado de "Meta Ads Analytics" em 12/06).
Tagline: "Marketing Digital para Pequenas Empresas".
Caso de teste: infoproduto próprio (óleo de fritura usado — Hotmart, R$597).
Objetivo: vender para várias empresas como SaaS white-label.

## Identidade visual
- Nome: VendeMais Ads
- Paleta: laranja #FF6B00 (accent/CTA) + azul escuro #1B3A6B (accent2/header)
- Logo: assets/logo-vendemais.png (PNG transparente no repo)
- Logo grande centralizada na tela principal (200px) + logo+nome no header
- Mascote/comunicação: personagem com megafone para redes sociais (não é a logo principal)

## Modo de trabalho
Claude Code ("Cláudio") = EXECUTOR; Daniel e Claude = PENSADORES. Daniel decide o rumo, Claude
desenha, e todo pedido de execução sai como prompt pronto pra colar — nunca passo a passo manual.
Uma mudança por vez, revisar diff antes do commit, nunca auto-commitar sem aprovação. Direto, sem
bajulação. Daniel se comunica muito por screenshots.
DISCIPLINA: diagnosticar antes de corrigir; quando o executor propõe um fix, conferir se ele bate
com o SINTOMA real antes de aplicar.

## Onde fica
- Repo: `C:\Users\NetSolutions\Desktop\EMPRESA AGENCIA 2026\PASTA AGENTES DE IA\AGENTE-IA-TESTE`
- GitHub: danielbaracuhy/AGENTE-IA-TESTE · branch master · Site: agente-ia-teste-roan.vercel.app
- Deploy: editar → git add/commit → git push origin master → Vercel publica sozinha.
- NÃO confundir com a pasta "AGENTE ANALISE ADS".
- HEAD atual em master: `926e2a6` (última sessão — paleta + logo + renomeação)

## Stack
HTML/CSS/JS puro (sem bundler), ESM via CDN; serverless Vercel (Node 18+, fetch nativo);
Vercel Blob (vídeo); Graph API v25.0; orçamento CBO no nível da campanha.
Banco: Supabase (Postgres + Auth). Frontend importa supabase-js via esm.sh.

---

## O QUE ESTÁ PRONTO E VALIDADO

### 1. CRIADOR
Campanha (CBO) → conjunto (WhatsApp/site) → criativo(s) → anúncio(s). Multi-criativo (imagem +
vídeo competindo). Vídeo via Blob. Multi-cliente VALIDADO.

### 2. MINHAS CAMPANHAS
Lista ao vivo; Ativar/Pausar (cascata); Excluir; Escalar (+20%/+50%/personalizado; CBO vs ABO).
Status honesto, modal de confirmação de orçamento, miniaturas, auto-refresh (45s enquanto "Em análise"),
atualização otimista ao ativar. VALIDADO.

### 3. TRAVA DE STATUS (backend)
Helper lib/verificar-status.js. Plugado nos 4 endpoints de escrita. Fail-open para infra. VALIDADO.

### 4. ANALISADOR — LEITOR UNIVERSAL DE CONVERSÃO
detectarConversao(actions) por prioridade. VALIDADO com dados reais.

### 5. LOGIN / MULTI-CLIENTE (Supabase)
Auth (login/senha, overlay, sessão persistente), gatilho on_auth_user_created, getMetaConfig com
fallback env. VALIDADO.

### 6. SALDO PRÉ-PAGO META
Exibido no topo de Minhas Campanhas. Fail-silent. VALIDADO.

### 7. LEVA UI
Auto-load de campanhas, Criar Campanha como botão principal, header global com Sair + email,
logo como "voltar para home". VALIDADO.

### 8. RELATÓRIO SEMANAL
PDF dos últimos 7 dias. jsPDF + autotable. Melhor criativo da semana. VALIDADO.

### 9. SEGURANÇA MULTI-TENANT (CRÍTICO)
lib/verificar-ownership.js — cliente A não acessa campanha do cliente B. Bloqueio de cliente sem
meta_config próprio. VALIDADO.

### 10. PAINEL ADMIN
Lista clientes, email via Admin API, Config Meta (4 campos: ad_account, page, business, whatsapp),
ativar/suspender. VALIDADO.

### 11. IDENTIDADE VISUAL VendeMais Ads (12/06)
- Paleta laranja+azul escuro aplicada em index.html e admin.html
- Logo PNG transparente em assets/logo-vendemais.png
- Logo 200px centralizada na tela principal
- Header: logo pequena + "VendeMais Ads" em branco
- Modal Criar Campanha com cores atualizadas
- Título e footer renomeados para VendeMais Ads
- Pasta CAMPANHAS/ removida (artefato antigo)
- Botão Exportar PDF removido do header (código morto)

---

## BANCO (Supabase)
- Projeto ref: hboghsnggybnwvunnqju
- Tabela clientes: id, auth_user_id, nome_empresa, status (trial|ativo|suspenso), role, created_at
- Tabela meta_config: id, cliente_id, meta_ad_account_id, meta_page_id, meta_business_id, conectado_em, ativo
- RLS ligado. Admin opera com SECRET key.
- Chaves: publishable (frontend/config.js) + secret (Vercel/SUPABASE_SECRET_KEY)

## ONBOARDING DE CLIENTES
Fluxo: cadastro no app (trial) → agência coleta 4 IDs Meta do cliente → configura no /admin.html
→ ativa (trial→ativo). Documento: passa_a_passo_conectar_cliente.pdf (atualizar URL quando domínio mudar).
4 dados necessários por cliente:
- Ad Account ID: act_XXXXXXXXX (Gerenciador de Anúncios)
- Page ID: número da página do Facebook (Sobre → ID da Página)
- Business ID: business.facebook.com → Configurações → topo
- WhatsApp: número com DDI+DDD (ex: 5517991414397) — NÃO é um ID do Meta

## META APP REVIEW
- App "analista de ads" (ID: 1720446445748871) — status: Publicado
- ads_management: "Pronto para teste" (Standard Access)
- ads_read: "Pronto para teste" (Standard Access)
- Marketing API Access Tier: "Acesso limitado"
- Business Verification (CNPJ): já submetida, aguardando aprovação do Meta
- Para escala (clientes externos sem acesso admin): precisa Advanced Access via Tech Provider
- NÃO clicar em "Continue" no fluxo Tech Provider sem documentos em mãos — processo irreversível
- Verificar status da verificação em: business.facebook.com → Configurações → Verificação da empresa

## TOKEN META
- Token atual: 60 dias (ainda válido em 12/06/2026)
- PENDENTE: migrar para System User token (não expira)
- Verificar expiração: developers.facebook.com → Graph API Explorer → Debug token

## ENV VARS
- Vercel: META_ACCESS_TOKEN, META_AD_ACCOUNT_ID (act_908604161717895), META_PAGE_ID,
  META_WHATSAPP_NUMBER, BLOB_*, SUPABASE_URL, SUPABASE_SECRET_KEY
- Frontend (config.js): SUPABASE_URL + publishable key

## ENDPOINTS (api/) + helpers
criar-campanha, blob-upload, video-start, video-status, blob-delete, listar-campanhas,
campanha-acao, escalar-campanha, insights-campanhas, insights-anuncios, anuncio-acao.
Helpers na RAIZ: lib/meta-config.js, lib/verificar-status.js, lib/verificar-ownership.js.

## PENDÊNCIAS / PRÓXIMOS
- Migrar token Meta para System User (não expira)
- Verificar/aguardar Business Verification no Meta
- Configurar contas Meta dos clientes de teste via /admin.html (quando tiver os IDs)
- Definir e registrar domínio .com.br para VendeMais Ads
- Atualizar URL no documento passa_a_passo_conectar_cliente.pdf após migração de domínio
- Meta App Review: Advanced Access (aguarda Business Verification)

## APRENDIZADOS / GOTCHAS
- Auto-refresh = setTimeout (one-shot). Cancela com aba oculta, retoma no foco.
- Atualização otimista ao ativar evita corrida com propagação do Meta.
- Erros de escrita: ler data.erro || data.error (chaves não uniformes).
- Helper de backend fora de api/ (senão Vercel cria rota inútil).
- Variável de ambiente nova na Vercel só vale após Redeploy.
- Supabase secret key para RLS bypass (publishable falha silenciosamente).
- Meta retorna valores monetários em centavos — /100 uma vez só no backend.
- start_time não editável em adset já iniciado → retry sem start_time.
- ad_review_feedback é objeto aninhado — achatar com Object.values.
- Standard Access ("Pronto para teste") funciona só em contas onde o app tem acesso admin.
- WhatsApp no onboarding = número com DDI+DDD, não um ID do Meta.
- Commit = salva localmente no Git. Push = envia para GitHub. Vercel detecta o push e publica.

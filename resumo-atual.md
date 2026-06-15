# Resumo do Projeto — VendeMais Ads (atualizado 14/06/2026)

## Visão geral
App de gestão de tráfego com IA para PMEs. Marca: VendeMais Ads.
Tagline: "Marketing Digital para Pequenas Empresas".
URL produção: https://vendemaisads.vercel.app
Admin: https://vendemaisads.vercel.app/admin.html
GitHub: danielbaracuhy/AGENTE-IA-TESTE · branch master

## Identidade visual
- Nome: VendeMais Ads
- Paleta: laranja #FF6B00 (accent) + azul escuro #1B3A6B (accent2/header)
- Logo: assets/logo-vendemais.png (PNG transparente)
- Logo 200px centralizada na tela principal + logo+nome no header

## Modo de trabalho
Claude Code ("Cláudio") = EXECUTOR; Daniel e Claude = PENSADORES.
Prompts prontos para colar — nunca passo a passo manual.
Uma mudança por vez, diff antes do commit, sem auto-commit.

## Stack
HTML/CSS/JS puro, Vercel serverless (Node 18+, 12 funções, Hobby),
Vercel Blob (vídeo), Graph API v25.0, Supabase (Postgres + Auth + RLS).

## O QUE ESTÁ PRONTO E VALIDADO

### 1. CRIADOR
Campanha CBO → conjunto (WhatsApp/site) → criativo (imagem+vídeo) → anúncio.
Multi-criativo competindo. Multi-cliente validado.

### 2. MINHAS CAMPANHAS
Lista ao vivo, Ativar/Pausar (cascata), Excluir, Escalar.
Status honesto, auto-refresh 45s, atualização otimista, miniaturas.

### 3. TRAVA DE STATUS
lib/verificar-status.js nos 4 endpoints de escrita. Fail-open. Validado.

### 4. ANALISADOR + CAMADA COMPRA/ROAS (14/06)
detectarConversao(actions, actionValues) por prioridade.
insights-campanhas.js pede action_values à Graph API.
Entrega compras (nº de purchases) e receita (BRL real, sem divisão por 100).
Frontend exibe colunas Compras/Receita/ROAS na tabela do Analisador.
Card ROAS condicional nos KPIs (só aparece se compras>0 no período).
ROAS = receita/investido, 2 casas, sufixo "x". Exibe "—" para WhatsApp e compras=0.
Validado com dados reais: CAMP 01 OLEO USADO 13/05 → 4 compras, R$214,12, ROAS 0.33x.
Commits: 14b3c2b (backend), 82a4fcb (frontend), 5c4c342 (limpeza debug).

### 5. LOGIN / MULTI-CLIENTE
Supabase Auth, sessão persistente, getMetaConfig com fallback env.

### 6. SALDO PRÉ-PAGO META
Exibido no topo de Minhas Campanhas. Fail-silent.

### 7. LEVA UI
Auto-load campanhas, Criar Campanha como CTA principal, header global.

### 8. RELATÓRIO SEMANAL
PDF 7 dias, jsPDF + autotable, melhor criativo da semana.

### 9. SEGURANÇA MULTI-TENANT
lib/verificar-ownership.js — isolamento por conta Meta. Validado.

### 10. PAINEL ADMIN
vendemaisads.vercel.app/admin.html (com .html obrigatório).
Lista clientes, Config Meta (4 campos), ativar/suspender.
Rota /admin → /admin.html adicionada no vercel.json (commit 56ccd2a).

### 11. IDENTIDADE VISUAL
Paleta laranja+azul, logo centralizada, modal Criar Campanha atualizado.
Botão Exportar PDF removido, pasta CAMPANHAS/ removida.

### 12. TOKEN META — SYSTEM USER
System User: vendemaisads-systemuser (ID: 61590931914192)
Token não expira — ativo em produção via META_ACCESS_TOKEN.
Permissões: ads_management, ads_read, business_management.

## BANCO (Supabase)
Projeto: hboghsnggybnwvunnqju
Tabelas: clientes (id, auth_user_id, nome_empresa, status, role) +
meta_config (id, cliente_id, meta_ad_account_id, meta_page_id, meta_business_id, ativo)
Admin: iacomjesuss@gmail.com (role=admin, status=ativo)
Chaves: publishable (config.js) + secret (SUPABASE_SECRET_KEY na Vercel)

## ONBOARDING DE CLIENTES
1. Cliente cria conta no app (trial automático)
2. Agência coleta 4 IDs: Ad Account (act_X), Page ID, Business ID, WhatsApp (55DDNÚMERO)
3. Admin configura em /admin.html → Config Meta
4. Admin ativa o cliente (trial → ativo)
Documento: guia_ids_vendemais_ads.pdf

## META / APP REVIEW
App: analista de ads (ID: 1720446445748871) — Publicado
ads_management + ads_read: Standard Access (Pronto para teste)
Business Verification: submetida em 13/06, aguardando Meta
Advanced Access: pendente aprovação da Business Verification
System User token: não expira — elimina risco de expiração a cada 60 dias

## SUPABASE URL CONFIG
Site URL: https://vendemaisads.vercel.app
Redirect URLs: https://vendemaisads.vercel.app + https://vendemaisads.vercel.app/**

## PENDÊNCIAS
- Configurar IDs Meta dos clientes de teste no admin
- Aguardar Business Verification (Meta)
- Solicitar Advanced Access após verificação aprovada
- Registrar domínio vendemaisads.com.br (Registro.br, R$40/ano)
- Mudança 3 (opcional): adicionar action_values na query de insights-anuncios.js para compras/receita por anúncio
- Integração de pagamento (próxima fase): Stripe + Mercado Pago

## GATEWAY DE PAGAMENTO (próxima fase)
Stripe: recorrência mensal, melhor para SaaS
Mercado Pago: PIX nativo, alternativa brasileira
Fluxo futuro: pagamento → webhook → ativa cliente no Supabase automaticamente

## APRENDIZADOS
- /admin sem .html cai no SPA fallback → sempre usar /admin.html
- System User token não expira — substitui token de 60 dias
- Variável de ambiente na Vercel só vale após Redeploy
- Standard Access funciona só em contas onde o app tem acesso admin
- WhatsApp no onboarding = número com DDI+DDD, não ID do Meta
- action_values da Meta vem em BRL real (não centavos) — não dividir por 100
- purchase canonical é o action_type correto; Meta repete o valor em múltiplos tipos por deduplicação
- ROAS abaixo de 1x = dado real do pixel, não bug do app

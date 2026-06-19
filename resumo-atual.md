# Resumo do Projeto — VendeMais Ads (atualizado 19/06/2026)

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
- Ícone do app para Meta: 512x512px, fundo preto, gerado a partir do logo original

## Modo de trabalho
Claude Code ("Cláudio") = EXECUTOR; Daniel e Claude = PENSADORES.
Prompts prontos para colar — nunca passo a passo manual.
Uma mudança por vez, diff antes do commit, sem auto-commit.

## Stack
HTML/CSS/JS puro, Vercel serverless (Node 18+, 12 funções, Hobby),
Vercel Blob (vídeo E imagem), Graph API v25.0, Supabase (Postgres + Auth + RLS).

## O QUE ESTÁ PRONTO E VALIDADO

### 1. CRIADOR
Campanha CBO → conjunto (WhatsApp/site) → criativo (imagem+vídeo) → anúncio.
Multi-criativo competindo. Multi-cliente validado.
Seleção de gênero (Masculino/Feminino) por checkboxes no formulário. Ambos marcados = Meta segmenta todos. Commit ece8e26.
**Imagem agora trafega via Vercel Blob (mesmo padrão do vídeo)** — elimina limite de payload de 10MB. Backend aceita imagemUrl com fallback para imagemBase64 (retrocompat). Blob de imagem é limpo no finally.
**Vercel Blob allowedContentTypes ampliado** (commit 5b7cbce) para aceitar image/png, image/jpeg, image/jpg, image/webp, além dos 5 tipos de vídeo já existentes (9 tipos no total). Limite 200MB (frontend já bloqueia imagem em 10MB antes disso). Causa raiz de um 403 "Content type mismatch" descoberto em teste real — endpoint era restrito só a vídeo.
Erros de rede (413, etc.) tratados graciosamente no frontend com mensagem clara ao usuário em vez de erro técnico bruto.
**VALIDADO EM PRODUÇÃO com cliente real (David/Donna Lecka):** campanha criada com sucesso usando
imagem via Blob, ID 1202499006123005**06**, status PAUSADA conforme esperado.
**Botão "Ver Minhas Campanhas"** adicionado após sucesso na criação — fecha modal, recarrega a lista
(`carregarCampanhas()`) e faz scroll suave até #sec-campanhas. Some ao reabrir o modal (reset limpo).
Implementação sem `mostrarTela()` — app é single-page com modal, não SPA com rotas internas.

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

### 6. SALDO PRÉ-PAGO META — ⚠️ BUG CONHECIDO, NÃO CONFIAR NO VALOR EXIBIDO
Exibido no topo de Minhas Campanhas. Fail-silent.
**BUG:** campo `balance` da Graph API retorna valor incorreto para contas pré-pagas
(testado com conta real do David/Donna Lecka, act_1310149873622083: balance retornou "3"
centavos quando saldo real no Facebook era R$89,00, visto em Configurações > Cobrança e pagamentos).
Causa identificada via pesquisa: para contas pré-pagas, `balance` não é confiável — cálculo correto
é `spend_cap - amount_spent`. Já adicionados `spend_cap` e `amount_spent` ao log de debug
(commit b3a879d) em api/listar-campanhas.js, mas AINDA NÃO LIDO o resultado real — ficou pendente
porque sessão desviou para resolver bugs de criação de campanha (413, content-type). Tem
`console.log('DEBUG SALDO RAW...')` ativo em produção — remover depois de corrigir.
PRÓXIMO PASSO: pedir ao David (ou testar você mesmo) para recarregar Minhas Campanhas, ler logs
da Vercel com spend_cap/amount_spent, recalcular fórmula do saldo, remover debug log.

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
System User: vendemaisads-systemuser (ID: 61590931914192), portfólio "daniel" no Business Manager.
Token não expira — ativo em produção via META_ACCESS_TOKEN.
Permissões: ads_management, ads_read, business_management.

### 13. ROTA /privacidade
privacidade.html acessível em vendemaisads.vercel.app/privacidade.html.
Rota adicionada no vercel.json. Commit 1e7428d.
PENDENTE: logo no topo da página ainda mostra versão antiga — trocar pelo logo atual VendeMais Ads.

### 14. CONEXÃO DE CONTA DE ANÚNCIOS DE CLIENTE — PROCESSO VALIDADO
Fluxo correto descoberto e testado com sucesso (cliente David/Donna Lecka):
1. No Business Manager "daniel" → Contas → Contas de anúncios → "+ Adicionar"
2. Selecionar "Pedir acesso a uma conta de anúncios em outro portfólio empresarial"
   (NÃO usar "Criar nova" nem adicionar como Usuário do Sistema — isso NÃO funciona)
3. Colar o ID da conta do cliente (sem "act_")
4. Selecionar permissão "Gerenciar contas de anúncios" (Acesso total)
5. Cliente recebe notificação no Facebook e aprova
Esse processo é OBRIGATÓRIO e MANUAL para cada cliente novo — não há como herdar acesso entre
clientes, pois cada um tem conta de anúncios separada no Meta. As correções de código (itens 1, 6)
são permanentes e valem para todos os clientes automaticamente; só a conexão de conta é por-cliente.
Solução futura possível para escalar: ferramentas tipo Leadsie que automatizam pedido de acesso
via link único.

## BANCO (Supabase)
Projeto: hboghsnggybnwvunnqju
Tabelas: clientes (id, auth_user_id, nome_empresa, status, role) +
meta_config (id, cliente_id, meta_ad_account_id, meta_page_id, meta_business_id, ativo)
Admin: iacomjesuss@gmail.com (role=admin, status=ativo)
Chaves: publishable (config.js) + secret (SUPABASE_SECRET_KEY na Vercel)

## ONBOARDING DE CLIENTES
1. Cliente cria conta no app (trial automático)
2. Agência coleta 4 IDs: Ad Account (act_X), Page ID, Business ID, WhatsApp (55DDNÚMERO)
3. Agência solicita acesso à conta de anúncios do cliente no Business Manager (ver item 14) — cliente aprova
4. Admin configura em /admin.html → Config Meta
5. Admin ativa o cliente (trial → ativo)
Documento: guia_ids_vendemais_ads.pdf
Cliente de teste real: David (Donna Lecka), act_1310149873622083 — conectado, criou campanha com sucesso.

## META / APP REVIEW
App: analista de ads (ID: 1720446445748871) — Publicado
Business Verification: APROVADA em 09/06/2026 (DANIEL BARBOSA BARACUHY)
App Review iniciado em 16/06/2026 — EM PAUSA, retomar quando possível
Permissões submetidas para Advanced Access: ads_management, ads_read,
business_management, pages_show_list, pages_read_engagement, public_profile,
Marketing API Access Tier (este já preenchido e salvo)
Status: upload de screencast travando no portal Meta (erro genérico "ocorreu um problema"),
causa provável instabilidade do portal — NÃO é problema do nosso vídeo/arquivo.
Vídeo screencast já gravado e comprimido (1.5MB, MP4, h264) — pronto para tentar upload de novo.
Textos de descrição de uso já escritos para todas as 7 permissões (ver histórico de conversa).
Faltam preencher: "Tratamento de dados" e "Instruções da análise" no formulário.
**IMPORTANTE: app NÃO usa Login do Facebook tradicional — modelo é agência com System User
token operando contas via Business Manager. Login do cliente é via Supabase Auth (email/senha).
Avaliar se App Review nesse formato (pensado para apps com Login do Facebook) é mesmo necessário
para o nosso modelo, ou se o acesso via solicitação direta no Business Manager (item 14) já é
suficiente sem depender de Advanced Access — especialmente porque o fluxo do item 14 já está
validado e funcionando com cliente real, sem depender de Advanced Access.**
System User token: não expira — elimina risco de expiração a cada 60 dias

## SUPABASE URL CONFIG
Site URL: https://vendemaisads.vercel.app
Redirect URLs: https://vendemaisads.vercel.app + https://vendemaisads.vercel.app/**

## PENDÊNCIAS
- **PRIORITÁRIO:** Ler logs da Vercel (spend_cap/amount_spent) e corrigir cálculo do saldo pré-pago;
  remover console.log de debug em api/listar-campanhas.js depois
- Acompanhar com David se a campanha criada (ID 120249900612300506) roda bem ao ativar
- Decidir se vale continuar o App Review da Meta dado o modelo de negócio real do app (ver nota acima),
  ou se o acesso via Business Manager por solicitação já resolve sem Advanced Access
- Se decidir continuar App Review: retomar upload de screencast, preencher Tratamento de dados
  e Instruções da análise
- Corrigir logo na privacidade.html (ainda mostra logo antigo)
- Configurar IDs Meta de outros clientes de teste no admin
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
- Portal da Meta tem instabilidade no upload de vídeo — tentar em horários diferentes
- privacidade.html precisa de rota explícita no vercel.json (SPA fallback intercepta sem ela)
- **Limite de payload da Vercel (4.5MB default) afeta dados base64 no body — imagens devem usar
  Vercel Blob como vídeo, nunca base64 direto no payload**
- **Vercel Blob exige allowedContentTypes explícito por tipo MIME — endpoint criado só para vídeo
  rejeita imagem com 403 silenciosamente até investigar o Console do navegador (F12)**
- **Erro genérico no frontend tipo "Unexpected token... is not valid JSON" quase sempre significa
  que o backend/infra retornou HTML ou texto puro de erro em vez de JSON — sinal de checar Console (F12)**
- **Campo `balance` da Graph API NÃO é confiável para contas pré-pagas — usar spend_cap - amount_spent**
- **Para conectar conta de anúncios de cliente: usar "Pedir acesso a uma conta de anúncios em outro
  portfólio empresarial" — nunca adicionar como Usuário do Sistema com o ID do cliente (não funciona)**
- Conexão de conta de anúncios é processo manual obrigatório por cliente — não há herança entre clientes
- **App é single-page com modal, não SPA com rotas (não existe mostrarTela()) — navegação interna
  usa scrollIntoView + show/hide de elementos, não troca de "tela"**
- Botão de ação pós-sucesso deve sempre recarregar dados (carregarCampanhas()) antes de navegar,
  senão mostra lista em cache sem o item recém-criado

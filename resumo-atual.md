# Resumo do Projeto — AGENTE-IA-TESTE (atualizado 05/06/2026)

## Visão geral
App de gestão de tráfego com IA para PMEs (marca: Digitalizando Negócios). Funciona como um gestor
de tráfego dentro de um app: cria campanhas no Meta Ads, acompanha ao vivo, escala e analisa criativos.
Caso de teste: infoproduto próprio (óleo de fritura usado — Hotmart, R$597).

## Modo de trabalho
Claude Code é o EXECUTOR; Daniel e Claude são os PENSADORES. Daniel decide o rumo, Claude desenha a
solução, e todo pedido de execução sai como prompt pronto pra colar no Claude Code — nunca instrução
manual passo a passo. Comunicação direta, sem bajulação.

## Onde fica (IMPORTANTE)
- Pasta/repo CORRETO: C:\Users\NetSolutions\Desktop\PASTA AGENTES DE IA\AGENTE-IA-TESTE (repo git, publica na Vercel).
- GitHub: danielbaracuhy/AGENTE-IA-TESTE · Site: agente-ia-teste-roan.vercel.app · branch master.
- A pasta "AGENTE ANALISE ADS" NÃO é o dashboard. Não trabalhar nela.
- Deploy: editar → git add/commit → git push origin master → Vercel publica sozinha.

## Stack
HTML/CSS/JS puro (sem bundler); serverless Vercel; Vercel Blob (vídeo); Graph API v25.0 (mesma versão
em todos os endpoints); orçamento CBO no nível da campanha (centavos). Env: META_ACCESS_TOKEN,
META_AD_ACCOUNT_ID, META_PAGE_ID, BLOB_*.

## O que está pronto e validado
### 1. CRIADOR
- campanha (CBO) → conjunto (destino WhatsApp/site) → criativo(s) → anúncio(s).
- Multi-criativo: 1 imagem + 1 vídeo no mesmo conjunto (competem; mínimo 1). Laço sobre criativos[].
- Sem data de término (roda até pausar). Vídeo via Blob (upload→video-start→status→thumbnail).
  Slots de imagem/vídeo independentes (captura o File no onchange).

### 2. MINHAS CAMPANHAS
- Lista ao vivo; Ativar/Pausar (cascata, start_time=now); Excluir.
- ESCALAR orçamento: +20% (recomendado), +50% (aviso de reinício do aprendizado), valor personalizado.
  Detecta CBO vs ABO. (escalar-campanha.js)

### 3. ANALISADOR EM TEMPO REAL — LEITOR UNIVERSAL DE CONVERSÃO
- insights-campanhas.js: métricas ao vivo. Seletor de período (presets ou intervalo) + filtro por campanha.
- Métricas "no link" (inline_link_*); lp_views via landing_page_view.
- Front: analyzeFromAPI → buscarEAnalisar → processFromAPI ({periodo,camps,totals,alerts,recs,
  rotuloConvSub}) → render(). Loader com wording de tempo real (sem resquícios de CSV).
- detectarConversao(actions): escolhe a conversão por prioridade explícita, sem somar duplicatas
  (actionValue usa === exato):
    purchase → offsite_conversion.fb_pixel_purchase → lead → offsite_conversion.fb_pixel_lead
    → onsite_conversion.lead_grouped → conversa (regex /messaging_conversation_started/i)
    → landing_page_view → fallback (valor=0, sem rótulo).
  Lê objective da campanha via /campaigns só pra debug. Rótulo segue o que foi contado
  (subtexto: "compra" / "cadastro" / "conversa no WhatsApp" / "visita na página" / vazio).
  Card "Custo por conversão": mostra "sem dado de conversão" no fallback.
- VALIDADO com dados reais (05/06/2026):
    - Campanha venda/pixel Hotmart → "compra", CPP R$167,24 ✓
    - Campanha site → "visita na página", CPP R$0,44 ✓
    - Todas as campanhas (misto) → soma correta, subtexto vazio ✓
- COMPARAÇÃO DE CRIATIVOS: ao selecionar uma campanha, mostra um card por anúncio (miniatura +
  CTR/conv/CPP + "Melhor desempenho") e botão Excluir (com confirmação). VALIDADO com dados reais:
  Anúncio 2 (vídeo) CTR 3,72% / CPP R$0,95 venceu o Anúncio 1 (imagem) CTR 0,66% / CPP R$1,30.
  Badge segue rotuloChegada da API (ex.: "3 compras", "5 visitas"). (insights-anuncios.js, anuncio-acao.js)

### Ciclo completo do gestor (funcionando e validado)
criar (imagem+vídeo) → analisar → comparar criativos → excluir o perdedor → escalar o campeão.

## Endpoints (api/)
criar-campanha.js, blob-upload.js, video-start.js, video-status.js, blob-delete.js, listar-campanhas.js,
campanha-acao.js, escalar-campanha.js, insights-campanhas.js, insights-anuncios.js, anuncio-acao.js

## Aprendizados / decisões
- Estrutura: 1 campanha / 1 conjunto / 1-2 criativos (imagem + vídeo), CBO. Não usar campanhas
  separadas por criativo (fragmenta orçamento).
- CBO/ABO não é alavanca de alcance (vem de público amplo + orçamento + posicionamentos).
- Escala: ~20%/dia é o seguro; acima reinicia a fase de aprendizado.
- Conversão = o que a Meta reporta em actions[], escolhido por prioridade. O app NÃO soma variantes
  duplicadas e NÃO depende do objective para decidir — a decisão é sempre pelo array de actions.
- actionValue(actions, type) usa === exato: "purchase" não casa "omni_purchase" nem variantes pixel.

## Pendências / próximos (em ordem)
1. Polir card "Conv. Landing Page" — fica redundante para campanha de site (conversão = a própria
   visita, mostra ~100%); esconder ou renomear quando a conversão detectada for "visita".
2. Possível: comparação com período anterior.
3. Login + histórico por cliente.
4. Relatório semanal consolidado.
5. Próximos agentes: atendimento/vendas no WhatsApp; follow-up de quem não comprou.

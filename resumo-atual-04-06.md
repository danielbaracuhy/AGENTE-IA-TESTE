# Resumo do Projeto — AGENTE-IA-TESTE (atualizado 04/06/2026)

## Visão geral
App de gestão de tráfego com IA para PMEs (marca: Digitalizando Negócios). Funciona como um gestor
de tráfego dentro de um app: cria campanhas no Meta Ads, acompanha ao vivo, escala e analisa
criativos. Caso de teste: infoproduto próprio (Treinamento de Coleta de Óleo de Fritura — Hotmart, R$597).

## Onde fica (IMPORTANTE)
- Pasta/repo CORRETO: C:\Users\NetSolutions\Desktop\PASTA AGENTES DE IA\AGENTE-IA-TESTE (repo git, publica na Vercel).
- GitHub: danielbaracuhy/AGENTE-IA-TESTE · Site: agente-ia-teste-roan.vercel.app
- A pasta "AGENTE ANALISE ADS" NÃO é o dashboard (é outro projeto). NÃO trabalhar nela.
- Deploy: editar → git add/commit → git push origin master → Vercel publica sozinha.

## Stack
- HTML/CSS/JS puro (sem bundler); funções serverless na Vercel; Vercel Blob para vídeo.
- Graph API v25.0 (mesma versão em todos os endpoints).
- Orçamento CBO (Advantage Campaign Budget) no nível da campanha, em centavos.
- Env: META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_PAGE_ID, BLOB_*.

## O que está pronto e validado

### 1. CRIADOR de campanha
- Cria campanha (CBO, daily_budget) → conjunto (sem orçamento; destino WhatsApp/site no destination_type)
  → criativo(s) → anúncio(s).
- Multi-criativo: 1 imagem e/ou 1 vídeo no mesmo conjunto (competem entre si; mínimo 1). Backend faz
  laço sobre `criativos[]`.
- SEM data de término (end_time removido) — roda até o cliente pausar.
- Vídeo via pipeline Blob: blob-upload → video-start (advideos) → video-status (polling 'ready') → thumbnail.
- Slots de imagem e vídeo independentes: captura o File no onchange (_imgFile/_vidFile) — corrige o
  navegador limpar o FileList ao abrir o 2º seletor.

### 2. MINHAS CAMPANHAS
- Lista ao vivo; Ativar/Pausar (cascata, start_time=now); Excluir (DELETE no id).
- ESCALAR orçamento: +20% (recomendado), +50% (aviso de reinício do aprendizado), valor personalizado.
  Detecta CBO (campanha) vs ABO (conjunto) e atualiza o daily_budget. (escalar-campanha.js)

### 3. ANALISADOR EM TEMPO REAL (substituiu o upload de CSV)
- insights-campanhas.js: métricas ao vivo. Período por presets ou intervalo personalizado; filtro por
  campanha; retorna `campanhas` (campos internos iguais ao parser antigo) + `campanhasDisponiveis`.
- Métricas "no link" (inline_link_*); lp_views via ação landing_page_view; conversões pela lista de
  prioridade em `actions` (compra-pixel primeiro); cpp = investido/conversões.
- Front: analyzeFromAPI → buscarEAnalisar → processFromAPI (mesma saída {periodo, camps, totals,
  alerts, recs} do process antigo) → render(). Seletor de período + de campanha + Atualizar.
- COMPARAÇÃO DE CRIATIVOS: ao selecionar uma campanha específica, aparece a seção com um card por
  anúncio (miniatura + CTR/conversões/CPP + "Melhor desempenho") e botão Excluir (com confirmação
  mostrando os números). (insights-anuncios.js, anuncio-acao.js)

### Ciclo completo do gestor (funcionando)
criar (multi-criativo) → analisar (comparação por criativo) → excluir o perdedor → escalar o campeão.

## Endpoints (api/)
criar-campanha.js, blob-upload.js, video-start.js, video-status.js, blob-delete.js,
listar-campanhas.js, campanha-acao.js, escalar-campanha.js,
insights-campanhas.js, insights-anuncios.js, anuncio-acao.js

## Aprendizados / decisões
- Estrutura: 1 campanha / 1 conjunto / 1-2 criativos (imagem + vídeo), CBO. NÃO usar campanhas
  separadas por criativo (fragmenta orçamento). Multi-vídeo adiado (pipeline Blob pesa ×N).
- CBO/ABO não é a alavanca de alcance — alcance vem de público amplo + orçamento + posicionamentos.
- Escala: ~20%/dia é o seguro; acima disso reinicia a fase de aprendizado.
- "Resultados" = evento de otimização; no óleo é compra-pixel (offsite_conversion.fb_pixel_purchase).

## Pendências / próximos
- Validar a comparação de criativos quando a campanha de teste acumular entrega (ativar + esperar +
  período amplo, ex.: Últimos 7 dias).
- Cosmético: textos do loader ainda dizem "Lendo arquivo CSV" — trocar para algo de tempo real.
- Possível: comparação com período anterior.
- Login + histórico por cliente.
- Relatório semanal consolidado.
- Próximos agentes: atendimento/vendas no WhatsApp; follow-up de quem não comprou.

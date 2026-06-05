# Resumo do Projeto — AGENTE-IA-TESTE (atualizado 04/06/2026)

## Visão geral
App de gestão de tráfego com IA para PMEs (marca: Digitalizando Negócios). Funciona como um gestor
de tráfego dentro de um app: cria campanhas no Meta Ads, acompanha ao vivo, escala e analisa criativos.
Caso de teste: infoproduto próprio (óleo de fritura usado — Hotmart, R$597).

## Modo de trabalho
Daniel pensa, Claude Code executa. Os prompts vêm prontos pra colar. Comunicação direta, sem bajulação.

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

### 3. ANALISADOR EM TEMPO REAL (substituiu o CSV)
- insights-campanhas.js: métricas ao vivo. Seletor de período (presets ou intervalo) + filtro por campanha.
- Métricas "no link" (inline_link_*); lp_views via landing_page_view.
- Front: analyzeFromAPI → buscarEAnalisar → processFromAPI ({periodo,camps,totals,alerts,recs}) → render().
- COMPARAÇÃO DE CRIATIVOS: ao selecionar uma campanha, mostra um card por anúncio (miniatura +
  CTR/conv/CPP + "Melhor desempenho") e botão Excluir (com confirmação). VALIDADO com dados reais:
  Anúncio 2 (vídeo) CTR 3,72% / CPP R$0,95 venceu o Anúncio 1 (imagem) CTR 0,66% / CPP R$1,30; o
  "Melhor desempenho" marcou o vídeo corretamente. (insights-anuncios.js, anuncio-acao.js)

### Ciclo completo do gestor (funcionando e validado)
criar (imagem+vídeo) → analisar → comparar criativos → excluir o perdedor → escalar o campeão.

## DECISÃO DESTA SESSÃO — medição simples por destino (SEM pixel/venda)
Campanhas simples: WhatsApp OU site. NÃO usamos conversão por venda (pixel no Hotmart). A métrica é
"quantos clientes joguei pra lá":
- CLIQUE (+ custo por clique / CPC) — sempre; é o card de cliques que já existe.
- CHEGADA (= a "conversão") + custo por conversão:
  - WhatsApp → conversa iniciada (messaging_conversation_started).
  - Site → visita na página (landing_page_view).
- O card "Custo por conversão" fica; só deixa de dizer "compra/pixel de compra". Subtexto dinâmico:
  "conversa no WhatsApp" / "visita na página".

## EM ANDAMENTO — rótulo dinâmico (PROMPT ENTREGUE, AINDA NÃO APLICADO/VALIDADO)
PRÓXIMO PASSO AO REABRIR: rodar no Claude Code o prompt do rótulo dinâmico e validar. O que ele faz:
- insights-campanhas.js: detectarDestino() + contarChegada(); conversoes = chegada por destino;
  retorna destino + rotuloConvSub.
- insights-anuncios.js: mesma lógica por anúncio; retorna destino + rotuloChegada ("conversas"/"visitas").
- render() (só rótulos): subtexto "pixel de compra" → rotuloConvSub; "Custo por compra" → "Custo por
  conversão"; título do funil "...de Vendas" → "Funil Consolidado".
- renderCriativos(): "conv." → rotuloChegada.
- processFromAPI(): passa rotuloConvSub e destino adiante.
VALIDAR: campanha WhatsApp deve mostrar "Custo por conversão" + "conversa no WhatsApp"; campanha de
site deve mostrar "visita na página".

## Endpoints (api/)
criar-campanha.js, blob-upload.js, video-start.js, video-status.js, blob-delete.js, listar-campanhas.js,
campanha-acao.js, escalar-campanha.js, insights-campanhas.js, insights-anuncios.js, anuncio-acao.js

## Aprendizados / decisões
- Estrutura: 1 campanha / 1 conjunto / 1-2 criativos (imagem + vídeo), CBO. Não usar campanhas
  separadas por criativo (fragmenta orçamento).
- CBO/ABO não é alavanca de alcance (vem de público amplo + orçamento + posicionamentos).
- Escala: ~20%/dia é o seguro; acima reinicia a fase de aprendizado.
- Conversão depende do destino: WhatsApp = conversa; site = visita. O app NÃO conta clique como
  conversão e NÃO mede venda (sem pixel).

## Pendências / próximos (em ordem)
1. Aplicar e validar o rótulo dinâmico de conversão (prompt já entregue).
2. Cosmético: textos do loader ainda dizem "Lendo arquivo CSV / Identificando colunas" — trocar para
   wording de tempo real.
3. Possível: comparação com período anterior.
4. Login + histórico por cliente.
5. Relatório semanal consolidado.
6. Próximos agentes: atendimento/vendas no WhatsApp; follow-up de quem não comprou.

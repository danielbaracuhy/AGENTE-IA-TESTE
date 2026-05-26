# -*- coding: utf-8 -*-
import csv
import os
from datetime import datetime
from fpdf import FPDF

CSV_PATH   = r"C:\Users\NetSolutions\Desktop\PASTA AGENTES DE IA\AGENTE OLEO TESTE\CAMPANHAS\digitalizando-negocios-Campanhas-12-de-mai-de-2026-25-de-mai-de-2026.csv"
OUTPUT_PATH = r"C:\Users\NetSolutions\Desktop\PASTA AGENTES DE IA\AGENTE OLEO TESTE\RELATORIOS\relatorio-campanhas.pdf"

def to_float(val, default=0.0):
    try:
        return float(str(val).replace(",", ".")) if val and str(val).strip() != "" else default
    except Exception:
        return default

def to_int(val, default=0):
    try:
        return int(float(str(val))) if val and str(val).strip() != "" else default
    except Exception:
        return default

def fmt_brl(v):
    """Formata valor em BRL sem unicode especial."""
    return "R$ {:,.2f}".format(v).replace(",", "X").replace(".", ",").replace("X", ".")

def fmt_num(v):
    return "{:,}".format(v).replace(",", ".")

# ─── LEITURA DO CSV ─────────────────────────────────────────────────────────

campanhas = []
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        campanhas.append(row)

dados = []
for c in campanhas:
    nome          = c.get("Nome da campanha", "").strip()
    status        = c.get("Veiculação da campanha", c.get("Veiculacao da campanha", c.get("Veiculação da campanha", ""))).strip()
    inicio        = c.get("Inicio dos relatórios", c.get("Início dos relatórios", c.get("Início dos relatórios", ""))).strip()
    fim           = c.get("Encerramento dos relatórios", c.get("Encerramento dos relatórios", "")).strip()
    investido     = to_float(c.get("Valor usado (BRL)", "0"))
    alcance       = to_int(c.get("Alcance", "0"))
    impressoes    = to_int(c.get("Impressões", c.get("Impressões", c.get("Impressoes", "0"))))
    cliques_link  = to_int(c.get("Cliques no link", "0"))
    cliques_todos = to_int(c.get("Cliques (todos)", "0"))
    ctr_link      = to_float(c.get("CTR (taxa de cliques no link)", "0"))
    ctr_todos     = to_float(c.get("CTR (todos)", "0"))
    cpc_link      = to_float(c.get("CPC (custo por clique no link) (BRL)", "0"))
    cpm           = to_float(c.get("CPM (custo por 1.000 impressões) (BRL)", c.get("CPM (custo por 1.000 impressões) (BRL)", "0")))
    lp_views      = to_int(c.get("Visualizações da página de destino", c.get("Visualizações da página de destino", "0")))
    custo_lp      = to_float(c.get("Custo por visualização da página de destino (BRL)", c.get("Custo por visualização da página de destino (BRL)", "0")))
    conversoes    = to_int(c.get("Resultados", "0"))
    cpp           = to_float(c.get("Custo por resultados", "0"))
    frequencia    = to_float(c.get("Frequência", c.get("Frequência", c.get("Frequencia", "0"))))

    taxa_conv_lp  = (conversoes / lp_views * 100) if lp_views > 0 else 0.0
    taxa_click_lp = (lp_views / cliques_link * 100) if cliques_link > 0 else 0.0

    dados.append({
        "nome": nome, "status": status, "inicio": inicio, "fim": fim,
        "investido": investido, "alcance": alcance, "impressoes": impressoes,
        "cliques_link": cliques_link, "cliques_todos": cliques_todos,
        "ctr_link": ctr_link, "ctr_todos": ctr_todos, "cpc_link": cpc_link,
        "cpm": cpm, "lp_views": lp_views, "custo_lp": custo_lp,
        "conversoes": conversoes, "cpp": cpp, "frequencia": frequencia,
        "taxa_conv_lp": taxa_conv_lp, "taxa_click_lp": taxa_click_lp,
    })

# ─── TOTAIS ─────────────────────────────────────────────────────────────────

total_investido  = sum(d["investido"]    for d in dados)
total_alcance    = sum(d["alcance"]      for d in dados)
total_impressoes = sum(d["impressoes"]   for d in dados)
total_cliques    = sum(d["cliques_link"] for d in dados)
total_conv       = sum(d["conversoes"]   for d in dados)
total_lp         = sum(d["lp_views"]     for d in dados)
cpp_medio        = (total_investido / total_conv) if total_conv > 0 else 0.0

camp_melhor = min(dados, key=lambda d: d["cpp"] if d["cpp"] > 0 else 9999)
camp_pior   = max(dados, key=lambda d: d["cpp"])

# ─── PDF ─────────────────────────────────────────────────────────────────────

class PDF(FPDF):
    def header(self):
        self.set_fill_color(20, 60, 120)
        self.rect(0, 0, 210, 25, "F")
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(255, 255, 255)
        self.set_xy(10, 7)
        self.cell(0, 10, "RELATORIO DE CAMPANHAS  -  META ADS", align="L")
        self.set_font("Helvetica", "", 9)
        self.set_xy(10, 16)
        self.cell(0, 6, "Digitalizando Negocios  |  Analise de Performance", align="L")
        self.ln(20)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10,
            "Pagina {} | Gerado em {}".format(
                self.page_no(), datetime.now().strftime("%d/%m/%Y as %H:%M")
            ), align="C")

    def section_title(self, title, rgb=(20, 60, 120)):
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*rgb)
        self.set_fill_color(235, 240, 255)
        self.cell(0, 9, "  " + title, fill=True, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def kpi_box(self, label, value, x, y, w=43, h=24, bg=(235, 240, 255), fg=(20, 60, 120)):
        self.set_fill_color(*bg)
        self.rect(x, y, w, h, "F")
        self.set_draw_color(*fg)
        self.rect(x, y, w, h)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(80, 80, 80)
        self.set_xy(x + 1, y + 2)
        self.cell(w - 2, 5, label, align="C")
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*fg)
        self.set_xy(x + 1, y + 9)
        self.cell(w - 2, 10, value, align="C")

    def body_text(self, txt, indent=0):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        self.set_x(10 + indent)
        self.multi_cell(190 - indent, 6, txt)
        self.ln(1)

    def bullet(self, txt, indent=4):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        self.set_x(10 + indent)
        self.cell(6, 6, "-")
        self.set_x(10 + indent + 6)
        self.multi_cell(180 - indent, 6, txt)
        self.ln(0.5)

    def alert_box(self, txt, tipo="ATENCAO"):
        cores = {
            "ATENCAO": ((255, 243, 205), (140, 90, 0),   (255, 200, 50)),
            "ERRO":    ((255, 220, 220), (160, 0, 0),     (220, 53, 69)),
            "OK":      ((212, 237, 218), (20, 100, 40),   (40, 167, 69)),
        }
        bg, fg, brd = cores.get(tipo, cores["ATENCAO"])
        y0 = self.get_y()
        self.set_fill_color(*bg)
        self.set_draw_color(*brd)
        self.rect(10, y0, 190, 13, "FD")
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*fg)
        self.set_xy(13, y0 + 3)
        self.cell(22, 7, "[{}]".format(tipo))
        self.set_font("Helvetica", "", 9)
        self.set_text_color(40, 40, 40)
        self.set_xy(37, y0 + 3)
        self.multi_cell(161, 7, txt)
        self.ln(2)


pdf = PDF()
pdf.set_auto_page_break(auto=True, margin=20)
pdf.add_page()

# Identificacao
pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(80, 80, 80)
d0 = dados[0]
pdf.cell(0, 6, "Periodo: {} a {}".format(d0["inicio"], d0["fim"]), align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 6, "Gerado em: {}".format(datetime.now().strftime("%d/%m/%Y as %H:%M")), align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(6)

# ══ 1. RESUMO GERAL ══════════════════════════════════════════════════════════
pdf.section_title("1.  RESUMO GERAL DO PERIODO")

kpis = [
    ("Total Investido",      fmt_brl(total_investido)),
    ("Total de Cliques",     fmt_num(total_cliques)),
    ("Alcance Total",        fmt_num(total_alcance)),
    ("Impressoes Totais",    fmt_num(total_impressoes)),
]
kpis2 = [
    ("Conversoes (Compras)", str(total_conv)),
    ("Custo Medio/Compra",   fmt_brl(cpp_medio)),
    ("Views Landing Page",   fmt_num(total_lp)),
    ("Campanhas Ativas",     str(len(dados))),
]
y_k = pdf.get_y()
for i, (lbl, val) in enumerate(kpis):
    pdf.kpi_box(lbl, val, 10 + i * 48, y_k)
pdf.ln(30)
y_k2 = pdf.get_y()
for i, (lbl, val) in enumerate(kpis2):
    pdf.kpi_box(lbl, val, 10 + i * 48, y_k2)
pdf.ln(35)

pdf.body_text(
    "No periodo de {} a {}, foram analisadas {} campanha(s) ativas no Meta Ads. "
    "O investimento total foi de {}, gerando {} conversao(s) confirmada(s) pelo pixel de compra "
    "do Facebook, com custo medio por aquisicao de {}.".format(
        d0["inicio"], d0["fim"], len(dados),
        fmt_brl(total_investido), total_conv, fmt_brl(cpp_medio)
    )
)

# ══ 2. ANALISE POR CAMPANHA ══════════════════════════════════════════════════
pdf.section_title("2.  ANALISE POR CAMPANHA")

for d in dados:
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(20, 60, 120)
    pdf.cell(0, 8, "  {}  ({})".format(d["nome"], d["status"].upper()), new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(40, 40, 40)
    pdf.set_font("Helvetica", "", 10)

    rows = [
        ("Periodo",                   "{} a {}".format(d["inicio"], d["fim"])),
        ("Investimento",              fmt_brl(d["investido"])),
        ("Alcance",                   fmt_num(d["alcance"])),
        ("Impressoes",                fmt_num(d["impressoes"])),
        ("Frequencia Media",          "{:.2f}x".format(d["frequencia"])),
        ("Cliques no Link",           fmt_num(d["cliques_link"])),
        ("CPM",                       "R$ {:.2f}".format(d["cpm"])),
        ("CPC (link)",                "R$ {:.2f}".format(d["cpc_link"])),
        ("CTR (link)",                "{:.2f}%".format(d["ctr_link"])),
        ("Views da Landing Page",     fmt_num(d["lp_views"])),
        ("Custo por View LP",         "R$ {:.2f}".format(d["custo_lp"])),
        ("Taxa Click -> LP",          "{:.1f}%".format(d["taxa_click_lp"])),
        ("Conversoes (Compras)",      str(d["conversoes"])),
        ("Custo por Compra (CPP)",    "R$ {:.2f}".format(d["cpp"])),
        ("Taxa Conv. LP -> Compra",   "{:.2f}%".format(d["taxa_conv_lp"])),
    ]
    for lbl, val in rows:
        y = pdf.get_y()
        pdf.set_fill_color(248, 248, 252)
        pdf.rect(10, y, 190, 7, "F")
        pdf.set_xy(12, y)
        pdf.cell(95, 7, lbl)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(93, 7, val, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
    pdf.ln(4)

# ══ 3. DIAGNOSTICO DO FUNIL ══════════════════════════════════════════════════
pdf.section_title("3.  DIAGNOSTICO DO FUNIL DE VENDAS")

for d in dados:
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(20, 60, 120)
    pdf.cell(0, 8, "  Campanha: {}".format(d["nome"]), new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    etapas = [
        ("TOPO - IMPRESSOES",        d["impressoes"],   100.0,               (70,  130, 180)),
        ("MEIO - CLIQUES NO LINK",   d["cliques_link"], d["ctr_link"],        (50,  150, 100)),
        ("MEIO - VIEWS LAND. PAGE",  d["lp_views"],     d["taxa_click_lp"],   (200, 140, 50)),
        ("FUNDO - CONVERSOES",       d["conversoes"],   d["taxa_conv_lp"],    (180, 60,  60)),
    ]
    y0 = pdf.get_y()
    bar_max = 155.0
    for i, (etapa, qtd, taxa, cor) in enumerate(etapas):
        pct = taxa / 100.0
        bar_w = max(bar_max * pct, 3) if i > 0 else bar_max
        pdf.set_fill_color(*cor)
        pdf.rect(10, y0 + i * 13, bar_w, 10, "F")
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(255, 255, 255)
        pdf.set_xy(12, y0 + i * 13 + 1)
        label = "{}: {}".format(etapa, fmt_num(qtd))
        pdf.cell(min(bar_w - 2, 150), 8, label)
        pdf.set_text_color(60, 60, 60)
        pdf.set_font("Helvetica", "", 8)
        taxa_txt = "({:.2f}%)".format(taxa) if i > 0 else "(topo do funil)"
        pdf.set_xy(10 + bar_w + 2, y0 + i * 13 + 1)
        pdf.cell(40, 8, taxa_txt)

    pdf.set_y(y0 + len(etapas) * 13 + 4)
    pdf.set_text_color(40, 40, 40)

    perda_click = d["impressoes"] - d["cliques_link"]
    perda_lp    = d["cliques_link"] - d["lp_views"]
    perda_conv  = d["lp_views"] - d["conversoes"]

    pdf.bullet(
        "Impressoes -> Cliques: {:} usuarios nao clicaram no anuncio (CTR {:.2f}%).".format(
            fmt_num(perda_click), d["ctr_link"]
        )
    )
    pdf.bullet(
        "Cliques -> Landing Page: {} pessoas nao chegaram a pagina de vendas "
        "({:.1f}% de aproveitamento). Pode indicar lentidao na pagina ou link quebrado.".format(
            perda_lp, d["taxa_click_lp"]
        )
    )
    pdf.bullet(
        "Landing Page -> Compra: {} visitantes nao converteram "
        "(taxa {:.2f}%). Copywriting e oferta sao os principais alavancadores.".format(
            perda_conv, d["taxa_conv_lp"]
        )
    )
    pdf.ln(4)

# ══ 4. ALERTAS ═══════════════════════════════════════════════════════════════
pdf.section_title("4.  ALERTAS E SINALIZACOES")

alertas = False
for d in dados:
    if d["ctr_link"] < 1.0:
        pdf.alert_box(
            "{}: CTR de {:.2f}% ABAIXO de 1% (problema no criativo). "
            "Testar novos criativos imediatamente.".format(d["nome"], d["ctr_link"]),
            "ERRO"
        )
        alertas = True

    if d["cpp"] > 150:
        pdf.alert_box(
            "{}: Custo por Compra R$ {:.2f} ACIMA do limite de R$ 150 (ineficiente). "
            "Revisar segmentacao e conjunto de anuncios.".format(d["nome"], d["cpp"]),
            "ERRO"
        )
        alertas = True

    if d["conversoes"] == 0:
        pdf.alert_box(
            "{}: ZERO conversoes registradas. Verificar pixel, pagina de vendas e oferta.".format(d["nome"]),
            "ERRO"
        )
        alertas = True

    if d["taxa_click_lp"] < 70.0 and d["cliques_link"] > 0:
        pdf.alert_box(
            "{}: Apenas {:.1f}% dos cliques chegaram a Landing Page. "
            "Verificar velocidade de carregamento e disponibilidade da pagina.".format(
                d["nome"], d["taxa_click_lp"]
            ),
            "ATENCAO"
        )
        alertas = True

    if d["ctr_link"] >= 3.0:
        pdf.alert_box(
            "{}: CTR de {:.2f}% EXCELENTE (benchmark: 1-3%). "
            "Criativo altamente relevante - candidato para escala de orcamento.".format(
                d["nome"], d["ctr_link"]
            ),
            "OK"
        )
        alertas = True

    if 0 < d["cpp"] <= 150:
        pdf.alert_box(
            "{}: CPP R$ {:.2f} dentro do limite aceitavel (< R$ 150). "
            "Campanha operando de forma eficiente.".format(d["nome"], d["cpp"]),
            "OK"
        )
        alertas = True

if not alertas:
    pdf.body_text("Nenhum alerta critico identificado no periodo analisado.")

pdf.ln(4)

# ══ 5. RECOMENDACOES ══════════════════════════════════════════════════════════
pdf.section_title("5.  RECOMENDACOES ESTRATEGICAS")

# Campanha para escalar
pdf.set_font("Helvetica", "B", 10)
pdf.set_text_color(20, 100, 40)
pdf.cell(0, 8, "  CAMPANHA PARA ESCALAR:", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(40, 40, 40)
pdf.body_text(
    "  {} - CPP de R$ {:.2f} e CTR de {:.2f}%. "
    "Aumentar orcamento gradualmente em ate 20%% por semana.".format(
        camp_melhor["nome"], camp_melhor["cpp"], camp_melhor["ctr_link"]
    )
)

if len(dados) > 1:
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(180, 0, 0)
    pdf.cell(0, 8, "  CAMPANHA PARA PAUSAR / OTIMIZAR:", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(40, 40, 40)
    pdf.body_text(
        "  {} - CPP de R$ {:.2f}. "
        "Revisar publico, criativo e landing page antes de continuar investindo.".format(
            camp_pior["nome"], camp_pior["cpp"]
        )
    )
else:
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(180, 80, 0)
    pdf.cell(0, 8, "  PONTO DE ATENCAO:", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(40, 40, 40)
    pdf.body_text(
        "  {} tem apenas {} conversao(s) no periodo. "
        "Monitorar evolucao diaria antes de decisao de escala.".format(
            d0["nome"], d0["conversoes"]
        )
    )

pdf.ln(2)
pdf.set_font("Helvetica", "B", 11)
pdf.set_text_color(20, 60, 120)
pdf.cell(0, 8, "  TOP 3 ACOES IMEDIATAS:", new_x="LMARGIN", new_y="NEXT")
pdf.set_text_color(40, 40, 40)

# Acao 1 - Landing Page
pdf.set_font("Helvetica", "B", 10)
pdf.set_text_color(20, 60, 120)
pdf.cell(0, 7, "  1. Otimizar a Landing Page (impacto alto, custo baixo)", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(40, 40, 40)
lp_d = dados[0]
pdf.set_x(14)
pdf.multi_cell(186, 6,
    "A taxa de chegada na pagina e de {:.1f}% (ideal: >80%). Melhorar a velocidade de "
    "carregamento (PageSpeed > 90 em mobile), revisar o link de destino e garantir estabilidade "
    "da hospedagem. Cada 10%% de melhora aqui gera mais visitantes sem custo adicional.".format(
        lp_d["taxa_click_lp"]
    )
)
pdf.ln(3)

# Acao 2 - Conversao
pdf.set_font("Helvetica", "B", 10)
pdf.set_text_color(20, 60, 120)
pdf.cell(0, 7, "  2. Aumentar a Taxa de Conversao da Pagina de Vendas", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(40, 40, 40)
pdf.set_x(14)
pdf.multi_cell(186, 6,
    "A conversao atual e de {:.2f}% (benchmark e-commerce: 2-5%). Testar: headline mais "
    "especifica a dor do publico, prova social (depoimentos em video), escassez real "
    "(estoque limitado, bonus por tempo) e CTA acima da dobra. Um ganho de 1 ponto percentual "
    "geraria mais {} compras extras com o mesmo orcamento.".format(
        lp_d["taxa_conv_lp"], int(lp_d["lp_views"] * 0.01)
    )
)
pdf.ln(3)

# Acao 3 - Escala / Teste A/B
pdf.set_font("Helvetica", "B", 10)
pdf.set_text_color(20, 60, 120)
if lp_d["ctr_link"] >= 3.0 and lp_d["cpp"] <= 150:
    pdf.cell(0, 7, "  3. Escalar com Regras Automatizadas no Meta Ads", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(40, 40, 40)
    pdf.set_x(14)
    pdf.multi_cell(186, 6,
        "Com CTR de {:.2f}%% e CPP de R$ {:.2f}, o criativo esta validado. Configurar regra "
        "automatica para aumentar o orcamento em 15%% toda vez que o CPP ficar abaixo de R$ 120 "
        "por 3 dias consecutivos. Duplicar o conjunto de anuncios testando publicos Lookalike 1-3%%.".format(
            lp_d["ctr_link"], lp_d["cpp"]
        )
    )
else:
    pdf.cell(0, 7, "  3. Implementar Testes A/B de Criativos", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(40, 40, 40)
    pdf.set_x(14)
    pdf.multi_cell(186, 6,
        "Criar 2 variacoes do anuncio principal: video curto (15s) focado no problema "
        "(oleo sujo, desperdicio, custo) e carrossel com antes/depois do produto. "
        "Rodar cada criativo com 30%% do orcamento por 7 dias e pausar o de pior CTR."
    )
pdf.ln(3)

# Redistribuicao de verba
pdf.set_font("Helvetica", "B", 10)
pdf.set_text_color(20, 60, 120)
pdf.cell(0, 8, "  SUGESTAO DE REDISTRIBUICAO DE VERBA:", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(40, 40, 40)
if len(dados) == 1:
    pdf.body_text(
        "  Com uma unica campanha ativa, manter o orcamento atual ({}) e aguardar pelo menos "
        "50 eventos de compra antes de escalar significativamente. Se o CPP se mantiver "
        "abaixo de R$ 120, aumentar 20%% a cada 5 dias.".format(fmt_brl(d0["investido"]))
    )
else:
    pdf.body_text(
        "  Redirecionar 30%% do orcamento da campanha com maior CPP para a de menor CPP. "
        "Manter o restante ate atingir 50 conversoes por conjunto para otimizacao adequada."
    )

# ══ 6. CONCLUSAO EXECUTIVA ════════════════════════════════════════════════════
pdf.add_page()
pdf.section_title("6.  CONCLUSAO EXECUTIVA", rgb=(50, 50, 50))

nota = "BOA"
if d0["ctr_link"] >= 3.0 and d0["cpp"] <= 150:
    nota = "BOA"
if d0["ctr_link"] < 1.0 or d0["cpp"] > 150:
    nota = "REGULAR"
if d0["conversoes"] == 0:
    nota = "CRITICA"

pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(40, 40, 40)
pdf.set_x(10)
pdf.multi_cell(190, 7,
    "No periodo de {} a {}, a conta de anuncios apresentou desempenho {}. "
    "O investimento total de {} gerou {} conversao(s) pelo pixel do Meta, "
    "resultando em custo de aquisicao de {} por compra.\n\n"
    "O principal ponto positivo e o CTR de {:.2f}%%, significativamente acima do benchmark "
    "de mercado (1%%), indicando que o criativo e o publico estao bem alinhados. "
    "O maior gargalo identificado esta na conversao da pagina de vendas ({:.2f}%%) "
    "e na perda de trafego entre o clique e a chegada na landing page ({:.1f}%% de aproveitamento).\n\n"
    "A prioridade imediata deve ser a otimizacao da experiencia na pagina de destino, "
    "pois e o ponto de maior alavancagem com menor custo adicional. Com as melhorias sugeridas, "
    "estima-se reducao de 20-35%% no custo por aquisicao nos proximos 30 dias.\n\n"
    "Revisao semanal recomendada dos KPIs: CTR (meta > 3%%), "
    "Taxa de Conversao LP (meta > 3%%), CPP (meta < R$ 100).".format(
        d0["inicio"], d0["fim"], nota,
        fmt_brl(total_investido), total_conv, fmt_brl(cpp_medio),
        d0["ctr_link"], d0["taxa_conv_lp"], d0["taxa_click_lp"]
    )
)

pdf.ln(6)
pdf.set_fill_color(20, 60, 120)
pdf.rect(10, pdf.get_y(), 190, 0.5, "F")
pdf.ln(4)
pdf.set_font("Helvetica", "I", 9)
pdf.set_text_color(100, 100, 100)
pdf.multi_cell(190, 5,
    "Relatorio gerado automaticamente com base nos dados do Gerenciador de Anuncios do Meta. "
    "Dados de conversao dependem da correta instalacao do pixel do Meta no site. "
    "Benchmark: CTR > 1%% (bom), CTR > 3%% (excelente); CPP varia conforme ticket medio do produto."
)

# ─── SALVAR ─────────────────────────────────────────────────────────────────

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
pdf.output(OUTPUT_PATH)
print("[OK] Relatorio salvo em: {}".format(OUTPUT_PATH))

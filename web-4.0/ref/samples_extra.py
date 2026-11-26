"""Mais 24 modelos reais: 6 apostilas, 6 listas, 6 provas e 6 roteiros (várias disciplinas e anos)."""

from __future__ import annotations

import math
from functools import lru_cache

from PIL import Image, ImageDraw

from aulaviva.core.quicklist import parse_questions
from aulaviva.core.samples import _doc, _font, _png

Q = parse_questions
LIST_META = dict(cover=False, toc=False, student_fields=True, answer_key=True)
TEST_META = dict(cover=False, toc=False, student_fields=True, answer_key=True)


# --------------------------------------------------------------------------- ilustrações
@lru_cache(maxsize=None)
def ill_shapes() -> str:
    img = Image.new("RGB", (1400, 420), "white")
    d = ImageDraw.Draw(img)
    f, fb = _font(26), _font(30, True)
    d.rectangle([60, 90, 360, 290], outline="#2563EB", width=6, fill="#DBEAFE")
    d.text((150, 300), "Retângulo", fill="#1E3A8A", font=fb)
    d.text((150, 50), "base = 6 cm", fill="#374151", font=f)
    d.text((370, 170), "altura\n4 cm", fill="#374151", font=f)
    d.rectangle([540, 90, 740, 290], outline="#16A34A", width=6, fill="#DCFCE7")
    d.text((585, 300), "Quadrado", fill="#14532D", font=fb)
    d.text((590, 50), "lado = 4 cm", fill="#374151", font=f)
    d.polygon([(900, 290), (1130, 290), (900, 90)], outline="#EA580C", fill="#FFEDD5")
    d.line([(900, 290), (1130, 290), (900, 90), (900, 290)], fill="#EA580C", width=6)
    d.text((960, 300), "Triângulo", fill="#7C2D12", font=fb)
    d.ellipse([1180, 110, 1360, 290], outline="#7C3AED", width=6, fill="#EDE9FE")
    d.line([(1270, 200), (1360, 200)], fill="#7C3AED", width=4)
    d.text((1215, 300), "Círculo", fill="#4C1D95", font=fb)
    return _png(img)


@lru_cache(maxsize=None)
def ill_percent() -> str:
    img = Image.new("RGB", (1400, 420), "white")
    d = ImageDraw.Draw(img)
    f, fb = _font(26), _font(34, True)
    for i, (pct, col) in enumerate(((25, "#3B82F6"), (50, "#10B981"), (75, "#F59E0B"), (100, "#EF4444"))):
        x = 80 + i * 330
        d.rectangle([x, 100, x + 240, 160], outline="#9CA3AF", width=3, fill="#F3F4F6")
        d.rectangle([x, 100, x + int(240 * pct / 100), 160], fill=col)
        d.text((x + 70, 180), f"{pct}%", fill="#111827", font=fb)
        d.text((x + 40, 235), f"{pct}/100 = {pct / 100:.2f}".replace(".", ","), fill="#4B5563", font=f)
    d.text((80, 30), "Porcentagem: partes de 100", fill="#4B5563", font=f)
    return _png(img)


@lru_cache(maxsize=None)
def ill_states() -> str:
    img = Image.new("RGB", (1400, 460), "white")
    d = ImageDraw.Draw(img)
    fb, f = _font(32, True), _font(24)
    import random

    rnd = random.Random(5)
    boxes = [("Sólido", "#3B82F6", "grade"), ("Líquido", "#06B6D4", "solto"), ("Gasoso", "#94A3B8", "disperso")]
    for i, (name, col, mode) in enumerate(boxes):
        x0 = 70 + i * 450
        d.rounded_rectangle([x0, 60, x0 + 360, 340], radius=24, outline="#CBD5E1", width=4)
        pts = []
        if mode == "grade":
            pts = [(x0 + 50 + c * 52, 110 + r * 52) for r in range(5) for c in range(6)]
        elif mode == "solto":
            pts = [(x0 + 40 + rnd.randint(0, 280), 200 + rnd.randint(0, 120)) for _ in range(22)]
        else:
            pts = [(x0 + 30 + rnd.randint(0, 300), 80 + rnd.randint(0, 240)) for _ in range(10)]
        for (x, y) in pts:
            d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=col)
        d.text((x0 + 120, 360), name, fill="#111827", font=fb)
    d.text((540, 410), "aquecimento →  /  ← resfriamento", fill="#6B7280", font=f)
    return _png(img)


@lru_cache(maxsize=None)
def ill_periodic() -> str:
    img = Image.new("RGB", (1400, 380), "white")
    d = ImageDraw.Draw(img)
    elems = [("H", 1, "Hidrogênio", "#FDE68A"), ("He", 2, "Hélio", "#C4B5FD"), ("C", 6, "Carbono", "#BBF7D0"),
             ("N", 7, "Nitrogênio", "#BBF7D0"), ("O", 8, "Oxigênio", "#BBF7D0"), ("Na", 11, "Sódio", "#FCA5A5"),
             ("Fe", 26, "Ferro", "#FBCFE8"), ("Au", 79, "Ouro", "#FBCFE8")]
    fs, fb, ft = _font(22), _font(56, True), _font(19)
    for i, (sym, num, name, col) in enumerate(elems):
        x = 30 + i * 170
        d.rounded_rectangle([x, 70, x + 150, 290], radius=14, fill=col, outline="#334155", width=3)
        d.text((x + 12, 80), str(num), fill="#111827", font=fs)
        w = d.textlength(sym, font=fb)
        d.text((x + 75 - w / 2, 130), sym, fill="#111827", font=fb)
        w = d.textlength(name, font=ft)
        d.text((x + 75 - w / 2, 240), name, fill="#111827", font=ft)
    d.text((30, 20), "Alguns elementos químicos (número atômico, símbolo e nome)", fill="#4B5563", font=_font(24))
    return _png(img)


@lru_cache(maxsize=None)
def ill_forces() -> str:
    img = Image.new("RGB", (1400, 420), "white")
    d = ImageDraw.Draw(img)
    f = _font(28, True)
    d.line([(100, 300), (1300, 300)], fill="#6B7280", width=6)
    d.rounded_rectangle([560, 170, 840, 300], radius=12, fill="#93C5FD", outline="#1D4ED8", width=5)
    d.text((640, 215), "m = 10 kg", fill="#1E3A8A", font=f)

    def arrow(x1, y1, x2, y2, col, text, tx, ty):
        d.line([(x1, y1), (x2, y2)], fill=col, width=10)
        ang = math.atan2(y2 - y1, x2 - x1)
        for s in (2.6, -2.6):
            d.line([(x2, y2), (x2 + 34 * math.cos(ang + s), y2 + 34 * math.sin(ang + s))], fill=col, width=10)
        d.text((tx, ty), text, fill=col, font=f)

    arrow(840, 235, 1120, 235, "#16A34A", "F = 50 N", 940, 180)
    arrow(560, 235, 400, 235, "#DC2626", "atrito = 10 N", 330, 180)
    arrow(700, 170, 700, 60, "#7C3AED", "Normal", 720, 70)
    arrow(700, 300, 700, 400, "#EA580C", "Peso", 720, 350)
    return _png(img)


@lru_cache(maxsize=None)
def ill_food_chain() -> str:
    img = Image.new("RGB", (1400, 360), "white")
    d = ImageDraw.Draw(img)
    f, fs = _font(28, True), _font(22)
    items = [("Capim", "Produtor", "#22C55E"), ("Gafanhoto", "Consumidor 1º", "#EAB308"), ("Sapo", "Consumidor 2º", "#14B8A6"),
             ("Cobra", "Consumidor 3º", "#F97316"), ("Fungos", "Decompositores", "#8B5CF6")]
    for i, (name, role, col) in enumerate(items):
        x = 40 + i * 275
        d.ellipse([x, 70, x + 200, 270], fill=col)
        w = d.textlength(name, font=f)
        d.text((x + 100 - w / 2, 150), name, fill="white", font=f)
        w = d.textlength(role, font=fs)
        d.text((x + 100 - w / 2, 285), role, fill="#374151", font=fs)
        if i < len(items) - 1:
            d.line([(x + 205, 170), (x + 268, 170)], fill="#6B7280", width=6)
            d.polygon([(x + 268, 160), (x + 268, 180), (x + 280, 170)], fill="#6B7280")
    d.text((40, 20), "Cadeia alimentar: a seta indica quem serve de alimento para quem (fluxo de energia)", fill="#4B5563", font=fs)
    return _png(img)


@lru_cache(maxsize=None)
def ill_budget() -> str:
    img = Image.new("RGB", (1400, 420), "white")
    d = ImageDraw.Draw(img)
    f, fb = _font(24), _font(28, True)
    data = [("Moradia", 35, "#3B82F6"), ("Alimentação", 25, "#10B981"), ("Transporte", 15, "#F59E0B"),
            ("Lazer", 10, "#EC4899"), ("Poupança", 15, "#8B5CF6")]
    x = 120
    for name, pct, col in data:
        h = pct * 8
        d.rectangle([x, 340 - h, x + 140, 340], fill=col)
        d.text((x + 40, 340 - h - 40), f"{pct}%", fill="#111827", font=fb)
        w = d.textlength(name, font=f)
        d.text((x + 70 - w / 2, 355), name, fill="#374151", font=f)
        x += 240
    d.line([(100, 340), (1300, 340)], fill="#9CA3AF", width=3)
    d.text((100, 20), "Exemplo de orçamento familiar (renda = 100%)", fill="#4B5563", font=f)
    return _png(img)


# --------------------------------------------------------------------------- apostilas
def a_digestorio():
    return _doc("Sistema digestório", "Do alimento à energia", "Ciências", "8º ano", "Verde caderno", [
        ("callout", {"style": "definicao", "title": "Objetivos", "text": "Identificar os órgãos do sistema digestório e suas funções, e compreender as etapas da digestão."}),
        ("heading", {"text": "O que é digestão?"}),
        ("paragraph", {"text": "**Digestão** é o conjunto de transformações que quebram os alimentos em partículas pequenas (nutrientes) que podem ser absorvidas pelo organismo e levadas pelo sangue até as células."}),
        ("heading", {"text": "O caminho do alimento"}),
        ("table", {"rows": [["Órgão", "O que acontece"], ["Boca", "Mastigação e início da digestão do amido pela saliva"],
                            ["Faringe e esôfago", "Condução do alimento até o estômago (movimentos peristálticos)"],
                            ["Estômago", "Suco gástrico (ácido) digere proteínas"],
                            ["Intestino delgado", "Termina a digestão e absorve a maior parte dos nutrientes"],
                            ["Intestino grosso", "Absorve água e forma as fezes"]]}),
        ("callout", {"style": "curiosidade", "title": "Você sabia?", "text": "O intestino delgado de um adulto mede cerca de 6 a 7 metros, e suas dobras aumentam muito a área de absorção."}),
        ("heading", {"text": "Órgãos anexos"}),
        ("bullets", {"items": ["**Glândulas salivares:** produzem saliva.", "**Fígado:** produz a bile, que ajuda a digerir gorduras.",
                               "**Pâncreas:** produz o suco pancreático, com várias enzimas digestivas."]}),
        ("heading", {"text": "Atividades"}),
        Q("""1) Em qual órgão começa a digestão do amido?
*a) Boca
b) Estômago
c) Intestino grosso
d) Esôfago

2) Marque V ou F:
(V) O intestino delgado absorve a maior parte dos nutrientes.
(F) O fígado produz o suco gástrico.
(V) O intestino grosso absorve água.

3) Explique por que a mastigação é importante para a digestão.
Resposta: Ela fragmenta o alimento, aumentando a superfície de contato com as enzimas e facilitando a digestão.
Linhas: 4"""),
    ])


def a_revolucao():
    return _doc("Revolução Industrial", "Máquinas, fábricas e transformações sociais", "História", "8º ano", "Grafite", [
        ("callout", {"style": "definicao", "title": "Objetivos", "text": "Compreender as causas e consequências da Revolução Industrial e as mudanças nas relações de trabalho."}),
        ("heading", {"text": "Onde e quando começou"}),
        ("paragraph", {"text": "A Revolução Industrial começou na **Inglaterra**, na segunda metade do século XVIII. Fatores como reservas de carvão e ferro, capital acumulado com o comércio e mão de obra disponível no campo favoreceram o processo."}),
        ("heading", {"text": "Fases"}),
        ("table", {"rows": [["Fase", "Período", "Marcos"], ["Primeira", "c. 1760-1850", "Máquina a vapor, indústria têxtil, carvão"],
                            ["Segunda", "c. 1850-1950", "Eletricidade, petróleo, aço, linha de montagem"],
                            ["Terceira", "a partir de 1950", "Eletrônica, computadores, automação"]]}),
        ("heading", {"text": "Trabalho nas fábricas"}),
        ("paragraph", {"text": "As jornadas chegavam a 14 ou 16 horas diárias, inclusive para mulheres e crianças, com baixos salários e ambientes insalubres. Os trabalhadores se organizaram em **sindicatos** e movimentos como o cartismo para reivindicar direitos."}),
        ("callout", {"style": "importante", "title": "Para refletir", "text": "Que direitos trabalhistas que temos hoje surgiram dessas lutas?"}),
        ("heading", {"text": "Atividades"}),
        Q("""1) Em qual país começou a Revolução Industrial?
a) França
*b) Inglaterra
c) Estados Unidos
d) Alemanha

2) Qual fonte de energia marcou a primeira fase?
a) Petróleo
b) Eletricidade
*c) Carvão (máquina a vapor)
d) Energia solar

3) Cite duas condições de trabalho nas primeiras fábricas.
Resposta: Jornadas muito longas, trabalho infantil, salários baixos, ambientes insalubres.
Linhas: 4"""),
    ])


def a_regioes():
    return _doc("As regiões do Brasil", "Divisão regional do IBGE", "Geografia", "7º ano", "Verde caderno", [
        ("callout", {"style": "definicao", "title": "Objetivos", "text": "Conhecer a divisão regional oficial do Brasil e características de cada região."}),
        ("heading", {"text": "Cinco regiões"}),
        ("paragraph", {"text": "O **IBGE** divide o Brasil em cinco regiões, agrupando estados com características naturais, econômicas e culturais semelhantes."}),
        ("table", {"rows": [["Região", "Estados", "Destaques"],
                            ["Norte", "AC, AM, AP, PA, RO, RR, TO", "Maior região; Floresta Amazônica"],
                            ["Nordeste", "AL, BA, CE, MA, PB, PE, PI, RN, SE", "Maior número de estados; litoral extenso"],
                            ["Centro-Oeste", "DF, GO, MT, MS", "Cerrado e Pantanal; agropecuária"],
                            ["Sudeste", "ES, MG, RJ, SP", "Mais populosa e industrializada"],
                            ["Sul", "PR, RS, SC", "Clima subtropical; menor região"]]}),
        ("callout", {"style": "dica", "title": "Dica", "text": "Use o QR code para explorar mapas oficiais do IBGE."}),
        ("qrcode", {"url": "https://educa.ibge.gov.br/", "caption": "IBGE Educa: mapas e dados para estudantes", "size": 28}),
        ("heading", {"text": "Atividades"}),
        Q("""1) Qual é a região mais populosa do Brasil?
a) Nordeste
*b) Sudeste
c) Sul
d) Norte

2) Marque V ou F:
(V) O Distrito Federal fica na região Centro-Oeste.
(F) A região Sul tem o maior número de estados.
(V) A região Norte é a maior em área.

3) Escreva o nome da região onde você mora e duas características dela.
Linhas: 4"""),
    ])


def a_substantivo():
    return _doc("Substantivo e adjetivo", "Classes gramaticais", "Língua Portuguesa", "6º ano", "Laranja giz", [
        ("callout", {"style": "definicao", "title": "Objetivos", "text": "Reconhecer substantivos e adjetivos e entender a relação entre eles na frase."}),
        ("heading", {"text": "Substantivo"}),
        ("paragraph", {"text": "**Substantivo** é a palavra que dá nome a seres, objetos, lugares, sentimentos e ideias. Exemplos: *menino*, *escola*, *Brasil*, *alegria*."}),
        ("bullets", {"items": ["**Próprio:** nomeia um ser específico (Maria, Recife).", "**Comum:** nomeia de forma geral (cidade, cachorro).",
                               "**Concreto:** existe por si (mesa, fada).", "**Abstrato:** depende de outro ser (saudade, beleza)."]}),
        ("heading", {"text": "Adjetivo"}),
        ("paragraph", {"text": "**Adjetivo** caracteriza o substantivo, indicando qualidade, estado ou origem. Em *casa amarela*, a palavra *amarela* é adjetivo. O adjetivo **concorda** com o substantivo em gênero e número: *casas amarelas*."}),
        ("callout", {"style": "dica", "title": "Truque", "text": "Pergunte \"como é?\" depois do substantivo. A resposta costuma ser um adjetivo."}),
        ("heading", {"text": "Atividades"}),
        Q("""1) Na frase "O menino alegre jogou bola", qual palavra é adjetivo?
a) menino
*b) alegre
c) jogou
d) bola

2) Marque V ou F:
(V) "Saudade" é um substantivo abstrato.
(F) "Recife" é um substantivo comum.
(V) Adjetivos concordam com o substantivo.

3) Escreva três adjetivos que descrevam a sua escola.
Linhas: 3"""),
    ])


def a_equacoes():
    return _doc("Equações do 1º grau", "Encontrando o valor desconhecido", "Matemática", "7º ano", "Azul escolar", [
        ("callout", {"style": "definicao", "title": "Objetivos", "text": "Resolver equações do 1º grau e usá-las para resolver problemas."}),
        ("heading", {"text": "O que é uma equação?"}),
        ("paragraph", {"text": "Uma **equação** é uma igualdade com um valor desconhecido, chamado **incógnita** (geralmente *x*). Resolver a equação é descobrir o valor de *x* que torna a igualdade verdadeira."}),
        ("callout", {"style": "dica", "title": "Pense na balança", "text": "O que fizer de um lado da igualdade, faça também do outro: ela continua equilibrada."}),
        ("heading", {"text": "Exemplo resolvido"}),
        ("table", {"rows": [["Passo", "Equação"], ["Equação inicial", "2x + 5 = 17"], ["Subtrair 5 dos dois lados", "2x = 12"],
                            ["Dividir os dois lados por 2", "x = 6"], ["Verificação", "2·6 + 5 = 17 ✓"]]}),
        ("heading", {"text": "Atividades"}),
        Q("""1) Qual é a solução de x + 8 = 15?
a) 5
*b) 7
c) 8
d) 23

2) Qual é a solução de 3x = 21?
a) 18
b) 24
*c) 7
d) 6

3) Pensei em um número, multipliquei por 4 e somei 2, obtendo 30. Que número pensei? Mostre a equação.
Resposta: 4x + 2 = 30, logo 4x = 28 e x = 7.
Linhas: 5"""),
    ])


def a_ecologia():
    return _doc("Cadeias e teias alimentares", "Energia nos ecossistemas", "Ciências", "6º ano", "Verde caderno", [
        ("callout", {"style": "definicao", "title": "Objetivos", "text": "Compreender o fluxo de energia nos ecossistemas e os papéis de produtores, consumidores e decompositores."}),
        ("heading", {"text": "Quem come quem?"}),
        ("image", {"data": ill_food_chain(), "caption": "Figura 1 - Exemplo de cadeia alimentar.", "width": 100}),
        ("bullets", {"items": ["**Produtores:** fazem fotossíntese (plantas, algas).", "**Consumidores:** alimentam-se de outros seres.",
                               "**Decompositores:** fungos e bactérias que decompõem restos e devolvem nutrientes ao solo."]}),
        ("heading", {"text": "Teia alimentar"}),
        ("paragraph", {"text": "Na natureza, as cadeias se cruzam: um mesmo animal pode comer vários alimentos e ser presa de diferentes predadores. Esse conjunto de cadeias interligadas forma a **teia alimentar**."}),
        ("callout", {"style": "atencao", "title": "Desequilíbrio", "text": "Se uma espécie desaparece, as outras da teia são afetadas. Por isso a preservação é tão importante."}),
        ("heading", {"text": "Atividades"}),
        Q("""1) Qual ser vivo é produtor na cadeia da Figura 1?
*a) Capim
b) Gafanhoto
c) Sapo
d) Cobra

2) Qual é o papel dos fungos e bactérias decompositores?
Resposta: Decompor restos de seres vivos, devolvendo nutrientes ao ambiente.
Linhas: 3"""),
    ])


# --------------------------------------------------------------------------- listas
def l_porcentagem():
    return _doc("Porcentagem no cotidiano", "Lista de exercícios", "Matemática", "7º ano", "Laranja giz", [
        ("callout", {"style": "atencao", "title": "Instruções", "text": "Resolva mostrando os cálculos. Você pode responder neste PDF."}),
        ("image", {"data": ill_percent(), "caption": "Porcentagem representa partes de 100.", "width": 100}),
        Q("""1) Quanto é 10% de 250?
a) 2,5
*b) 25
c) 250
d) 10

2) Uma camiseta de R$ 80,00 está com 25% de desconto. Qual o novo preço?
a) R$ 55,00
*b) R$ 60,00
c) R$ 65,00
d) R$ 20,00

3) Marque V ou F:
(V) 50% equivale à metade.
(F) 25% equivale a 1/2.
(V) 100% representa o total.

4) Em uma turma de 40 alunos, 30% usam óculos. Quantos alunos usam óculos?
Resposta: 30% de 40 = 0,3 × 40 = 12 alunos.
Linhas: 4

5) Um produto custava R$ 200,00 e aumentou 15%. Qual o novo valor?
Resposta: 15% de 200 = 30; novo valor R$ 230,00.
Linhas: 4"""),
    ], **LIST_META)


def l_tabuada():
    return _doc("Multiplicação e tabuada", "Lista de exercícios", "Matemática", "3º ano", "Azul escolar", [
        ("callout", {"style": "dica", "title": "Lembre-se", "text": "Multiplicar é somar parcelas iguais: 3 × 4 = 4 + 4 + 4 = 12."}),
        ("table", {"rows": [["×", "1", "2", "3", "4", "5"], ["6", "6", "12", "18", "24", "30"], ["7", "7", "14", "21", "28", "35"],
                            ["8", "8", "16", "24", "32", "40"], ["9", "9", "18", "27", "36", "45"]]}),
        Q("""1) Quanto é 6 × 7?
a) 36
*b) 42
c) 48
d) 13

2) Quanto é 8 × 5?
*a) 40
b) 45
c) 35
d) 13

3) Marque V ou F:
(V) 9 × 3 = 27
(F) 7 × 8 = 54
(V) 5 × 6 = 30

4) Cada caixa tem 6 lápis. Quantos lápis há em 4 caixas?
Resposta: 4 × 6 = 24 lápis.
Linhas: 3

5) Desenhe 3 grupos com 5 bolinhas e escreva a multiplicação.
Resposta: 3 × 5 = 15.
Linhas: 5"""),
    ], **LIST_META)


def l_acentuacao():
    return _doc("Acentuação gráfica", "Lista de exercícios", "Língua Portuguesa", "6º ano", "Roxo ciência", [
        ("callout", {"style": "dica", "title": "Regras básicas", "text": "**Oxítonas** acentuadas terminam em a(s), e(s), o(s), em(ns): sofá, café, vovô, também. **Proparoxítonas** são todas acentuadas: lâmpada, público."}),
        Q("""1) Qual palavra está acentuada corretamente?
a) cafe
*b) café
c) cáfe
d) cafê

2) Qual palavra é proparoxítona?
a) caderno
b) sofá
*c) lâmpada
d) mesa

3) Marque V ou F:
(V) Todas as proparoxítonas são acentuadas.
(F) "Jabuti" deve ser acentuada.
(V) "Também" é oxítona acentuada.

4) Acentue, quando necessário: medico, pato, voce, arvore, chuva.
Resposta: médico, pato, você, árvore, chuva.
Linhas: 3"""),
    ], **LIST_META)


def l_estados():
    return _doc("Estados físicos da matéria", "Lista de exercícios", "Ciências", "6º ano", "Verde caderno", [
        ("image", {"data": ill_states(), "caption": "Arranjo das partículas nos três estados físicos.", "width": 100}),
        Q("""1) Em qual estado as partículas estão mais organizadas e próximas?
*a) Sólido
b) Líquido
c) Gasoso
d) Em todos é igual

2) Qual é o nome da passagem do estado líquido para o gasoso?
a) Fusão
b) Solidificação
*c) Vaporização
d) Condensação

3) Marque V ou F:
(V) O gelo derretendo é um exemplo de fusão.
(F) A condensação é a passagem do sólido para o líquido.
(V) Gases ocupam todo o espaço disponível.

4) Dê um exemplo do dia a dia em que ocorre condensação.
Resposta: Gotas de água se formando no lado de fora de um copo gelado; espelho embaçado após o banho.
Linhas: 3"""),
    ], **LIST_META)


def l_present():
    return _doc("Simple Present", "Exercises", "Língua Inglesa", "7º ano", "Roxo ciência", [
        ("callout", {"style": "dica", "title": "Remember!", "text": "Com **he/she/it**, o verbo ganha **-s** ou **-es**: she play**s**, he watch**es**. Negativa: don't / doesn't. Pergunta: Do / Does."}),
        Q("""1) Complete: "She ___ to school every day."
a) go
*b) goes
c) going
d) gos

2) Complete: "They ___ like vegetables."
*a) don't
b) doesn't
c) isn't
d) aren't

3) Choose the correct question:
a) Does you play soccer?
*b) Do you play soccer?
c) Are you play soccer?
d) You play soccer do?

4) Write two sentences about your routine.
Resposta: Ex.: I wake up at 6 a.m. I go to school by bus.
Linhas: 3"""),
    ], **LIST_META)


def l_geometria():
    return _doc("Perímetro e área", "Lista de exercícios", "Matemática", "6º ano", "Azul escolar", [
        ("image", {"data": ill_shapes(), "caption": "Figuras planas.", "width": 100}),
        ("callout", {"style": "definicao", "title": "Fórmulas", "text": "Perímetro: soma dos lados. Área do retângulo: base × altura. Área do quadrado: lado × lado. Área do triângulo: (base × altura) ÷ 2."}),
        Q("""1) Qual é a área do retângulo de base 6 cm e altura 4 cm?
a) 10 cm²
b) 20 cm²
*c) 24 cm²
d) 12 cm²

2) Qual é o perímetro de um quadrado de lado 4 cm?
a) 8 cm
*b) 16 cm
c) 12 cm
d) 4 cm

3) Um triângulo tem base 10 cm e altura 6 cm. Calcule sua área.
Resposta: (10 × 6) ÷ 2 = 30 cm².
Linhas: 4

4) Um terreno retangular mede 20 m por 15 m. Quantos metros de cerca são necessários para contorná-lo?
Resposta: Perímetro = 2 × (20 + 15) = 70 m.
Linhas: 4"""),
    ], **LIST_META)


# --------------------------------------------------------------------------- provas
def p_segundo_grau():
    return _doc("Avaliação de Matemática", "Equações do 2º grau", "Matemática", "9º ano", "Grafite", [
        ("callout", {"style": "atencao", "title": "Instruções", "text": "Mostre os cálculos. Fórmula: Δ = b² - 4ac e x = (-b ± √Δ) / 2a. Tempo: 50 minutos."}),
        Q("""1) Quais são as raízes de x² - 5x + 6 = 0?
a) 1 e 6
*b) 2 e 3
c) -2 e -3
d) 5 e 6

2) Na equação x² - 4x + 4 = 0, o valor de Δ é:
*a) 0
b) 4
c) 16
d) -16

3) Marque V ou F:
(V) Se Δ < 0, a equação não tem raízes reais.
(F) Toda equação do 2º grau tem duas raízes reais diferentes.
(V) Em ax² + bx + c = 0, a deve ser diferente de zero.

4) Resolva x² - 9 = 0.
Resposta: x² = 9, logo x = 3 ou x = -3.
Linhas: 4

5) A área de um quadrado é 49 cm². Escreva a equação e encontre a medida do lado.
Resposta: x² = 49, x = 7 cm (a medida negativa não serve).
Linhas: 5"""),
    ], **TEST_META)


def p_grecia():
    return _doc("Avaliação de História", "Grécia Antiga", "História", "6º ano", "Grafite", [
        ("callout", {"style": "atencao", "title": "Instruções", "text": "Leia com atenção e responda com letra legível. Tempo: 45 minutos."}),
        Q("""1) Em qual cidade-estado grega surgiu a democracia?
*a) Atenas
b) Esparta
c) Roma
d) Tebas

2) A educação em Esparta valorizava principalmente:
a) A filosofia
*b) A formação militar
c) O comércio
d) As artes

3) Marque V ou F:
(V) As cidades-estado gregas eram chamadas de pólis.
(F) Na democracia ateniense, mulheres e escravizados votavam.
(V) Os Jogos Olímpicos surgiram na Grécia Antiga.

4) Cite duas heranças da Grécia Antiga presentes no mundo atual.
Resposta: Democracia, filosofia, teatro, Jogos Olímpicos, arquitetura com colunas, palavras de origem grega.
Linhas: 4"""),
    ], **TEST_META)


def p_cartografia():
    return _doc("Avaliação de Geografia", "Cartografia: orientação e escala", "Geografia", "6º ano", "Grafite", [
        ("callout", {"style": "atencao", "title": "Instruções", "text": "Responda às questões. Pode usar régua. Tempo: 45 minutos."}),
        Q("""1) O Sol nasce aproximadamente em qual ponto cardeal?
*a) Leste
b) Oeste
c) Norte
d) Sul

2) Em um mapa com escala 1:100.000, 1 cm representa:
a) 100 m
*b) 1 km
c) 10 km
d) 100 km

3) Marque V ou F:
(V) A legenda explica os símbolos usados no mapa.
(F) A rosa dos ventos indica a escala do mapa.
(V) Latitude e longitude localizam pontos na Terra.

4) Para que serve a escala em um mapa?
Resposta: Indica quantas vezes a área real foi reduzida, permitindo calcular distâncias reais.
Linhas: 4"""),
    ], **TEST_META)


def p_tabela():
    return _doc("Avaliação de Ciências", "Tabela periódica e átomos", "Ciências", "9º ano", "Grafite", [
        ("callout", {"style": "atencao", "title": "Instruções", "text": "Consulte a figura quando necessário. Tempo: 50 minutos."}),
        ("image", {"data": ill_periodic(), "caption": "Alguns elementos da tabela periódica.", "width": 100}),
        Q("""1) Qual é o símbolo do elemento ferro?
a) F
*b) Fe
c) Fr
d) Fo

2) O número atômico indica a quantidade de:
*a) Prótons no núcleo
b) Nêutrons
c) Moléculas
d) Elétrons perdidos

3) Marque V ou F:
(V) O oxigênio tem número atômico 8.
(F) O hélio é um metal.
(V) Os elementos são organizados em ordem crescente de número atômico.

4) Explique a diferença entre prótons, nêutrons e elétrons.
Resposta: Prótons têm carga positiva e ficam no núcleo; nêutrons não têm carga e ficam no núcleo; elétrons têm carga negativa e ficam na eletrosfera.
Linhas: 5"""),
    ], **TEST_META)


def p_figuras():
    return _doc("Avaliação de Língua Portuguesa", "Figuras de linguagem", "Língua Portuguesa", "9º ano", "Grafite", [
        ("callout", {"style": "atencao", "title": "Instruções", "text": "Leia os trechos e responda. Tempo: 50 minutos."}),
        Q("""1) "Seus olhos são duas estrelas." Qual figura de linguagem aparece?
a) Hipérbole
*b) Metáfora
c) Ironia
d) Onomatopeia

2) "Já falei um milhão de vezes!" é exemplo de:
*a) Hipérbole
b) Eufemismo
c) Antítese
d) Metonímia

3) Marque V ou F:
(V) "O vento sussurrava" é uma personificação.
(F) "Tic-tac" é um exemplo de antítese.
(V) A comparação costuma usar "como".

4) Crie uma frase com uma comparação e outra com uma metáfora.
Linhas: 4"""),
    ], **TEST_META)


def p_newton():
    return _doc("Avaliação de Física", "Leis de Newton", "Física", "1º ano EM", "Grafite", [
        ("callout", {"style": "atencao", "title": "Instruções", "text": "Use g = 10 m/s². Mostre os cálculos. Tempo: 50 minutos."}),
        ("image", {"data": ill_forces(), "caption": "Forças atuando sobre um bloco em superfície horizontal.", "width": 100}),
        Q("""1) De acordo com a figura, qual é a força resultante horizontal sobre o bloco?
a) 60 N
*b) 40 N
c) 50 N
d) 10 N

2) Com a resultante da questão 1, qual a aceleração do bloco de 10 kg?
a) 2 m/s²
*b) 4 m/s²
c) 5 m/s²
d) 10 m/s²

3) Marque V ou F:
(V) A 1ª lei de Newton é a lei da inércia.
(F) Ação e reação atuam no mesmo corpo.
(V) F = m · a expressa a 2ª lei de Newton.

4) Explique, com um exemplo do cotidiano, a lei da ação e reação.
Resposta: Ao nadar, empurramos a água para trás e a água nos empurra para frente; ao remar, o remo empurra a água e o barco avança.
Linhas: 4"""),
    ], **TEST_META)


# --------------------------------------------------------------------------- roteiros
def r_feira():
    return _doc("Feira de Ciências", "Roteiro do projeto", "Ciências", "8º ano", "Roxo ciência", [
        ("callout", {"style": "definicao", "title": "Objetivo", "text": "Planejar, executar e apresentar um experimento usando o método científico."}),
        ("heading", {"text": "Etapas do projeto"}),
        ("table", {"rows": [["Semana", "Tarefa", "Entrega"], ["1", "Escolher o tema e a pergunta", "Pergunta de pesquisa"],
                            ["2", "Pesquisar e formular hipótese", "Hipótese escrita"], ["3", "Realizar o experimento", "Fotos e anotações"],
                            ["4", "Analisar os dados", "Gráfico ou tabela"], ["5", "Preparar a apresentação", "Cartaz/slides"]]}),
        ("heading", {"text": "Método científico"}),
        ("bullets", {"items": ["Observação e pergunta", "Hipótese", "Experimento", "Análise dos resultados", "Conclusão"]}),
        ("link", {"label": "Ideias de experimentos simples", "url": "https://www.youtube.com/results?search_query=experimentos+de+ci%C3%AAncias+para+feira", "description": "Vídeos para inspirar o grupo"}),
        ("heading", {"text": "Autoavaliação"}),
        Q("""1) Qual era a pergunta de pesquisa do seu grupo?
Linhas: 3

2) Os resultados confirmaram a hipótese? Explique.
Linhas: 4"""),
    ])


def r_leitura():
    return _doc("Clube do livro", "Roteiro de leitura", "Língua Portuguesa", "7º ano", "Laranja giz", [
        ("callout", {"style": "definicao", "title": "Objetivo", "text": "Desenvolver o hábito de leitura e a compreensão de narrativas, compartilhando impressões com a turma."}),
        ("heading", {"text": "Antes de ler"}),
        ("bullets", {"items": ["Observe a capa e o título: sobre o que deve ser a história?", "Pesquise quem é o autor ou a autora."]}),
        ("heading", {"text": "Durante a leitura"}),
        ("table", {"rows": [["Elemento", "Anotações"], ["Personagens principais", ""], ["Onde se passa", ""], ["Conflito", ""], ["Desfecho", ""]]}),
        ("heading", {"text": "Depois da leitura"}),
        Q("""1) Qual personagem você mais gostou e por quê?
Linhas: 4

2) Se você pudesse mudar o final, como ele seria?
Linhas: 5"""),
        ("link", {"label": "Biblioteca digital de domínio público", "url": "http://www.dominiopublico.gov.br/", "description": "Livros clássicos gratuitos"}),
    ])


def r_museu():
    return _doc("Estudo do meio: visita ao museu", "Roteiro da saída pedagógica", "História", "6º ano", "Vermelho lousa", [
        ("callout", {"style": "atencao", "title": "Combinados", "text": "Fique com o grupo, respeite as regras do museu e não toque nas obras sem autorização."}),
        ("heading", {"text": "Antes da visita"}),
        ("paragraph", {"text": "Pesquise sobre o museu e anote duas perguntas que você gostaria de responder durante a visita."}),
        ("link", {"label": "Ver o museu no mapa", "url": "https://www.google.com/maps/search/?api=1&query=museu", "description": "Localização e rotas"}),
        ("heading", {"text": "Durante a visita"}),
        ("table", {"rows": [["Objeto/obra observado", "Época", "O que me chamou atenção"], ["", "", ""], ["", "", ""], ["", "", ""]]}),
        ("heading", {"text": "Depois da visita"}),
        Q("""1) Que objeto ou obra mais chamou sua atenção? Descreva.
Linhas: 4

2) O que esse objeto nos conta sobre o modo de vida das pessoas da época?
Linhas: 4"""),
    ])


def r_densidade():
    return _doc("Laboratório: densidade", "Roteiro de aula prática", "Ciências", "9º ano", "Azul escolar", [
        ("callout", {"style": "atencao", "title": "Segurança", "text": "Use avental, não prove substâncias e limpe a bancada ao final."}),
        ("heading", {"text": "Materiais"}),
        ("bullets", {"items": ["Copo transparente", "Água, óleo e mel (ou detergente)", "Pequenos objetos: uva, rolha, clipe"]}),
        ("heading", {"text": "Procedimento"}),
        ("bullets", {"items": ["Coloque o mel, depois a água e por último o óleo, devagar.", "Observe as camadas formadas.",
                               "Solte os objetos e anote em qual camada cada um para."]}),
        ("callout", {"style": "definicao", "title": "Conceito", "text": "**Densidade** = massa ÷ volume. Materiais menos densos flutuam sobre os mais densos."}),
        ("video", {"title": "Vídeo: torre de densidade", "url": "https://www.youtube.com/results?search_query=torre+de+densidade+experimento"}),
        ("heading", {"text": "Resultados"}),
        Q("""1) Qual líquido ficou no fundo? Por quê?
Resposta: O mel, por ser o mais denso.
Linhas: 3

2) Em qual camada a rolha parou? O que isso indica sobre a densidade dela?
Resposta: Na superfície/óleo: a rolha é menos densa que os líquidos.
Linhas: 3"""),
    ])


def r_horta():
    return _doc("Projeto horta escolar", "Roteiro interdisciplinar", "Ciências / Matemática", "5º ano", "Verde caderno", [
        ("callout", {"style": "definicao", "title": "Objetivos", "text": "Cultivar uma horta, relacionando conteúdos de Ciências (seres vivos), Matemática (medidas) e Educação Alimentar."}),
        ("heading", {"text": "Planejamento"}),
        ("table", {"rows": [["Planta", "Tempo até a colheita", "Rega"], ["Alface", "45 a 60 dias", "Diária"], ["Rabanete", "25 a 35 dias", "Diária"],
                            ["Cebolinha", "60 a 90 dias", "A cada 2 dias"]]}),
        ("heading", {"text": "Diário de bordo"}),
        ("paragraph", {"text": "Meça a altura das mudas a cada semana com uma régua e registre na tabela abaixo."}),
        ("table", {"rows": [["Semana", "Altura (cm)", "Observações"], ["1", "", ""], ["2", "", ""], ["3", "", ""], ["4", "", ""]]}),
        ("heading", {"text": "Reflexão"}),
        Q("""1) Do que as plantas precisam para crescer?
Resposta: Luz, água, ar (gás carbônico) e nutrientes do solo.
Linhas: 3

2) Por que é importante comer verduras e legumes?
Linhas: 3"""),
    ])


def r_financas():
    return _doc("Educação financeira", "Roteiro de aula: orçamento", "Matemática", "8º ano", "Laranja giz", [
        ("callout", {"style": "definicao", "title": "Objetivo", "text": "Entender o que é um orçamento e planejar gastos de forma consciente."}),
        ("image", {"data": ill_budget(), "caption": "Exemplo de divisão de um orçamento familiar.", "width": 100}),
        ("heading", {"text": "Atividade em grupo"}),
        ("paragraph", {"text": "Com uma renda fictícia de **R$ 3.000,00**, o grupo deve montar um orçamento mensal usando os percentuais do gráfico e discutir onde é possível economizar."}),
        ("table", {"rows": [["Categoria", "%", "Valor (R$)"], ["Moradia", "35", ""], ["Alimentação", "25", ""], ["Transporte", "15", ""],
                            ["Lazer", "10", ""], ["Poupança", "15", ""]]}),
        ("link", {"label": "Cidadania financeira (Banco Central)", "url": "https://www.bcb.gov.br/cidadaniafinanceira", "description": "Materiais oficiais e gratuitos"}),
        ("heading", {"text": "Fechamento"}),
        Q("""1) Quanto o grupo reservaria para poupança, em reais?
Resposta: 15% de 3.000 = R$ 450,00.
Linhas: 2

2) Qual a diferença entre "necessidade" e "desejo" na hora de gastar?
Linhas: 4"""),
    ])


EXTRA = {
    # apostilas
    "digestorio": ("Sistema digestório", "Apostila", "Ciências", "8º ano", "Órgãos, etapas da digestão e órgãos anexos, com atividades.", a_digestorio),
    "revolucao-industrial": ("Revolução Industrial", "Apostila", "História", "8º ano", "Fases, trabalho nas fábricas e reflexão sobre direitos.", a_revolucao),
    "regioes-brasil": ("As regiões do Brasil", "Apostila", "Geografia", "7º ano", "Divisão do IBGE com tabela de estados e QR code.", a_regioes),
    "substantivo-adjetivo": ("Substantivo e adjetivo", "Apostila", "Língua Portuguesa", "6º ano", "Classificação, concordância e exercícios.", a_substantivo),
    "equacoes-1grau": ("Equações do 1º grau", "Apostila", "Matemática", "7º ano", "Conceito, exemplo resolvido passo a passo e problemas.", a_equacoes),
    "cadeia-alimentar": ("Cadeias e teias alimentares", "Apostila", "Ciências", "6º ano", "Fluxo de energia com ilustração da cadeia alimentar.", a_ecologia),
    # listas
    "porcentagem": ("Porcentagem no cotidiano", "Lista de exercícios", "Matemática", "7º ano", "Descontos, aumentos e problemas com gabarito.", l_porcentagem),
    "tabuada": ("Multiplicação e tabuada", "Lista de exercícios", "Matemática", "3º ano", "Tabela de multiplicação e problemas simples.", l_tabuada),
    "acentuacao": ("Acentuação gráfica", "Lista de exercícios", "Língua Portuguesa", "6º ano", "Oxítonas, proparoxítonas e exercícios.", l_acentuacao),
    "estados-materia": ("Estados físicos da matéria", "Lista de exercícios", "Ciências", "6º ano", "Ilustração das partículas e mudanças de estado.", l_estados),
    "simple-present": ("Simple Present", "Lista de exercícios", "Língua Inglesa", "7º ano", "Afirmativa, negativa e perguntas.", l_present),
    "perimetro-area": ("Perímetro e área", "Lista de exercícios", "Matemática", "6º ano", "Figuras planas ilustradas e fórmulas.", l_geometria),
    # provas
    "equacao-2grau": ("Equações do 2º grau", "Avaliação / Prova", "Matemática", "9º ano", "Bhaskara, Δ e problemas.", p_segundo_grau),
    "grecia-antiga": ("Grécia Antiga", "Avaliação / Prova", "História", "6º ano", "Pólis, Atenas, Esparta e heranças gregas.", p_grecia),
    "cartografia": ("Cartografia", "Avaliação / Prova", "Geografia", "6º ano", "Pontos cardeais, escala e coordenadas.", p_cartografia),
    "tabela-periodica": ("Tabela periódica", "Avaliação / Prova", "Ciências", "9º ano", "Elementos, número atômico e estrutura do átomo.", p_tabela),
    "figuras-linguagem": ("Figuras de linguagem", "Avaliação / Prova", "Língua Portuguesa", "9º ano", "Metáfora, hipérbole, personificação e comparação.", p_figuras),
    "leis-newton": ("Leis de Newton", "Avaliação / Prova", "Física", "1º ano EM", "Diagrama de forças, F = m·a e ação e reação.", p_newton),
    # roteiros
    "feira-ciencias": ("Feira de Ciências", "Roteiro com QR codes", "Ciências", "8º ano", "Cronograma, método científico e autoavaliação.", r_feira),
    "clube-livro": ("Clube do livro", "Roteiro com QR codes", "Língua Portuguesa", "7º ano", "Antes, durante e depois da leitura.", r_leitura),
    "visita-museu": ("Visita ao museu", "Roteiro com QR codes", "História", "6º ano", "Saída pedagógica com mapa e ficha de observação.", r_museu),
    "lab-densidade": ("Laboratório: densidade", "Roteiro com QR codes", "Ciências", "9º ano", "Aula prática com vídeo e registro de resultados.", r_densidade),
    "horta-escolar": ("Projeto horta escolar", "Roteiro com QR codes", "Interdisciplinar", "5º ano", "Planejamento, diário de bordo e reflexão.", r_horta),
    "educacao-financeira": ("Educação financeira", "Roteiro com QR codes", "Matemática", "8º ano", "Orçamento com gráfico e atividade em grupo.", r_financas),
}

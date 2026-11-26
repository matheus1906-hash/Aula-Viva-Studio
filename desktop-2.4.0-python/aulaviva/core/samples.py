"""Modelos de amostra reais (conteúdo pronto por disciplina) com ilustrações geradas localmente."""

from __future__ import annotations

import base64
import copy
import io
import math
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFont

from aulaviva.core.config import resource_path
from aulaviva.core.projects import new_block, new_document, sanitize_document
from aulaviva.core.quicklist import parse_questions


# --------------------------------------------------------------------------- ilustrações
def _font(size: int, bold: bool = False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    try:
        return ImageFont.truetype(str(resource_path(f"aulaviva/assets/fonts/{name}")), size)
    except OSError:
        return ImageFont.load_default()


def _png(img: Image.Image) -> str:
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return base64.b64encode(out.getvalue()).decode()


@lru_cache(maxsize=None)
def illus_solar_system() -> str:
    w, h = 1400, 520
    img = Image.new("RGB", (w, h), "#0B1530")
    d = ImageDraw.Draw(img)
    import random

    rnd = random.Random(3)
    for _ in range(260):
        x, y, r = rnd.randint(0, w), rnd.randint(0, h), rnd.choice((1, 1, 1, 2))
        d.ellipse([x, y, x + r, y + r], fill=(255, 255, 255, 180))
    d.ellipse([-160, h / 2 - 220, 120, h / 2 + 220], fill="#FDB813")
    planets = [("Mercúrio", 10, "#B1A9A0"), ("Vênus", 16, "#E6C27A"), ("Terra", 17, "#3B82F6"), ("Marte", 13, "#D9583A"),
               ("Júpiter", 48, "#D9A066"), ("Saturno", 40, "#E8CF8E"), ("Urano", 26, "#7DD3E8"), ("Netuno", 25, "#3D5BD9")]
    x = 190
    f = _font(20)
    for name, r, col in planets:
        x += r + 40
        cy = h / 2
        if name == "Saturno":
            d.ellipse([x - r * 1.9, cy - r * 0.45, x + r * 1.9, cy + r * 0.45], outline="#CDB57A", width=5)
        d.ellipse([x - r, cy - r, x + r, cy + r], fill=col)
        tw = d.textlength(name, font=f)
        d.text((x - tw / 2, cy + r + 18 if planets.index((name, r, col)) % 2 == 0 else cy - r - 42), name, fill="white", font=f)
        x += r + 40
    d.text((24, 18), "Sistema Solar (tamanhos e distâncias fora de escala)", fill="#C7D2FE", font=_font(22))
    return _png(img)


@lru_cache(maxsize=None)
def illus_fractions() -> str:
    w, h = 1400, 430
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)
    items = [(1, 2, "#F59E0B"), (1, 4, "#3B82F6"), (3, 4, "#10B981"), (2, 3, "#EF4444"), (5, 8, "#8B5CF6")]
    f, fb = _font(30), _font(40, True)
    for i, (num, den, col) in enumerate(items):
        cx, cy, r = 140 + i * 280, 180, 110
        for k in range(den):
            start, end = -90 + k * 360 / den, -90 + (k + 1) * 360 / den
            d.pieslice([cx - r, cy - r, cx + r, cy + r], start, end, fill=col if k < num else "#F3F4F6", outline="#374151", width=3)
        label = f"{num}/{den}"
        d.text((cx - d.textlength(label, font=fb) / 2, cy + r + 30), label, fill="#111827", font=fb)
    d.text((20, 10), "Representações de frações", fill="#4B5563", font=f)
    return _png(img)


@lru_cache(maxsize=None)
def illus_water_cycle() -> str:
    w, h = 1400, 620
    img = Image.new("RGB", (w, h), "#E0F2FE")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 460, w, h], fill="#2563EB")                      # mar
    d.polygon([(780, 460), (1000, 180), (1220, 460)], fill="#6B7280")  # montanha
    d.polygon([(1000, 180), (1060, 260), (940, 260)], fill="white")
    d.ellipse([60, 40, 220, 200], fill="#FBBF24")                     # sol
    for cx in (520, 900):                                              # nuvens
        for dx, dy, r in ((0, 0, 60), (60, -20, 70), (130, 0, 60)):
            d.ellipse([cx + dx - r, 120 + dy - r, cx + dx + r, 120 + dy + r], fill="white")
    for x in range(880, 1060, 30):                                     # chuva
        d.line([x, 200, x - 15, 260], fill="#3B82F6", width=4)
    f = _font(30, True)

    def arrow(p1, p2, text, tpos):
        d.line([p1, p2], fill="#1E3A8A", width=6)
        ang = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
        for s in (2.6, -2.6):
            d.line([p2, (p2[0] + 28 * math.cos(ang + s), p2[1] + 28 * math.sin(ang + s))], fill="#1E3A8A", width=6)
        d.text(tpos, text, fill="#1E3A8A", font=f)

    arrow((330, 440), (430, 200), "1. Evaporação", (150, 300))
    arrow((640, 120), (780, 120), "2. Condensação", (560, 30))
    arrow((1000, 290), (1000, 400), "3. Precipitação", (1030, 320))
    arrow((1150, 470), (700, 520), "4. Escoamento", (760, 535))
    return _png(img)


# --------------------------------------------------------------------------- montagem
def _doc(title, subtitle, subject, level, theme, blocks, **meta):
    d = new_document(title)
    d["meta"].update(subtitle=subtitle, subject=subject, level=level, theme=theme, **meta)
    d["blocks"] = []
    for item in blocks:
        if isinstance(item, list):
            d["blocks"].extend(item)
            continue
        kind, values = item
        b = new_block(kind)
        b.update(values)
        d["blocks"].append(b)
    return sanitize_document(d)


def _solar():
    return _doc("O Sistema Solar", "Planetas, Sol e movimentos da Terra", "Ciências", "6º ano", "Azul escolar", [
        ("callout", {"style": "definicao", "title": "Objetivos da aula",
                     "text": "Identificar os componentes do Sistema Solar, comparar os planetas rochosos e gasosos e "
                             "relacionar os movimentos da Terra com o dia, a noite e as estações do ano."}),
        ("heading", {"text": "O que é o Sistema Solar?"}),
        ("paragraph", {"text": "O **Sistema Solar** é formado pelo **Sol**, uma estrela, e por todos os corpos que giram ao seu redor: "
                               "oito planetas, planetas-anões, luas, asteroides e cometas. O Sol concentra mais de 99% de toda a massa "
                               "do sistema, e é sua gravidade que mantém os planetas em órbita."}),
        ("image", {"data": illus_solar_system(), "caption": "Figura 1 - Os oito planetas do Sistema Solar.", "width": 100}),
        ("heading", {"text": "Planetas rochosos e gasosos"}),
        ("table", {"rows": [["Grupo", "Planetas", "Características"],
                            ["Rochosos", "Mercúrio, Vênus, Terra, Marte", "Menores, superfície sólida, mais próximos do Sol"],
                            ["Gasosos", "Júpiter, Saturno, Urano, Netuno", "Muito grandes, formados principalmente por gases, possuem anéis"]]}),
        ("callout", {"style": "curiosidade", "title": "Você sabia?",
                     "text": "Um dia em Vênus dura mais do que um ano em Vênus: o planeta leva 243 dias terrestres para girar em "
                             "torno de si mesmo e cerca de 225 dias para dar uma volta no Sol."}),
        ("heading", {"text": "Os movimentos da Terra"}),
        ("bullets", {"items": ["**Rotação:** a Terra gira em torno de si mesma em cerca de 24 horas, originando o dia e a noite.",
                               "**Translação:** a Terra dá uma volta completa ao redor do Sol em aproximadamente 365 dias e 6 horas.",
                               "A inclinação do eixo terrestre, junto com a translação, explica as **estações do ano**."]}),
        ("qrcode", {"url": "https://pt.wikipedia.org/wiki/Sistema_Solar", "caption": "Leia mais sobre o Sistema Solar", "size": 30}),
        ("heading", {"text": "Atividades"}),
        parse_questions("""1) Qual é a estrela do Sistema Solar?
a) A Lua
*b) O Sol
c) Júpiter
d) Polaris

2) Marque V ou F:
(V) Júpiter é o maior planeta do Sistema Solar.
(F) Marte é um planeta gasoso.
(V) A rotação da Terra origina o dia e a noite.

3) Explique a diferença entre os movimentos de rotação e translação da Terra.
Resposta: Rotação é o giro da Terra em torno de si mesma (cerca de 24 h, dia e noite); translação é a volta ao redor do Sol (cerca de 365 dias).
Linhas: 5"""),
    ])


def _fractions():
    return _doc("Frações no dia a dia", "Lista de exercícios", "Matemática", "6º ano", "Laranja giz", [
        ("callout", {"style": "atencao", "title": "Instruções", "text": "Resolva as questões. Você pode marcar e escrever as respostas diretamente neste PDF."}),
        ("image", {"data": illus_fractions(), "caption": "Cada pizza foi dividida em partes iguais; a parte colorida representa a fração.", "width": 100}),
        parse_questions("""1) Uma pizza foi dividida em 8 pedaços iguais e João comeu 3. Que fração da pizza ele comeu?
a) 3/5
*b) 3/8
c) 5/8
d) 8/3

2) Qual fração é equivalente a 1/2?
a) 2/3
b) 3/5
*c) 4/8
d) 1/4

3) Marque V ou F:
(V) 2/4 e 1/2 representam a mesma quantidade.
(F) 1/3 é maior que 1/2.
(V) Em 3/4, o número 4 é o denominador.

4) Maria leu 2/5 de um livro na segunda-feira e 1/5 na terça. Que fração do livro ela já leu?
a) 3/10
*b) 3/5
c) 2/10
d) 1/5

5) Desenhe ou explique como representar a fração 3/4 usando uma barra de chocolate.
Resposta: Dividir a barra em 4 partes iguais e pintar 3 delas.
Linhas: 4

6) Uma turma tem 30 alunos e 1/3 deles usa óculos. Quantos alunos usam óculos? Mostre o cálculo.
Resposta: 30 ÷ 3 = 10 alunos.
Linhas: 4"""),
    ], cover=False, toc=False, student_fields=True, answer_key=True)


def _fable_test():
    return _doc("Avaliação de Língua Portuguesa", "Interpretação de texto: fábula", "Língua Portuguesa", "5º ano", "Grafite", [
        ("callout", {"style": "atencao", "title": "Instruções", "text": "Leia o texto com atenção antes de responder. Tempo sugerido: 50 minutos."}),
        ("heading", {"text": "A Cigarra e a Formiga (adaptação da fábula de Esopo)", "level": 2}),
        ("paragraph", {"text": "Durante todo o verão, a cigarra cantava alegremente sob as árvores, enquanto a formiga trabalhava sem "
                               "parar, carregando grãos para o formigueiro.\n\n— Por que você não descansa e canta comigo? — perguntou a cigarra.\n"
                               "— Estou guardando comida para o inverno — respondeu a formiga.\n\nQuando o inverno chegou, a cigarra não tinha "
                               "o que comer. Faminta, bateu à porta do formigueiro e pediu ajuda. A formiga, lembrando-se do verão, "
                               "dividiu sua comida e disse: — Agora você sabe que é preciso se preparar para os tempos difíceis."}),
        parse_questions("""1) Quem são os personagens principais da fábula?
a) A cigarra e o grilo
*b) A cigarra e a formiga
c) A formiga e a abelha
d) O verão e o inverno

2) Por que a formiga trabalhava durante o verão?
a) Porque não sabia cantar
b) Porque estava brincando
*c) Para guardar comida para o inverno
d) Para ajudar a cigarra

3) Marque V ou F de acordo com o texto:
(F) A cigarra trabalhou durante todo o verão.
(V) No inverno, a cigarra ficou sem comida.
(V) A formiga dividiu sua comida com a cigarra.

4) Qual é a moral (ensinamento) da fábula? Escreva com suas palavras.
Resposta: É importante se planejar e trabalhar pensando no futuro (e também ajudar quem precisa).
Linhas: 5

5) Você concorda com a atitude da formiga no final? Justifique.
Linhas: 5"""),
    ], cover=False, toc=False, student_fields=True, answer_key=True)


def _water_route():
    return _doc("O ciclo da água", "Roteiro de aula com QR codes", "Ciências / Geografia", "5º ano", "Verde caderno", [
        ("callout", {"style": "definicao", "title": "Objetivo", "text": "Compreender as etapas do ciclo da água e sua importância para a vida no planeta."}),
        ("heading", {"text": "Antes da aula"}),
        ("paragraph", {"text": "Escaneie o QR code abaixo e leia sobre o ciclo da água. Anote no caderno uma palavra nova que você aprendeu."}),
        ("qrcode", {"url": "https://pt.wikipedia.org/wiki/Ciclo_hidrol%C3%B3gico", "caption": "Leitura: o ciclo hidrológico", "size": 30}),
        ("heading", {"text": "Durante a aula"}),
        ("image", {"data": illus_water_cycle(), "caption": "Figura 1 - Etapas do ciclo da água.", "width": 100}),
        ("bullets", {"items": ["**Evaporação:** o calor do Sol transforma a água de rios e mares em vapor.",
                               "**Condensação:** o vapor esfria nas camadas altas da atmosfera e forma as nuvens.",
                               "**Precipitação:** a água volta à superfície como chuva, neve ou granizo.",
                               "**Escoamento e infiltração:** a água escorre para rios e mares ou se infiltra no solo."]}),
        ("callout", {"style": "dica", "title": "Experimento em sala", "text": "Coloque água quente em um pote, cubra com filme plástico e "
                     "ponha gelo por cima. Observe as gotas se formando: é a condensação acontecendo!"}),
        ("video", {"title": "Vídeos sobre o ciclo da água", "url": "https://www.youtube.com/results?search_query=ciclo+da+%C3%A1gua+para+crian%C3%A7as"}),
        ("heading", {"text": "Depois da aula"}),
        parse_questions("""1) Em qual etapa do ciclo a água passa do estado líquido para o gasoso?
*a) Evaporação
b) Condensação
c) Precipitação
d) Infiltração

2) Por que o ciclo da água é importante para os seres vivos?
Resposta: Porque renova e distribui a água doce que usamos para beber, plantar e manter os ecossistemas.
Linhas: 4"""),
    ])


def _colonial_history():
    return _doc("Brasil Colônia", "Economia, sociedade e trabalho (1500-1822)", "História", "7º ano", "Vermelho lousa", [
        ("callout", {"style": "definicao", "title": "Objetivos", "text": "Compreender a organização do Brasil colonial, os ciclos econômicos "
                     "e as relações de trabalho, reconhecendo a violência da escravidão de indígenas e africanos."}),
        ("heading", {"text": "A ocupação do território"}),
        ("paragraph", {"text": "Após a chegada dos portugueses em 1500, a exploração inicial concentrou-se no **pau-brasil**. A partir de 1530, "
                               "Portugal passou a ocupar efetivamente o território, criando as **capitanias hereditárias** (1534) e, depois, "
                               "o **Governo-Geral** (1549), com sede em Salvador."}),
        ("heading", {"text": "Linha do tempo"}),
        ("table", {"rows": [["Ano", "Acontecimento"], ["1500", "Chegada da esquadra de Pedro Álvares Cabral"],
                            ["1534", "Criação das capitanias hereditárias"], ["1549", "Instalação do Governo-Geral em Salvador"],
                            ["Séc. XVII", "Auge da produção de açúcar no Nordeste"], ["Séc. XVIII", "Ciclo do ouro em Minas Gerais"],
                            ["1808", "Chegada da família real portuguesa"], ["1822", "Independência do Brasil"]]}),
        ("heading", {"text": "Trabalho e sociedade"}),
        ("paragraph", {"text": "A economia colonial baseou-se no **trabalho escravizado**. Povos indígenas foram escravizados e milhões de "
                               "africanos foram trazidos à força pelo tráfico atlântico. Houve muita **resistência**: fugas, revoltas e a "
                               "formação de quilombos, como o de **Palmares**, liderado por Zumbi."}),
        ("callout", {"style": "importante", "title": "Para refletir", "text": "Que marcas desse período ainda existem na sociedade brasileira atual?"}),
        ("heading", {"text": "Atividades"}),
        parse_questions("""1) Qual foi o primeiro produto explorado pelos portugueses no Brasil?
a) Açúcar
*b) Pau-brasil
c) Ouro
d) Café

2) Marque V ou F:
(V) Palmares foi um importante quilombo liderado por Zumbi.
(F) As capitanias hereditárias foram criadas em 1822.
(V) O ciclo do ouro ocorreu principalmente em Minas Gerais.

3) Cite duas formas de resistência à escravidão no Brasil colonial.
Resposta: Fugas, formação de quilombos, revoltas, preservação da cultura e da religião.
Linhas: 4"""),
    ])


def _english():
    return _doc("Verb to be", "Exercises - Lista de exercícios de inglês", "Língua Inglesa", "6º ano", "Roxo ciência", [
        ("callout", {"style": "dica", "title": "Remember!", "text": "I **am** · You **are** · He/She/It **is** · We/You/They **are**"}),
        ("table", {"rows": [["Afirmativa", "Negativa", "Interrogativa"], ["I am a student.", "I am not a teacher.", "Am I late?"],
                            ["She is happy.", "She is not (isn't) sad.", "Is she at school?"], ["They are friends.", "They are not (aren't) here.", "Are they ready?"]]}),
        parse_questions("""1) Complete: "My mother ___ a doctor."
a) am
*b) is
c) are
d) be

2) Complete: "We ___ in the classroom."
a) is
b) am
*c) are
d) be

3) Mark T (true) or F (false):
(V) "I are happy" is wrong.
(F) "They is students" is correct.
(V) "Is he your brother?" is a question.

4) Write two sentences about you using the verb to be.
Resposta: Ex.: I am eleven years old. I am from Brazil.
Linhas: 3"""),
    ], cover=False, toc=False, student_fields=True, answer_key=True)


# chave -> (título, tipo, disciplina, ano, descrição, construtor)
SAMPLES = {
    "sistema-solar": ("O Sistema Solar", "Apostila", "Ciências", "6º ano",
                      "Apostila completa com ilustração, tabela, curiosidades, QR code e atividades com gabarito.", _solar),
    "fracoes": ("Frações no dia a dia", "Lista de exercícios", "Matemática", "6º ano",
                "6 questões contextualizadas (múltipla escolha, V/F e abertas) com ilustração de frações.", _fractions),
    "fabula": ("Interpretação: A Cigarra e a Formiga", "Avaliação / Prova", "Língua Portuguesa", "5º ano",
               "Prova de interpretação com texto, questões objetivas e discursivas e gabarito.", _fable_test),
    "ciclo-agua": ("O ciclo da água", "Roteiro com QR codes", "Ciências / Geografia", "5º ano",
                   "Roteiro antes/durante/depois da aula com QR code, vídeo, experimento e ilustração.", _water_route),
    "brasil-colonia": ("Brasil Colônia", "Apostila", "História", "7º ano",
                       "Linha do tempo, textos, reflexão crítica e atividades.", _colonial_history),
    "verb-to-be": ("Verb to be", "Lista de exercícios", "Língua Inglesa", "6º ano",
                   "Quadro-resumo e exercícios de fixação com gabarito.", _english),
}


def _register_extra():
    from aulaviva.core.samples_extra import EXTRA

    SAMPLES.update(EXTRA)


_register_extra()


def sample_pdf(key: str) -> bytes:
    """PDF de prévia de um modelo (executado no processo auxiliar)."""
    from aulaviva.core.pdf_builder import build_pdf

    return build_pdf(_cached(key), preview=True)


def sample_document(key: str) -> dict:
    return copy.deepcopy(_cached(key))


@lru_cache(maxsize=None)
def _cached(key: str) -> dict:
    return SAMPLES[key][5]()

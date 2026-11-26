from aulaviva.core.quicklist import EXAMPLE, parse_questions, summarize


def test_example_parses():
    b = parse_questions(EXAMPLE)
    assert [x["type"] for x in b] == ["callout", "choice_question", "true_false", "open_question"]
    assert b[1]["correct"] == 1 and b[1]["options"][1] == "56"
    assert b[2]["answers"] == [True, False]
    assert b[3]["lines"] == 5 and b[3]["answer"].startswith("Processo")


def test_numbering_without_blank_lines_and_variants():
    text = "1. Qual a capital do Brasil?\nA) Rio\nB) Brasília (correta)\n2- Cite dois rios.\nQuestão 3: Defina célula\nGabarito: unidade da vida"
    b = parse_questions(text)
    assert [x["type"] for x in b] == ["choice_question", "open_question", "open_question"]
    assert b[0]["correct"] == 1
    assert b[2]["answer"] == "unidade da vida"
    assert "múltipla" in summarize(b)


def test_answer_letter_and_heading():
    b = parse_questions("# Frações\n1) Metade de 10?\na) 2\nb) 5\nResposta: b")
    assert b[0]["type"] == "heading" and b[1]["correct"] == 1


def test_true_false_starting_with_F_is_not_option_f():
    b = parse_questions("3) Marque V ou F:\n(F) A cigarra trabalhou.\n(V) A formiga guardou comida.\n[F] Outra.\nF: Mais uma.")
    assert b[0]["type"] == "true_false" and b[0]["answers"] == [False, True, False, False]
    b = parse_questions("1) Escolha:\na) um\nb) dois\nc) três\nd) quatro\ne) cinco\nf) seis")
    assert b[0]["type"] == "choice_question" and len(b[0]["options"]) == 6

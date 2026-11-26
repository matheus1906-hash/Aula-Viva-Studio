"""Lista rápida: transforma questões digitadas em texto simples em blocos.

Formato aceito (flexível, do jeito que o professor já escreve):

    # Título de seção              -> título
    > Leia com atenção.            -> destaque de instruções

    1) Quanto é 2 + 2?             -> múltipla escolha
    a) 3
    *b) 4                          (* ou (x) ou ✓ marca a correta)
    c) 5

    2) Marque V ou F:              -> verdadeiro ou falso
    (V) O Sol é uma estrela.
    (F) A Lua tem luz própria.

    3) Explique a fotossíntese.    -> pergunta aberta
    Resposta: processo em que...   (opcional, vai para o gabarito)
    Linhas: 6                      (opcional)

Questões são separadas por linha em branco ou por nova numeração.
"""

from __future__ import annotations

import re
from collections import Counter

from aulaviva.core.projects import new_block

_NUM_RE = re.compile(r"^\s*(?:quest[ãa]o\s*)?(\d{1,3})\s*[).:\-–]\s*(.*)$", re.IGNORECASE)
_OPT_RE = re.compile(r"^\s*(\*|\(x\)|\[x\])?\s*\(?([a-hA-H])\s*[).]\s+(.+?)\s*(\*|✓|\(correta\)|\[correta\])?\s*$")
_TF_RE = re.compile(r"^\s*[(\[]?\s*([VvFf])\s*[)\]:\-–]\s*(.+)$")
# "(V) ..." / "[F] ..." / "V: ..." são sempre verdadeiro/falso (não a alternativa "f)")
_TF_STRICT_RE = re.compile(r"^\s*(?:[(\[]\s*([VvFf])\s*[)\]]|([VvFf])\s*[:\-–])\s+(.+)$")
_ANS_RE = re.compile(r"^\s*(?:resposta|gabarito)\s*:\s*(.+)$", re.IGNORECASE)
_LINES_RE = re.compile(r"^\s*linhas\s*:\s*(\d{1,2})\s*$", re.IGNORECASE)


def _chunks(text: str) -> list[list[str]]:
    chunks: list[list[str]] = []
    cur: list[str] = []
    for raw in text.replace("\r\n", "\n").split("\n"):
        line = raw.rstrip()
        if not line.strip():
            if cur:
                chunks.append(cur)
                cur = []
            continue
        starts_new = bool(_NUM_RE.match(line)) or line.lstrip().startswith(("#", ">"))
        if starts_new and cur and not _OPT_RE.match(line):
            chunks.append(cur)
            cur = []
        cur.append(line)
    if cur:
        chunks.append(cur)
    return chunks


def parse_questions(text: str, max_blocks: int = 200) -> list[dict]:
    blocks: list[dict] = []
    for chunk in _chunks(text or ""):
        if len(blocks) >= max_blocks:
            break
        first = chunk[0].strip()
        if first.startswith("#"):
            b = new_block("heading")
            b["text"] = first.lstrip("#").strip()[:200] or "Seção"
            b["level"] = 2 if first.startswith("##") else 1
            blocks.append(b)
            if len(chunk) > 1:
                blocks.extend(parse_questions("\n".join(chunk[1:])))
            continue
        if first.startswith(">"):
            b = new_block("callout")
            b["style"], b["title"] = "atencao", "Instruções"
            b["text"] = "\n".join(ln.strip().lstrip(">").strip() for ln in chunk)[:4000]
            blocks.append(b)
            continue
        m = _NUM_RE.match(first)
        prompt_lines = [m.group(2) if m else first]
        options, correct, statements, answers, answer, lines = [], -1, [], [], "", None
        for ln in chunk[1:]:
            if (ts := _TF_STRICT_RE.match(ln)) and not options:
                statements.append(ts.group(3).strip())
                answers.append((ts.group(1) or ts.group(2)).upper() == "V")
            elif (om := _OPT_RE.match(ln)) and not statements:
                if om.group(1) or om.group(4):
                    correct = len(options)
                options.append(om.group(3).strip())
            elif (tm := _TF_RE.match(ln)) and not options:
                statements.append(tm.group(2).strip())
                answers.append(tm.group(1).upper() == "V")
            elif am := _ANS_RE.match(ln):
                answer = am.group(1).strip()
            elif lm := _LINES_RE.match(ln):
                lines = int(lm.group(1))
            elif not options and not statements:
                prompt_lines.append(ln.strip())
        prompt = " ".join(p for p in prompt_lines if p).strip()[:2000]
        if len(options) >= 2:
            b = new_block("choice_question")
            b["prompt"], b["options"], b["correct"] = prompt, options[:8], correct if correct < 8 else -1
            if correct < 0 and answer:
                letter = answer.strip()[:1].upper()
                if "A" <= letter <= "H" and ord(letter) - 65 < len(options):
                    b["correct"] = ord(letter) - 65
        elif statements:
            b = new_block("true_false")
            b["statements"], b["answers"] = statements[:15], answers[:15]
        else:
            b = new_block("open_question")
            b["prompt"], b["answer"] = prompt, answer[:4000]
            b["lines"] = max(1, min(lines or 4, 20))
        blocks.append(b)
    return blocks


def summarize(blocks: list[dict]) -> str:
    names = {"choice_question": "múltipla escolha", "true_false": "verdadeiro/falso", "open_question": "aberta(s)",
             "heading": "título(s)", "callout": "instrução(ões)"}
    c = Counter(b["type"] for b in blocks)
    if not c:
        return "Nenhuma questão reconhecida ainda."
    return "Reconhecido: " + ", ".join(f"{n} {names.get(t, t)}" for t, n in c.items())


EXAMPLE = """> Leia cada questão com atenção.

1) Quanto é 7 × 8?
a) 54
*b) 56
c) 58
d) 64

2) Marque V ou F:
(V) O Sol é uma estrela.
(F) A Lua tem luz própria.

3) Explique, com suas palavras, o que é fotossíntese.
Resposta: Processo em que as plantas produzem alimento usando luz, água e gás carbônico.
Linhas: 5"""

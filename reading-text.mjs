// Reflow printed lines while preserving verse, headings and substantial paragraph breaks.
export function readingText(raw, book) {
  let text = raw.replace(/\r\n?/g, "\n").replace(/\f/g, "\n\n").replace(/\u00ad/g, "");
  const header = /^\*{3}\s*START OF [\s\S]{5,650}?\*{3}[ \t]*$/im.exec(text);
  if (header && header.index < 5000) {
    const end = header.index + header[0].length;
    text = text.slice(end).trimStart() + "\n\n" + text.slice(0, end);
  }
  // Keep the edition's preliminary pages available after the narrative.
  const starts = {
    "domcasmurro_1899": /^I\s*\n+Do titulo\./m,
    "3449803": /^I\s*\n+Luiz Garcia transpunha/m
  };
  const beginning = starts[book.id]?.exec(text);
  if (beginning) text = text.slice(beginning.index) + "\n\n" + text.slice(0, beginning.index);
  const verse = /Cantos|Timbiras|Pássaro Cativo|Lira dos Vinte|Dit[ti]+es|Ballads|Poems|Verses|Songs from|Rimas|Lusíadas|Prosas Profanas/i.test(book.title);
  return text.trim().split(/\n[ \t]*\n(?:[ \t]*\n)*/).map(block => {
    const lines = block.split("\n").map(line => line.trim().replace(/[\t ]{2,}/g, " "));
    if (verse) return lines.join("\n");
    let result = lines[0];
    for (let i = 1; i < lines.length; i++) {
      const previous = lines[i - 1];
      const wrap = previous.length > 40 && /\p{Ll}/u.test(previous);
      result += (wrap ? " " : "\n") + lines[i];
    }
    return result;
  }).join("\n\n").trim();
}

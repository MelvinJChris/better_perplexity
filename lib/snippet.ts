// Provider snippets (especially Exa page text) contain markdown, so rendering
// them verbatim leaks "### Conclusion", "**bold**", and link syntax into the UI.
// cleanSnippet strips that for display only; snippets stay raw for embedding and
// metric extraction. Pure, so it is unit-tested (#61).

export function cleanSnippet(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/^[>\s]*#{1,6}\s+/gm, '') // heading markers at line start
    .replace(/[#*_`>]+/g, ' ') // stray markdown markers
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

/** A clean card preview: cleaned, then cut to the last sentence boundary within
 *  `maxChars` (falling back to a word boundary plus an ellipsis), so the preview
 *  reads as a complete thought instead of a hard mid-word cut. */
export function previewSnippet(text: string, maxChars = 220): string {
  const clean = cleanSnippet(text);
  if (clean.length <= maxChars) return clean;

  const slice = clean.slice(0, maxChars);
  const sentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );
  if (sentenceEnd >= maxChars * 0.5) return slice.slice(0, sentenceEnd + 1);

  const wordEnd = slice.lastIndexOf(' ');
  return `${(wordEnd > 0 ? slice.slice(0, wordEnd) : slice).trimEnd()}…`;
}

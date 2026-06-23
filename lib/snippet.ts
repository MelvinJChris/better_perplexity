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

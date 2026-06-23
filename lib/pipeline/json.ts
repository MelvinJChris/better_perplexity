/** Pulls a JSON object substring out of a model response, tolerating code
 *  fences and surrounding prose. Returns the best-effort JSON text for parsing. */
export function extractJsonObject(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  return first >= 0 && last > first ? t.slice(first, last + 1) : t;
}

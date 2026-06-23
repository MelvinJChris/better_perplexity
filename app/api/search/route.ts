import { geminiFromEnv, type GeminiProvider } from '@/lib/providers/gemini';
import { searchProviderFromEnv } from '@/lib/providers/search';
import { ndjsonStream, runSearchEvents, searchRequestSchema } from '@/lib/pipeline/runSearch';

// The pipeline endpoint: POST a query, receive a streamed NDJSON response
// (sources, then answer tokens, then a trace). Stateless and retry-safe; all
// state lives in the request, never in instance memory (see CLAUDE.md).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Request body must be valid JSON', 400);
  }

  const parsed = searchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Body must be { "query": string }', 400);
  }

  let llm: GeminiProvider;
  try {
    llm = geminiFromEnv();
  } catch {
    return jsonError('Server is missing required API keys', 500);
  }
  const search = searchProviderFromEnv(llm);

  const events = runSearchEvents(parsed.data.query, {
    search,
    llm,
    synthesisModel: llm.synthesisModel,
    context: parsed.data.context,
  });

  return new Response(ndjsonStream(events), {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

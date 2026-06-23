// Per-query trace: what a single request retrieved and spent. Logged as one
// structured JSON line (Cloud Logging parses it) and also streamed to the client
// so cost and latency are visible. Full cost-per-query accounting lands in #17.

export interface QueryTrace {
  query: string;
  sourceCount: number;
  synthesisModel: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/** Emits the trace as a single structured log line. */
export function logTrace(trace: QueryTrace): void {
  console.log(JSON.stringify({ type: 'query_trace', ...trace }));
}

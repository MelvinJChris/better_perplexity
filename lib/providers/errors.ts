/** Error raised by an external provider (LLM or search). Carries the HTTP
 *  status when there was a response, so the rate-limit queue can decide whether
 *  the failure is transient and worth retrying. */
export class ProviderError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

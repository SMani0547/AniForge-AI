export class AiProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

/** Never include an SDK error message: it can contain request URLs or credentials. */
export function safeProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  const details = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const status = Number(details.status ?? details.code);
  if (status === 402) {
    return new AiProviderError('AI_BILLING_REQUIRED', 'Google AI requires payment. Check the API project billing status and available balance in Google AI Studio. Eligible Cloud credits may still require an active Prepay balance.');
  }
  if (status === 429) {
    return new AiProviderError('AI_RATE_LIMITED', 'Google AI quota or rate limit reached. Check paid-tier quota in AI Studio and retry later.', true);
  }
  if (status === 401 || status === 403) {
    return new AiProviderError('AI_ACCESS_DENIED', 'Google AI denied access. Check the server API key, billing, model entitlement, region, and API restrictions.');
  }
  if (status === 404) {
    return new AiProviderError('AI_MODEL_UNAVAILABLE', 'The model or prior interaction is unavailable to this API project. Verify model access and interaction retention in AI Studio.');
  }
  if (status === 400) {
    return new AiProviderError('AI_REQUEST_REJECTED', 'Google AI rejected the request. Check supported model inputs, content restrictions, and current official API documentation.');
  }
  if (details.name === 'AbortError' || details.name === 'APIConnectionTimeoutError') {
    return new AiProviderError('AI_TIMEOUT', 'Google AI timed out. The provider may still finish and charge for this request; inspect AI Studio before retrying.');
  }
  if (status >= 500 && status < 600) {
    return new AiProviderError('AI_UNAVAILABLE', 'Google AI is temporarily unavailable. The request may already be billed; inspect AI Studio before submitting again.', true);
  }
  return new AiProviderError('AI_REQUEST_FAILED', 'The Google AI request failed. Check network access and server configuration. No successful result was recorded.');
}

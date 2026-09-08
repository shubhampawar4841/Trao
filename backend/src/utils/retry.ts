export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 4
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      const isRateLimit =
        error?.status === 429;

      const isTemporary =
        isRateLimit ||
        error?.status === 500 ||
        error?.status === 502 ||
        error?.status === 503 ||
        error?.status === 504;

      if (!isTemporary || attempt === maxAttempts) {
        throw error;
      }

      let waitMs = 2000 * Math.pow(2, attempt - 1);

      const retryAfter =
        error?.headers?.get?.("retry-after");

      if (retryAfter) {
        const seconds = Number(retryAfter);

        if (!Number.isNaN(seconds)) {
          waitMs = Math.max(
            waitMs,
            seconds * 1000 + 1000
          );
        }
      }

      console.log(
        `LLM temporarily unavailable/rate-limited. Retrying in ${Math.ceil(
          waitMs / 1000
        )}s... (${attempt}/${maxAttempts})`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, waitMs)
      );
    }
  }

  throw lastError;
}

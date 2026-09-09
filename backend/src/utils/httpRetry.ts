export async function withHttpRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      const status =
        error?.response?.status ??
        error?.status;

      const code = error?.code;

      const retryableStatus = [
        429,
        500,
        502,
        503,
        504,
      ].includes(status);

      const retryableNetwork = [
        "ECONNRESET",
        "ETIMEDOUT",
        "ECONNABORTED",
      ].includes(code);

      if (
        (!retryableStatus &&
          !retryableNetwork) ||
        attempt === maxAttempts
      ) {
        throw error;
      }

      let waitMs =
        750 *
        Math.pow(2, attempt - 1);

      const retryAfter =
        error?.response?.headers?.[
          "retry-after"
        ];

      if (retryAfter) {
        const seconds =
          Number(retryAfter);

        if (
          !Number.isNaN(seconds)
        ) {
          waitMs = Math.max(
            waitMs,
            seconds * 1000
          );
        }
      }

      console.warn(
        `HTTP request failed temporarily. Retrying in ${Math.ceil(
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

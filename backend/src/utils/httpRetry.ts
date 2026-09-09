import axios from "axios";

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
    } catch (error) {
      lastError = error;

      if (!axios.isAxiosError(error)) {
        throw error;
      }

      const status =
        error.response?.status;

      const code = error.code;

      const retryable =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        code === "ECONNRESET" ||
        code === "ETIMEDOUT" ||
        code === "ECONNABORTED";

      if (
        !retryable ||
        attempt === maxAttempts
      ) {
        throw error;
      }

      let waitMs =
        750 *
        Math.pow(
          2,
          attempt - 1
        );

      const retryAfter =
        error.response?.headers?.[
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
        `HTTP request failed. Retrying in ${waitMs}ms (${attempt}/${maxAttempts})`
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            waitMs
          )
      );
    }
  }

  throw lastError;
}

/**
 * Detect Groq / provider failures where structured JSON
 * was cut off before it became valid.
 */
export function isStructuredOutputTruncation(
  error: unknown
): boolean {
  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
  }

  const anyError = error as {
    error?: { message?: string; code?: string };
    message?: string;
    body?: string;
  };

  if (anyError?.error?.message) {
    parts.push(anyError.error.message);
  }

  if (anyError?.error?.code) {
    parts.push(anyError.error.code);
  }

  if (typeof anyError?.body === "string") {
    parts.push(anyError.body);
  }

  if (typeof anyError?.message === "string") {
    parts.push(anyError.message);
  }

  const haystack = parts.join(" ").toLowerCase();

  return (
    haystack.includes("json_validate_failed") ||
    haystack.includes("max completion tokens") ||
    haystack.includes("failed_generation") ||
    haystack.includes(
      "before generating a valid document"
    )
  );
}

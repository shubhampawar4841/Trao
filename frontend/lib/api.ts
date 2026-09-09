/**
 * Always call same-origin `/api/...`.
 * Next.js rewrites proxy to Express (`BACKEND_URL`), so the auth
 * cookie is stored on the frontend domain and survives
 * register → dashboard → refresh.
 *
 * Do not point the browser at the backend URL directly —
 * cross-site cookies between two Vercel apps get blocked.
 */
export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...options,

    credentials: "include",

    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  let data: any = null;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? "Invalid JSON response from API"
        : `Request failed (${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message || "Something went wrong"
    );
  }

  return data as T;
}

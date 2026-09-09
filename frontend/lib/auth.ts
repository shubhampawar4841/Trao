import { api } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  createdAt?: string;
}

/**
 * Cookie lives on the API domain, so Next middleware
 * cannot see it. Call /api/auth/me with credentials instead.
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const data = await api<{
      success: boolean;
      user: AuthUser;
    }>("/api/auth/me");

    return data.user;
  } catch {
    return null;
  }
}

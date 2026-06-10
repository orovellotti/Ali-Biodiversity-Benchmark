export const ADMIN_TOKEN_KEY = "benchmark_admin_token";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

function errStatus(err: unknown): number | undefined {
  return (err as { status?: number } | null)?.status;
}

export function isAuthError(err: unknown): boolean {
  const status = errStatus(err);
  return status === 401 || status === 503;
}

/** 503 = no admin password configured server-side (launching is disabled). */
export function isAdminDisabledError(err: unknown): boolean {
  return errStatus(err) === 503;
}

/** 409 = an analysis is already running (concurrency guard). */
export function isConflictError(err: unknown): boolean {
  return errStatus(err) === 409;
}

/** Pull the human-readable `error` message the API returns on 4xx responses. */
export function apiErrorMessage(err: unknown): string | null {
  const data = (err as { data?: unknown } | null)?.data;
  if (data && typeof data === "object" && "error" in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return null;
}

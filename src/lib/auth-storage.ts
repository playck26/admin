const ACCESS_TOKEN_KEY = "playck_admin_access_token";
const ADMIN_USER_KEY = "playck_admin_user";

export interface StoredAdminUser {
  nome: string;
  email: string;
}

export function saveAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

// SPEC-008: persiste nome/email do admin logado (já devolvidos por
// POST /auth/login) pra exibir no rodapé da sidebar — sem endpoint novo.
export function saveAdminUser(user: StoredAdminUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

export function getAdminUser(): StoredAdminUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAdminUser;
  } catch {
    return null;
  }
}

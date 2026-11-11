/**
 * Base URL única do backend (cliente).
 *
 * Override via NEXT_PUBLIC_API_URL; em dev o fallback aponta para o
 * backend local. Centralizada para que novos consumers importem daqui
 * em vez de duplicar a expressão.
 */
export const API_BASE: string =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4410";

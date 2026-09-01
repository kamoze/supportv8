export const AUTH_PASSWORD_MIN_LENGTH = 8;

export function passwordPolicyError(password: unknown): string | null {
  if (typeof password !== "string" || password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${AUTH_PASSWORD_MIN_LENGTH} characters in length.`;
  }
  return null;
}

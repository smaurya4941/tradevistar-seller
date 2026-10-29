/**
 * Password rules shared by sign-up and reset. The API rejects anything under 8 characters
 * (RegisterDto / ResetPasswordDto `@MinLength(8)`) or over 128, so the clients enforce the same.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export type PasswordStrength = "none" | "weak" | "medium" | "strong";

/**
 * A simple, explainable strength score: length first (the API's only hard rule), then variety.
 * Anything under the minimum is "weak" regardless of variety, so the meter never praises a
 * password the server will refuse.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return "none";
  if (password.length < MIN_PASSWORD_LENGTH) return "weak";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (password.length >= 12 && classes >= 3) return "strong";
  if (classes >= 3 || (password.length >= 10 && classes >= 2)) return "medium";
  return password.length >= 14 ? "medium" : "weak";
}

/** null when acceptable, otherwise the reason. */
export function validatePassword(password: string): string | null {
  if (!password) return "Enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

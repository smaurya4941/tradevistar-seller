/**
 * The rule for a *new* password on the change-password screen. The backend requires 8–128
 * characters with a lowercase letter, an uppercase letter and a digit here, while sign-up and reset
 * check length only (a documented gap), so this screen is stricter than the Phase 1 rule.
 */
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password";

export type PasswordProblem = "length" | "lowercase" | "uppercase" | "digit" | "tooLong";

export function passwordProblems(password: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) problems.push("length");
  if (password.length > MAX_PASSWORD_LENGTH) problems.push("tooLong");
  if (!/[a-z]/.test(password)) problems.push("lowercase");
  if (!/[A-Z]/.test(password)) problems.push("uppercase");
  if (!/\d/.test(password)) problems.push("digit");
  return problems;
}

export const isAcceptableNewPassword = (password: string): boolean => passwordProblems(password).length === 0;

/** 0–4 for the strength meter: one point per rule met plus one for length of 12 or more. */
export function passwordScore(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  const rules = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((rule) => rule.test(password)).length;
  let score = password.length < MIN_PASSWORD_LENGTH ? Math.min(rules, 1) : rules;
  if (password.length >= 12 && score < 4) score += 1;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

export const PASSWORD_SCORE_LABEL = ["", "Weak", "Fair", "Good", "Strong"] as const;

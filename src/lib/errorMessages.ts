/**
 * Maps database/auth error codes to user-friendly messages.
 * Never expose raw error.message to the UI.
 */
const ERROR_CODE_MAP: Record<string, string> = {
  "23505": "A record with that value already exists.",
  "23503": "This record is referenced by other data and cannot be changed.",
  "23502": "A required field is missing.",
  "42501": "You don't have permission to perform this action.",
  "PGRST301": "You don't have permission to access this resource.",
  "invalid_credentials": "Invalid email or password.",
  "user_already_exists": "An account with this email already exists.",
  "email_not_confirmed": "Please verify your email before signing in.",
};

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Returns a safe, user-friendly error message.
 * Logs the original error to the console for debugging.
 */
export function getSafeErrorMessage(error: unknown, context?: string): string {
  if (!error) return GENERIC_MESSAGE;

  const err = error as any;
  const code = err?.code || err?.error_code || "";
  const mapped = ERROR_CODE_MAP[code];

  // Always log the real error for debugging
  console.error(`[${context || "error"}]`, error);

  if (mapped) return mapped;
  return GENERIC_MESSAGE;
}

export function getErrorMessage(
  error: unknown,
  fallback = "Operazione non riuscita. Riprova.",
): string {
  if (error instanceof Error) return error.message || fallback;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message || fallback;
  }
  return fallback;
}

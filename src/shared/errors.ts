export function createErrorResponse(error: unknown) {
  return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
}

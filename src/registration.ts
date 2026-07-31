export function registrationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function registrationAlreadyExists(error: unknown): boolean {
  return /duplicate script id/i.test(registrationErrorMessage(error));
}

export function apiError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalisePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+855')) return trimmed;
  if (trimmed.startsWith('0')) return '+855' + trimmed.slice(1);
  return '+855' + trimmed;
}
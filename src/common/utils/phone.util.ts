export function normalisePhone(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('+855')) return trimmed;
  if (trimmed.startsWith('0')) return '+855' + trimmed.slice(1);
  return '+855' + trimmed;
}
//Generates a human-readable tracking number.
export function generateTrackingNumber(): string {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(16).slice(2, 10).toUpperCase();
  return `CHC-${datePart}-${randomPart}`;
}
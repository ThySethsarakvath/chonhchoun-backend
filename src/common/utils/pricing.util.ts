import { VehicleType } from '../enum/package.enum';

// ── Haversine formula — straight-line distance between two coords ────────────
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ── Pricing table (USD) ───────────────────────────────────────────────────────
// Base fare + per-km rate per vehicle type
const PRICING: Record<VehicleType, { base: number; perKm: number }> = {
  [VehicleType.MOTORCYCLE]: { base: 1.0, perKm: 0.3 },
  [VehicleType.CAR]:        { base: 2.0, perKm: 0.5 },
  [VehicleType.TRUCK]:      { base: 4.0, perKm: 0.8 },
  [VehicleType.TRUCK_LARGE]:{ base: 8.0, perKm: 1.2 },
};

export function estimatePrice(distanceKm: number, vehicle: VehicleType): number {
  const { base, perKm } = PRICING[vehicle];
  const raw = base + perKm * distanceKm;
  // Round to 2 decimal places
  return Math.round(raw * 100) / 100;
}

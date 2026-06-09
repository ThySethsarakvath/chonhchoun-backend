export enum VehicleType {
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
  TRUCK = 'TRUCK',
  TRUCK_LARGE = 'TRUCK_LARGE',
}

export enum PackageType {
  DOCUMENT = 'DOCUMENT',
  FOOD = 'FOOD',
  ELECTRONICS = 'ELECTRONICS',
  CLOTHING = 'CLOTHING',
  FURNITURE = 'FURNITURE',
  FRAGILE = 'FRAGILE',
  OTHER = 'OTHER',
}

export enum BookingStatus {
  PENDING = 'PENDING',       // waiting for a driver to accept
  CANCELLED = 'CANCELLED',   // cancelled by the customer
  // ── future driver states (do not implement yet) ──
  ACCEPTED = 'ACCEPTED',     // driver accepted
  PICKED_UP = 'PICKED_UP',   // driver picked up the package
  IN_TRANSIT = 'IN_TRANSIT', // on the way
  DELIVERED = 'DELIVERED',   // successfully delivered
  FAILED = 'FAILED',         // delivery attempt failed
}

export enum PaymentPayer {
  SENDER = 'SENDER',
  RECIPIENT = 'RECIPIENT',
}

export enum PaymentMethod {
  CASH = 'CASH',
  ABA_QR = 'ABA_QR',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

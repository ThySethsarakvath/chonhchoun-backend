export enum VehicleType {
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
  TRUCK = 'TRUCK',
}

export enum PackageType {
  DOCUMENT = 'DOCUMENT',
  FRAGILE = 'FRAGILE',
  FOOD = 'FOOD',
  ELECTRONICS = 'ELECTRONICS',
  CLOTHING = 'CLOTHING',
  OTHER = 'OTHER',
}

export enum PaymentMethod {
  CASH = 'CASH',
  ABA_QR = 'ABA_QR',
  MOBILE_BANKING = 'MOBILE_BANKING',
}

export enum PayerType {
  SENDER = 'SENDER',
  RECIPIENT = 'RECIPIENT',
}

export enum PackageStatus {
  DRAFT = 'DRAFT',                   // Not yet submitted
  PENDING = 'PENDING',               // Waiting for driver
  ASSIGNED = 'ASSIGNED',             // Driver found
  IN_TRANSIT = 'IN_TRANSIT',        // On the way
  DELIVERED = 'DELIVERED',          // Successfully delivered
  CANCELLED = 'CANCELLED',           // Order cancelled
  FAILED = 'FAILED',                // Delivery failed
}
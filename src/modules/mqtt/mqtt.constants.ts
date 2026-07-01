/**
 * All MQTT topic patterns used across the application.
 *
 * Topic naming convention:
 *   chonhchoun/{domain}/{entityId}/{event}
 *
 * Subscribers use the wildcard variants (+) to listen to all IDs.
 * Publishers build the exact topic with real IDs.
 */
export const MqttTopics = {

  // ── Driver location ────────────────────────────────────────────────────────
  // Driver app publishes its GPS position here
  // Flutter tracking screens subscribe to the deliveryId variant
  driverLocation: (driverId: string) =>
    `chonhchoun/drivers/${driverId}/location`,

  // ── Delivery status ────────────────────────────────────────────────────────
  // Backend publishes whenever a delivery status changes
  deliveryStatus: (deliveryId: string) =>
    `chonhchoun/deliveries/${deliveryId}/status`,

  // ── Package status ─────────────────────────────────────────────────────────
  // Backend publishes whenever a single package status changes
  packageStatus: (packageId: string) =>
    `chonhchoun/packages/${packageId}/status`,

  // ── Driver status ──────────────────────────────────────────────────────────
  // Backend publishes when a driver goes ON_DELIVERY, AVAILABLE, etc.
  driverStatus: (driverId: string) =>
    `chonhchoun/drivers/${driverId}/status`,

  // ── Wildcard subscriptions (for server-side listeners) ────────────────────
  ALL_DRIVER_LOCATIONS: 'chonhchoun/drivers/+/location',
  ALL_DELIVERY_STATUSES: 'chonhchoun/deliveries/+/status',
  ALL_PACKAGE_STATUSES:  'chonhchoun/packages/+/status',
  ALL_DRIVER_STATUSES:   'chonhchoun/drivers/+/status',
} as const;

export const MQTT_CLIENT = 'MQTT_CLIENT';
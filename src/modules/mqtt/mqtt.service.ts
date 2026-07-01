import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as mqtt from 'mqtt';
import { MQTT_CLIENT, MqttTopics } from './mqtt.constants';

// ── Payload types published over MQTT ────────────────────────────────────────

export interface DriverLocationPayload {
  driverId:   string;
  deliveryId: string;
  latitude:   number;
  longitude:  number;
  heading?:   number;   // degrees 0-360
  speedKmh?:  number;
  timestamp:  string;   // ISO 8601
}

export interface DeliveryStatusPayload {
  deliveryId: string;
  status:     string;
  updatedAt:  string;
}

export interface PackageStatusPayload {
  packageId:   string;
  trackingCode: string;
  status:      string;
  updatedAt:   string;
  note?:       string;
}

export interface DriverStatusPayload {
  driverId:  string;
  status:    string;
  updatedAt: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);

  constructor(@Inject(MQTT_CLIENT) private readonly client: mqtt.MqttClient) {}

  onModuleInit() {
    this.logger.log('[MQTT Service] Initializing subscriptions...');
    
    // Subscribe to driver location updates published by the Flutter driver app.
    // The backend listens and can forward to Redis or trigger business logic.
    this.subscribe(MqttTopics.ALL_DRIVER_LOCATIONS, (topic, payload) => {
      try {
        const data: DriverLocationPayload = JSON.parse(payload.toString());
        this.logger.debug(
          `📍 Driver ${data.driverId} → [${data.latitude}, ${data.longitude}]`,
        );
        // Future: persist to Redis for caching latest driver position,
        // or forward to a tracking gateway for connected Flutter clients
      } catch (err) {
        this.logger.warn(`Malformed location payload on topic: ${topic} — ${err}`);
      }
    });

    this.logger.log('[MQTT Service] All subscriptions registered');
  }

  onModuleDestroy() {
    this.logger.log('[MQTT Service] Destroying MQTT client...');
    this.client.end();
    this.logger.log('[MQTT Service] MQTT client disconnected');
  }

  // ── Core publish ──────────────────────────────────────────────────────────
  publish<T>(topic: string, payload: T, retain = false): void {
    const message = JSON.stringify(payload);
    this.logger.debug(`[Publish] Publishing to ${topic} (retain: ${retain}): ${message.substring(0, 100)}`);
    
    this.client.publish(topic, message, { qos: 1, retain }, (err) => {
      if (err) {
        this.logger.error(`[Publish] Failed to publish [${topic}]: ${err.message}`);
      } else {
        this.logger.debug(`[Publish] Successfully published to: ${topic}`);
      }
    });
  }

  // ── Core subscribe ────────────────────────────────────────────────────────
  subscribe(
    topic: string,
    handler: (topic: string, payload: Buffer) => void,
  ): void {
    this.logger.log(`[Subscribe] Subscribing to topic: ${topic}`);
    
    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(`[Subscribe] Failed to subscribe to [${topic}]: ${err.message}`);
        return;
      }
      this.logger.log(`[Subscribe] Successfully subscribed to: ${topic}`);
    });
    
    this.client.on('message', (receivedTopic, payload) => {
      if (this.topicMatches(topic, receivedTopic)) {
        this.logger.debug(`[Message] Received on ${receivedTopic}: ${payload.toString().substring(0, 100)}`);
        handler(receivedTopic, payload);
      }
    });
  }

  // ── Domain publish helpers ─────────────────────────────────────────────────

  publishDriverLocation(payload: DriverLocationPayload): void {
    this.publish(MqttTopics.driverLocation(payload.driverId), payload);
  }

  publishDeliveryStatus(payload: DeliveryStatusPayload): void {
    // retain=true so new subscribers immediately get the latest status
    this.publish(MqttTopics.deliveryStatus(payload.deliveryId), payload, true);
  }

  publishPackageStatus(payload: PackageStatusPayload): void {
    this.publish(MqttTopics.packageStatus(payload.packageId), payload, true);
  }

  publishDriverStatus(payload: DriverStatusPayload): void {
    this.publish(MqttTopics.driverStatus(payload.driverId), payload, true);
  }

  // ── Wildcard topic matcher ─────────────────────────────────────────────────
  // Converts MQTT wildcard '+' to a regex to match received topics
  private topicMatches(pattern: string, topic: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\+/g, '[^/]+').replace(/#/g, '.+') + '$',
    );
    return regex.test(topic);
  }
}
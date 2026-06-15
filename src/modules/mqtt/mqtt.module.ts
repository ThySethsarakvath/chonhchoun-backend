import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttService } from './mqtt.service';
import { MQTT_CLIENT } from './mqtt.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MQTT_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): mqtt.MqttClient => {
        const host     = config.get<string>('mqtt.host')!;
        const clientId = config.get<string>('mqtt.clientId')!;

        console.log(`[MQTT] 🔧 Initializing client...`);
        console.log(`[MQTT] Host: ${host}`);
        console.log(`[MQTT] ClientId: ${clientId}`);

        const client = mqtt.connect(host, {
          clientId,
          clean: true,
          connectTimeout: 10_000,
          reconnectPeriod: 3_000,
          keepalive: 60,
        });

        client.on('connect', () => {
          console.log(`[MQTT] ✅ Connected to broker — clientId: ${clientId}`);
        });

        client.on('reconnect', () => {
          console.log('[MQTT] 🔄 Reconnecting to broker...');
        });

        client.on('error', (err) => {
          console.error('[MQTT] ❌ Error:', err.message);
          console.error('[MQTT] Error details:', err);
        });

        client.on('offline', () => {
          console.warn('[MQTT] ⚠️  Client went offline');
        });

        client.on('disconnect', () => {
          console.warn('[MQTT] ⚠️  Client disconnected');
        });

        client.on('close', () => {
          console.warn('[MQTT] ⚠️  Client connection closed');
        });

        return client;
      },
    },
    MqttService,
  ],
  exports: [MqttService],
})
export class MqttModule {}
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as mqtt from 'mqtt';
import { ChatService } from './chat.service';
import { RedisService } from '../redis/redis.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti?: string;
}

const OUTBOX_PATTERN = 'chonchoun/chat/+/outbox';
const DEFAULT_BROKER = 'mqtt://broker.emqx.io:1883';

@Injectable()
export class MqttChatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttChatService.name);
  private client?: mqtt.MqttClient;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit(): void {
    const url =
      this.configService.get<string>('MQTT_URL') ??
      process.env.MQTT_URL ??
      DEFAULT_BROKER;

    this.client = mqtt.connect(url, {
      reconnectPeriod: 3000,
      connectTimeout: 10000,
      clean: true,
    });

    this.client.on('connect', () => {
      this.logger.log(`MQTT chat connected to ${url}`);
      this.client?.subscribe(OUTBOX_PATTERN, { qos: 1 }, (err) => {
        if (err) this.logger.error(`Subscribe failed: ${err.message}`);
      });
    });

    this.client.on('message', (topic, payload) => {
      void this.handleOutbox(topic, payload);
    });

    this.client.on('error', (err) => {
      this.logger.error(`MQTT error: ${err.message}`);
    });
  }

  onModuleDestroy(): void {
    this.client?.end(true);
  }

  private messagesTopic(packageId: string): string {
    return `chonchoun/chat/${packageId}/messages`;
  }

  private packageIdFromTopic(topic: string): string | null {
    const parts = topic.split('/');
    return parts.length >= 4 ? parts[2] : null;
  }

  private async handleOutbox(topic: string, payload: Buffer): Promise<void> {
    try {
      const packageId = this.packageIdFromTopic(topic);
      if (!packageId) return;

      const body = JSON.parse(payload.toString()) as {
        token?: string;
        text?: string;
      };
      const token = (body.token ?? '').replace(/^Bearer\s+/i, '').trim();
      const text = (body.text ?? '').trim();
      if (!token || !text) return;

      const decoded = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      if (
        decoded.jti &&
        (await this.redisService.isTokenBlacklisted(decoded.jti))
      ) {
        return;
      }

      await this.chatService.assertParticipant(packageId, decoded.sub);
      const saved = await this.chatService.saveMessage(
        packageId,
        decoded.sub,
        text,
      );

      const message = {
        _id: saved._id,
        packageId,
        senderId: decoded.sub,
        text: saved.text,
        createdAt: (saved as any).createdAt,
      };

      this.client?.publish(
        this.messagesTopic(packageId),
        JSON.stringify(message),
        { qos: 1 },
      );
    } catch (err) {
      this.logger.warn(`Dropped chat message: ${(err as Error).message}`);
    }
  }
}

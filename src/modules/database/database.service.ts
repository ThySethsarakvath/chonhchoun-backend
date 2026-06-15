import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

@Injectable()
export class DatabaseService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  // Runs automatically after the app fully starts
  onApplicationBootstrap() {
    this.verifyConnection();
  }

  private verifyConnection(): void {
    const state = this.connection.readyState;

    if (state === ConnectionStates.connected) {
      this.logger.log(
        `✅ MongoDB connected — database: "${this.connection.name}"`,
      );
      this.logger.log(`✅ Host: ${this.connection.host}`);
    } else {
      this.logger.error(
        `❌ MongoDB not connected — state: ${ConnectionStates[state]}`,
      );
    }
  }

  // Returns current connection state (useful for health checks later)
  getStatus(): { connected: boolean; database: string; host: string } {
    return {
      connected: this.connection.readyState === ConnectionStates.connected,
      database: this.connection.name,
      host: this.connection.host,
    };
  }
}

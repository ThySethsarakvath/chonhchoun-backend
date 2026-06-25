import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { MqttChatService } from './mqtt-chat.service';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { Message, MessageSchema } from './schemas/message.schema';
import { Package, PackageSchema } from '../../shared/schemas/package.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Package.name, schema: PackageSchema },
    ]),
    JwtModule.register({}),
    AuthModule,
  ],
  controllers: [ChatController],
  providers: [MqttChatService, ChatService],
})
export class ChatModule {}

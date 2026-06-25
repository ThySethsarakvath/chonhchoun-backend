import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** Chat history for a delivery. Caller must be its customer or assigned driver. */
  @Get(':packageId/messages')
  getMessages(@Param('packageId') packageId: string, @CurrentUser() user: any) {
    return this.chatService.getHistory(packageId, String(user._id));
  }
}

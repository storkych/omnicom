import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { TelegramService } from '../telegram/telegram.service';
import {
  ConversationsService,
  InboxFilter,
} from './conversations.service';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly telegram: TelegramService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('filter') filter?: InboxFilter,
  ) {
    return this.conversations.list(user.id, filter ?? 'all');
  }

  @Get(':id/messages')
  messages(@Param('id') id: string) {
    return this.conversations.getMessages(id);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.conversations.markRead(id);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignConversationDto) {
    return this.conversations.assign(id, dto.userId);
  }

  @Post(':id/messages')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.telegram.sendMessage(user.id, id, dto.text);
  }
}

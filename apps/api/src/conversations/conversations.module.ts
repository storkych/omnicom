import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [TelegramModule, RealtimeModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}

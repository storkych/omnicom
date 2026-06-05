import { Global, Module } from '@nestjs/common';
import { ConversationsSerializer } from '../conversations/conversations.serializer';
import { CryptoService } from './crypto.service';

@Global()
@Module({
  providers: [CryptoService, ConversationsSerializer],
  exports: [CryptoService, ConversationsSerializer],
})
export class CommonModule {}

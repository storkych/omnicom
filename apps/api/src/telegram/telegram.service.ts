import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { BotStatus } from '@omnicom/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ConversationsSerializer } from '../conversations/conversations.serializer';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;
  private readonly proxyUrl: string;
  private bot: Bot | null = null;
  private online = false;
  private botUsername: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly serializer: ConversationsSerializer,
  ) {
    this.token = this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    this.proxyUrl = this.config.get<string>('TELEGRAM_PROXY_URL') ?? '';
  }

  async onModuleInit(): Promise<void> {
    if (!this.token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN is not set; Telegram bot disabled until configured.',
      );
      return;
    }

    const agent = this.buildProxyAgent();
    this.bot = new Bot(this.token, {
      client: agent ? { baseFetchConfig: { agent } } : undefined,
    });

    this.registerHandlers(this.bot);

    // Long polling runs in the background; we do not await it.
    this.bot
      .start({
        onStart: (info) => {
          this.online = true;
          this.botUsername = info.username;
          this.logger.log(`Telegram bot @${info.username} started (long polling)`);
        },
      })
      .catch((err) => {
        this.online = false;
        this.logger.error(`Bot polling stopped: ${(err as Error).message}`);
      });
  }

  async onModuleDestroy(): Promise<void> {
    await this.bot?.stop().catch(() => undefined);
  }

  private buildProxyAgent() {
    if (!this.proxyUrl) return undefined;
    try {
      const agent = this.proxyUrl.startsWith('socks')
        ? new SocksProxyAgent(this.proxyUrl)
        : new HttpsProxyAgent(this.proxyUrl);
      this.logger.log(`Using proxy for Telegram: ${this.maskProxy()}`);
      return agent;
    } catch (err) {
      this.logger.error(
        `Invalid TELEGRAM_PROXY_URL, connecting directly: ${(err as Error).message}`,
      );
      return undefined;
    }
  }

  private maskProxy(): string {
    return this.proxyUrl.replace(/\/\/[^@]*@/, '//***@');
  }

  // ---------------------------------------------------------------------------
  // Incoming messages from clients
  // ---------------------------------------------------------------------------

  private registerHandlers(bot: Bot): void {
    bot.on('message', async (ctx) => {
      try {
        const from = ctx.from;
        if (!from || from.is_bot) return;

        const externalId = String(ctx.chat.id);
        const name =
          [from.first_name, from.last_name].filter(Boolean).join(' ') || null;
        const username = from.username ?? null;
        const text =
          ctx.message.text ??
          ctx.message.caption ??
          this.describeNonText(
            ctx.message as unknown as Record<string, unknown>,
          );

        await this.persistMessage({
          externalId,
          name,
          username,
          direction: 'in',
          text,
          externalMessageId: String(ctx.message.message_id),
          incrementUnread: true,
        });
      } catch (err) {
        this.logger.error(
          `Error handling incoming message: ${(err as Error).message}`,
        );
      }
    });

    bot.catch((err) => {
      this.logger.error(`grammY error: ${err.message}`);
    });
  }

  private describeNonText(m: Record<string, unknown>): string {
    if (m.photo) return '[фото]';
    if (m.document) return '[документ]';
    if (m.voice) return '[голосовое сообщение]';
    if (m.video) return '[видео]';
    if (m.sticker) return '[стикер]';
    if (m.location) return '[геопозиция]';
    if (m.contact) return '[контакт]';
    return '[вложение]';
  }

  // ---------------------------------------------------------------------------
  // Outgoing messages
  // ---------------------------------------------------------------------------

  async sendMessage(managerId: string, conversationId: string, text: string) {
    if (!this.bot) {
      throw new BadRequestException('Telegram bot is not configured');
    }
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });
    if (!conversation) {
      throw new BadRequestException('Conversation not found');
    }

    try {
      const sent = await this.bot.api.sendMessage(
        Number(conversation.contact.externalId),
        text,
      );
      return this.persistMessage({
        externalId: conversation.contact.externalId,
        name: conversation.contact.name,
        username: conversation.contact.username,
        direction: 'out',
        text,
        externalMessageId: String(sent.message_id),
        incrementUnread: false,
        sentById: managerId,
      });
    } catch (err) {
      throw new BadRequestException(
        `Failed to send message: ${(err as Error).message}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence + realtime fan-out
  // ---------------------------------------------------------------------------

  private async persistMessage(params: {
    externalId: string;
    name: string | null;
    username: string | null;
    direction: 'in' | 'out';
    text: string;
    externalMessageId: string | null;
    incrementUnread: boolean;
    sentById?: string;
  }) {
    const contact = await this.prisma.contact.upsert({
      where: {
        channel_externalId: {
          channel: 'telegram',
          externalId: params.externalId,
        },
      },
      update: { name: params.name, username: params.username },
      create: {
        channel: 'telegram',
        externalId: params.externalId,
        name: params.name,
        username: params.username,
      },
    });

    await this.prisma.conversation.upsert({
      where: { contactId: contact.id },
      update: {
        lastMessageAt: new Date(),
        lastMessageText: params.text,
        unreadCount: params.incrementUnread ? { increment: 1 } : undefined,
      },
      create: {
        channel: 'telegram',
        contactId: contact.id,
        lastMessageAt: new Date(),
        lastMessageText: params.text,
        unreadCount: params.incrementUnread ? 1 : 0,
      },
    });

    const conversation = await this.prisma.conversation.findUnique({
      where: { contactId: contact.id },
      include: { contact: true, assignedTo: true },
    });

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation!.id,
        direction: params.direction,
        text: params.text,
        externalId: params.externalMessageId,
        sentById: params.sentById ?? null,
        status: 'sent',
      },
    });

    const conversationDto = this.serializer.toConversationDto(conversation!);
    const messageDto = this.serializer.toMessageDto(message);

    this.realtime.broadcastMessageNew({
      conversation: conversationDto,
      message: messageDto,
    });

    return messageDto;
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  getStatus(): BotStatus {
    return {
      configured: Boolean(this.token),
      online: this.online,
      username: this.botUsername,
    };
  }
}

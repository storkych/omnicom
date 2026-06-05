import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ConversationsSerializer } from './conversations.serializer';

export type InboxFilter = 'all' | 'mine' | 'unassigned';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: ConversationsSerializer,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(userId: string, filter: InboxFilter = 'all') {
    const where: Prisma.ConversationWhereInput = {};
    if (filter === 'mine') {
      where.assignedToId = userId;
    } else if (filter === 'unassigned') {
      where.assignedToId = null;
    }

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: { contact: true, assignedTo: true },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });
    return conversations.map((c) => this.serializer.toConversationDto(c));
  }

  async getMessages(conversationId: string) {
    await this.ensureExists(conversationId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return messages.map((m) => this.serializer.toMessageDto(m));
  }

  async markRead(conversationId: string) {
    await this.ensureExists(conversationId);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
    return { ok: true };
  }

  async assign(conversationId: string, userId: string | null) {
    await this.ensureExists(conversationId);

    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('Manager not found');
      }
    }

    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedToId: userId },
      include: { contact: true, assignedTo: true },
    });

    const dto = this.serializer.toConversationDto(conversation);
    this.realtime.broadcastConversationUpdated({ conversation: dto });
    return dto;
  }

  private async ensureExists(conversationId: string) {
    const exists = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Conversation not found');
    }
  }
}

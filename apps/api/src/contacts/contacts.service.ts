import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsSerializer } from '../conversations/conversations.serializer';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serializer: ConversationsSerializer,
  ) {}

  async list() {
    const contacts = await this.prisma.contact.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return contacts.map((c) => this.serializer.toContactDto(c));
  }
}

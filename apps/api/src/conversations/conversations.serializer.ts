import { Injectable } from '@nestjs/common';
import {
  Contact as ContactDto,
  Conversation as ConversationDto,
  Manager as ManagerDto,
  Message as MessageDto,
} from '@omnicom/shared';
import { Contact, Conversation, Message, User } from '@prisma/client';

type ConversationWithRelations = Conversation & {
  contact: Contact;
  assignedTo?: User | null;
};

@Injectable()
export class ConversationsSerializer {
  toContactDto(contact: Contact): ContactDto {
    return {
      id: contact.id,
      channel: 'telegram',
      externalId: contact.externalId,
      name: contact.name,
      username: contact.username,
      avatarUrl: contact.avatarUrl,
      createdAt: contact.createdAt.toISOString(),
    };
  }

  toManagerDto(user: User): ManagerDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  toConversationDto(conversation: ConversationWithRelations): ConversationDto {
    return {
      id: conversation.id,
      channel: 'telegram',
      contact: this.toContactDto(conversation.contact),
      assignedTo: conversation.assignedTo
        ? this.toManagerDto(conversation.assignedTo)
        : null,
      lastMessageAt: conversation.lastMessageAt
        ? conversation.lastMessageAt.toISOString()
        : null,
      lastMessageText: conversation.lastMessageText,
      unreadCount: conversation.unreadCount,
      createdAt: conversation.createdAt.toISOString(),
    };
  }

  toMessageDto(message: Message): MessageDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      direction: message.direction,
      text: message.text,
      externalId: message.externalId,
      status: message.status,
      createdAt: message.createdAt.toISOString(),
    };
  }
}

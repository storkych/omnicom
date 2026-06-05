export type Channel = 'telegram';
export type MessageDirection = 'in' | 'out';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface Manager {
  id: string;
  email: string;
  name: string | null;
}

export interface Contact {
  id: string;
  channel: Channel;
  externalId: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  text: string;
  externalId: string | null;
  status: MessageStatus;
  createdAt: string;
}

export interface Conversation {
  id: string;
  channel: Channel;
  contact: Contact;
  assignedTo: Manager | null;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  unreadCount: number;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string };
}

export interface BotStatus {
  configured: boolean;
  online: boolean;
  username: string | null;
}

export interface MessageNewEvent {
  conversation: Conversation;
  message: Message;
}

export interface ConversationUpdatedEvent {
  conversation: Conversation;
}

export type InboxFilter = 'all' | 'mine' | 'unassigned';

export const REALTIME_EVENTS = {
  MESSAGE_NEW: 'message:new',
  CONVERSATION_UPDATED: 'conversation:updated',
} as const;

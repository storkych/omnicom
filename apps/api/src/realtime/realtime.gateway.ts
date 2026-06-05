import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  ConversationUpdatedEvent,
  MessageNewEvent,
  REALTIME_EVENTS,
} from '@omnicom/shared';
import { JwtPayload } from '../auth/jwt.strategy';

const OPERATORS_ROOM = 'operators';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket): void {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);
    if (!token) {
      this.logger.warn('Socket connection without token; disconnecting');
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      void client.join(OPERATORS_ROOM);
      this.logger.debug(
        `Socket ${client.id} joined operators room (user ${payload.sub})`,
      );
    } catch {
      this.logger.warn('Socket connection with invalid token; disconnecting');
      client.disconnect(true);
    }
  }

  // Shared inbox: every operator sees all incoming/outgoing activity.
  broadcastMessageNew(payload: MessageNewEvent): void {
    this.server.to(OPERATORS_ROOM).emit(REALTIME_EVENTS.MESSAGE_NEW, payload);
  }

  broadcastConversationUpdated(payload: ConversationUpdatedEvent): void {
    this.server
      .to(OPERATORS_ROOM)
      .emit(REALTIME_EVENTS.CONVERSATION_UPDATED, payload);
  }
}

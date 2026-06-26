import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EventsGateway.name);

  afterInit() {
    this.logger.log('WebSocket Gateway initialised on namespace /events');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Broadcast a guard attendance check-in event to all connected dashboards.
   */
  broadcastAttendance(payload: {
    guardId: string;
    guardName: string;
    siteId: string;
    siteName: string;
    status: string;
    checkInTime: string;
  }) {
    this.server.emit('attendance:checkin', payload);
  }

  /**
   * Broadcast a new incident report to all connected dashboards.
   */
  broadcastIncident(payload: {
    id: string;
    title: string;
    type: string;
    severity: string;
    siteName: string;
    reporterName: string;
    reportedAt: string;
  }) {
    this.server.emit('incident:new', payload);
  }
}

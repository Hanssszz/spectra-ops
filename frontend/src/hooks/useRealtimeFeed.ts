'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface AttendanceEvent {
  guardId: string;
  guardName: string;
  siteId: string;
  siteName: string;
  status: string;
  checkInTime: string;
}

export interface IncidentEvent {
  id: string;
  title: string;
  type: string;
  severity: string;
  siteName: string;
  reporterName: string;
  reportedAt: string;
}

export type ActivityEvent =
  | { kind: 'attendance'; data: AttendanceEvent; receivedAt: Date }
  | { kind: 'incident'; data: IncidentEvent; receivedAt: Date };

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3001';
const MAX_FEED_SIZE = 20;

export function useRealtimeFeed() {
  const [connected, setConnected] = useState(false);
  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const pushEvent = useCallback((event: ActivityEvent) => {
    setFeed((prev) => [event, ...prev].slice(0, MAX_FEED_SIZE));
  }, []);

  useEffect(() => {
    const socket = io(`${BACKEND_URL}/events`, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('attendance:checkin', (data: AttendanceEvent) => {
      pushEvent({ kind: 'attendance', data, receivedAt: new Date() });
    });

    socket.on('incident:new', (data: IncidentEvent) => {
      pushEvent({ kind: 'incident', data, receivedAt: new Date() });
    });

    return () => {
      socket.disconnect();
    };
  }, [pushEvent]);

  return { connected, feed };
}

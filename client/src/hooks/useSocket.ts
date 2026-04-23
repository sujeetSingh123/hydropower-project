import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import type { LiveReadingsMap } from '../types';

const WS_URL = process.env.REACT_APP_WS_URL || '';

let _socket: Socket | null = null;

interface LiveDataPayload {
  data: LiveReadingsMap;
}

type SocketEventHandler<T = unknown> = (payload: T) => void;

interface UseSocketReturn {
  connected: boolean;
  subscribe: <T = unknown>(event: string, handler: SocketEventHandler<T>) => () => void;
}

export function useSocket(): UseSocketReturn {
  const token = useAuthStore((s) => s.token);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    if (!_socket) {
      _socket = io(WS_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    }
    _socket.on('connect',    () => setConnected(true));
    _socket.on('disconnect', () => setConnected(false));
    setConnected(_socket.connected);

    return () => {
      _socket?.off('connect');
      _socket?.off('disconnect');
    };
  }, [token]);

  const subscribe = useCallback(<T = unknown>(event: string, handler: SocketEventHandler<T>): () => void => {
    _socket?.on(event, handler as SocketEventHandler);
    return () => _socket?.off(event, handler as SocketEventHandler);
  }, []);

  return { connected, subscribe };
}

export function useLiveData(onData: (payload: LiveDataPayload) => void): boolean {
  const { connected, subscribe } = useSocket();

  useEffect(() => {
    if (!connected) return;
    return subscribe<LiveDataPayload>('live_data', onData);
  }, [connected, subscribe, onData]);

  return connected;
}

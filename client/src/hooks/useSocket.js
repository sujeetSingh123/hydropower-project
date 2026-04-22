import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';

const WS_URL = process.env.REACT_APP_WS_URL || '';

let _socket = null;

export function useSocket() {
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

  const subscribe = useCallback((event, handler) => {
    _socket?.on(event, handler);
    return () => _socket?.off(event, handler);
  }, []);

  return { connected, subscribe };
}

export function useLiveData(onData) {
  const { connected, subscribe } = useSocket();

  useEffect(() => {
    if (!connected) return;
    return subscribe('live_data', onData);
  }, [connected, subscribe, onData]);

  return connected;
}

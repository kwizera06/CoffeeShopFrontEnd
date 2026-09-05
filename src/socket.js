import { io } from 'socket.io-client';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If a specific URL is set in .env, use it
  if (envUrl && envUrl !== 'http://localhost:8081') {
    return envUrl;
  }
  
  // If we're on localhost, keep using localhost:8081
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8081';
  }
  
  // For mobile or other networks, use the same host but with port 8081
  const protocol = window.location.protocol; // http: or https:
  const hostname = window.location.hostname; // IP address or domain
  return `${protocol}//${hostname}:8081`;
};

const BASE_URL = getBaseUrl();
const socket = io(BASE_URL, {
    autoConnect: false,
    transports: ['websocket']
});

export const connectSocket = (tenantId) => {
    // Always (re-)register the connect handler so join_tenant fires on every
    // connect AND every automatic reconnect (e.g. after a network drop).
    socket.off('connect');  // remove stale handler to prevent duplicates
    socket.on('connect', () => {
        console.log('📡 Socket connected:', socket.id);
        if (tenantId) {
            socket.emit('join_tenant', tenantId);
            console.log(`👤 Joined tenant room: tenant_${tenantId}`);
        }
    });

    if (!socket.connected) {
        socket.connect();
    } else {
        // Already connected — emit join_tenant immediately so we don't miss
        // any events that fire before the async 'connect' event would fire.
        if (tenantId) {
            socket.emit('join_tenant', tenantId);
            console.log(`👤 Re-joined tenant room: tenant_${tenantId}`);
        }
    }
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};

export default socket;

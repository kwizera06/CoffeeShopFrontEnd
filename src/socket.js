import { io } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_API_URL || '';
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

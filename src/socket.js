import { io } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_API_URL || '';
const socket = io(BASE_URL, {
    autoConnect: false,
    transports: ['websocket']
});

export const connectSocket = (tenantId) => {
    if (!socket.connected) {
        socket.connect();
        socket.on('connect', () => {
            console.log('📡 Socket connected:', socket.id);
            if (tenantId) {
                socket.emit('join_tenant', tenantId);
            }
        });
    } else if (tenantId) {
        socket.emit('join_tenant', tenantId);
    }
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};

export default socket;

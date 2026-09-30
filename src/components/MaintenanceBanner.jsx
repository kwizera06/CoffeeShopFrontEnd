import { useEffect, useState } from 'react';
import { api } from '../api';

/**
 * Maintenance Mode Banner
 * Displays maintenance notification to cashiers
 */
export function MaintenanceBanner() {
    const [maintenance, setMaintenance] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(null);

    useEffect(() => {
        const checkMaintenance = async () => {
            try {
                const status = await api('/api/maintenance/status');
                setMaintenance(status);
            } catch (err) {
                console.error('Error checking maintenance status:', err);
            }
        };

        // Check immediately
        checkMaintenance();

        // Check every 30 seconds
        const interval = setInterval(checkMaintenance, 30000);
        return () => clearInterval(interval);
    }, []);

    // Update time remaining countdown
    useEffect(() => {
        if (!maintenance?.active || !maintenance?.timeRemainingMs) return;

        const updateTimer = () => {
            const minutes = Math.ceil(maintenance.timeRemainingMs / (60 * 1000));
            setTimeRemaining(`${minutes} min${minutes !== 1 ? 's' : ''}`);
        };

        updateTimer();
        const timer = setInterval(updateTimer, 60000); // Update every minute

        return () => clearInterval(timer);
    }, [maintenance]);

    if (!maintenance?.active) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(135deg, #d32f2f 0%, #f44336 100%)',
                color: 'white',
                padding: '16px',
                textAlign: 'center',
                zIndex: 9999,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
            }}
        >
            <span>🔧</span>
            <span>{maintenance.message}</span>
            {timeRemaining && <span style={{ marginLeft: '8px', opacity: 0.9 }}>({timeRemaining})</span>}
        </div>
    );
}

import { useEffect, useState } from 'react';

// Custom event to broadcast manual offline simulation across components
const OFFLINE_SIM_KEY = 'ismnm_simulate_offline_mode';

export function useOnlineStatus() {
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(() => {
    try {
      return localStorage.getItem(OFFLINE_SIM_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleSimToggle = () => {
      try {
        setIsSimulatedOffline(localStorage.getItem(OFFLINE_SIM_KEY) === 'true');
      } catch {}
    };

    window.addEventListener('storage', handleSimToggle);
    window.addEventListener('ismnm:offline-simulation-change', handleSimToggle);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleSimToggle);
      window.removeEventListener('ismnm:offline-simulation-change', handleSimToggle);
    };
  }, []);

  const toggleOfflineSimulation = () => {
    const nextVal = !isSimulatedOffline;
    setIsSimulatedOffline(nextVal);
    try {
      localStorage.setItem(OFFLINE_SIM_KEY, String(nextVal));
    } catch {}
    window.dispatchEvent(new Event('ismnm:offline-simulation-change'));
  };

  // Effective online state: true only if browser is online AND user is not simulating offline mode
  const isOnline = isBrowserOnline && !isSimulatedOffline;

  return {
    isOnline,
    isBrowserOnline,
    isSimulatedOffline,
    toggleOfflineSimulation,
  };
}

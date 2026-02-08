import { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/zustand/settingsStore';
import { t } from '../utils/i18n';

interface LoadingScreenProps {
  isLoading: boolean;
}

function LoadingScreen({ isLoading }: LoadingScreenProps) {
  const language = useSettingsStore(s => s.language);
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <div className="loading-text">Notology</div>
        <div className="loading-status">{t('loadingVault', language)}{dots}</div>
      </div>
    </div>
  );
}

export default LoadingScreen;

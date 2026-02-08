import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  isLoading: boolean;
}

function LoadingScreen({ isLoading }: LoadingScreenProps) {
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
        <div className="loading-status">보관소 로딩 중{dots}</div>
      </div>
    </div>
  );
}

export default LoadingScreen;

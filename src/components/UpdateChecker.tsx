import { useState, useEffect, useCallback } from 'react';
import { check, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Download, X, RefreshCw } from 'lucide-react';

interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdates = useCallback(async () => {
    try {
      setError(null);
      const update = await check();

      if (update) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version,
          date: update.date,
          body: update.body,
        });
      }
    } catch (e) {
      console.error('Failed to check for updates:', e);
      // Don't show error to user for silent update checks
    }
  }, []);

  useEffect(() => {
    // Check for updates on startup (with delay to not block app launch)
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 5000);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  const handleDownloadAndInstall = useCallback(async () => {
    try {
      setIsDownloading(true);
      setError(null);

      const update = await check();
      if (!update) {
        setError('업데이트를 찾을 수 없습니다.');
        setIsDownloading(false);
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event: DownloadEvent) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            setDownloadProgress(0);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setDownloadProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            setDownloadProgress(100);
            break;
        }
      });

      setIsDownloading(false);
      setIsInstalling(true);

      // Relaunch the app to apply the update
      await relaunch();
    } catch (e) {
      console.error('Failed to download/install update:', e);
      setError(`업데이트 설치 실패: ${e}`);
      setIsDownloading(false);
      setIsInstalling(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't show anything if no update or dismissed
  if (!updateAvailable || dismissed || !updateInfo) {
    return null;
  }

  return (
    <div className="update-checker">
      <div className="update-checker-content">
        <div className="update-checker-icon">
          <RefreshCw size={20} />
        </div>
        <div className="update-checker-info">
          <div className="update-checker-title">
            새 버전 사용 가능: v{updateInfo.version}
          </div>
          {updateInfo.body && (
            <div className="update-checker-body">
              {updateInfo.body.slice(0, 100)}
              {updateInfo.body.length > 100 ? '...' : ''}
            </div>
          )}
          {error && (
            <div className="update-checker-error">{error}</div>
          )}
          {isDownloading && (
            <div className="update-checker-progress">
              <div
                className="update-checker-progress-bar"
                style={{ width: `${downloadProgress}%` }}
              />
              <span className="update-checker-progress-text">
                {downloadProgress}%
              </span>
            </div>
          )}
        </div>
        <div className="update-checker-actions">
          {!isDownloading && !isInstalling && (
            <>
              <button
                className="update-checker-btn update-checker-btn-primary"
                onClick={handleDownloadAndInstall}
                title="업데이트 설치"
              >
                <Download size={14} />
                <span>설치</span>
              </button>
              <button
                className="update-checker-btn update-checker-btn-dismiss"
                onClick={handleDismiss}
                title="나중에"
              >
                <X size={14} />
              </button>
            </>
          )}
          {isInstalling && (
            <span className="update-checker-installing">재시작 중...</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default UpdateChecker;

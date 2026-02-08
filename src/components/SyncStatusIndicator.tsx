import { memo } from 'react';

export type SyncStatus = 'synced' | 'editing' | 'conflict' | 'editing-elsewhere';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  deviceName?: string;
}

const STATUS_LABELS: Record<SyncStatus, string> = {
  synced: '저장됨',
  editing: '편집 중',
  conflict: '충돌 감지',
  'editing-elsewhere': '다른 기기에서 편집 중',
};

export const SyncStatusIndicator = memo(function SyncStatusIndicator({ status, deviceName }: SyncStatusIndicatorProps) {
  const label = STATUS_LABELS[status];
  const title = deviceName ? `${label} (${deviceName})` : label;

  return (
    <span
      className={`sync-status-indicator sync-status-${status}`}
      title={title}
    >
      {status === 'conflict' ? '▲' : '●'}
    </span>
  );
});

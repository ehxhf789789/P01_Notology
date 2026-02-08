import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ContainerConfig, FolderStatus, FolderStatusConfig } from '../../types';
import { updateContainerConfig, updateFolderStatus, loadVaultConfig, saveVaultConfig } from '../../utils/vaultConfigUtils';
import { useFileTreeStore } from './fileTreeStore';

export interface RecentVault {
  path: string;
  name: string;
  lastOpened: string;
}

interface VaultConfigState {
  // State
  containerConfigs: Record<string, ContainerConfig>;
  folderStatuses: Record<string, FolderStatusConfig>;
  recentVaults: RecentVault[];
  isNasSynced: boolean;
  nasPlatform: string;
  isBulkSyncing: boolean;

  // Actions
  setContainerConfigs: (configs: Record<string, ContainerConfig>) => void;
  setFolderStatuses: (statuses: Record<string, FolderStatusConfig>) => void;
  setContainerConfig: (containerPath: string, config: ContainerConfig) => Promise<void>;
  setFolderStatus: (folderPath: string, status: FolderStatus) => Promise<void>;
  setRecentVaults: (vaults: RecentVault[]) => void;
  addRecentVault: (vault: RecentVault) => void;
  removeRecentVault: (path: string) => void;
  setIsNasSynced: (synced: boolean) => void;
  setNasPlatform: (platform: string) => void;
  setIsBulkSyncing: (syncing: boolean) => void;
  clearAll: () => void;
}

export const useVaultConfigStore = create<VaultConfigState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    containerConfigs: {},
    folderStatuses: {},
    recentVaults: [],
    isNasSynced: false,
    nasPlatform: '',
    isBulkSyncing: false,

    // Bulk setters
    setContainerConfigs: (configs) => set({ containerConfigs: configs }),
    setFolderStatuses: (statuses) => set({ folderStatuses: statuses }),

    // Set container config with persistence
    setContainerConfig: async (containerPath, config) => {
      const updated = { ...get().containerConfigs, [containerPath]: config };
      set({ containerConfigs: updated });
      const vaultPath = useFileTreeStore.getState().vaultPath;
      if (!vaultPath) return;
      await updateContainerConfig(vaultPath, containerPath, config);
    },

    // Set folder status with persistence
    setFolderStatus: async (folderPath, status) => {
      const vaultPath = useFileTreeStore.getState().vaultPath;
      if (status === 'none') {
        const { [folderPath]: _, ...rest } = get().folderStatuses;
        set({ folderStatuses: rest });
        if (!vaultPath) return;
        const config = await loadVaultConfig(vaultPath);
        delete config.folderStatuses[folderPath];
        await saveVaultConfig(vaultPath, config);
      } else {
        const updated = { ...get().folderStatuses, [folderPath]: { status } };
        set({ folderStatuses: updated });
        if (!vaultPath) return;
        await updateFolderStatus(vaultPath, folderPath, { status });
      }
    },

    // Recent vaults
    setRecentVaults: (vaults) => set({ recentVaults: vaults }),
    addRecentVault: (vault) => {
      const { recentVaults } = get();
      const filtered = recentVaults.filter(v => v.path !== vault.path);
      set({ recentVaults: [vault, ...filtered].slice(0, 10) });
    },
    removeRecentVault: (path) => {
      set({ recentVaults: get().recentVaults.filter(v => v.path !== path) });
    },

    // NAS state
    setIsNasSynced: (synced) => set({ isNasSynced: synced }),
    setNasPlatform: (platform) => set({ nasPlatform: platform }),
    setIsBulkSyncing: (syncing) => set({ isBulkSyncing: syncing }),

    // Clear all (used when closing vault)
    clearAll: () => set({
      containerConfigs: {},
      folderStatuses: {},
      isNasSynced: false,
      nasPlatform: '',
      isBulkSyncing: false,
    }),
  }))
);

// Selector hooks
export const useContainerConfigs = () => useVaultConfigStore((s) => s.containerConfigs);
export const useFolderStatuses = () => useVaultConfigStore((s) => s.folderStatuses);
export const useRecentVaults = () => useVaultConfigStore((s) => s.recentVaults);
export const useIsNasSynced = () => useVaultConfigStore((s) => s.isNasSynced);
export const useNasPlatform = () => useVaultConfigStore((s) => s.nasPlatform);
export const useIsBulkSyncing = () => useVaultConfigStore((s) => s.isBulkSyncing);

// Actions (stable references)
export const vaultConfigActions = {
  setContainerConfigs: (configs: Record<string, ContainerConfig>) =>
    useVaultConfigStore.getState().setContainerConfigs(configs),
  setFolderStatuses: (statuses: Record<string, FolderStatusConfig>) =>
    useVaultConfigStore.getState().setFolderStatuses(statuses),
  setContainerConfig: (containerPath: string, config: ContainerConfig) =>
    useVaultConfigStore.getState().setContainerConfig(containerPath, config),
  setFolderStatus: (folderPath: string, status: FolderStatus) =>
    useVaultConfigStore.getState().setFolderStatus(folderPath, status),
  setRecentVaults: (vaults: RecentVault[]) =>
    useVaultConfigStore.getState().setRecentVaults(vaults),
  addRecentVault: (vault: RecentVault) =>
    useVaultConfigStore.getState().addRecentVault(vault),
  removeRecentVault: (path: string) =>
    useVaultConfigStore.getState().removeRecentVault(path),
  setIsNasSynced: (synced: boolean) =>
    useVaultConfigStore.getState().setIsNasSynced(synced),
  setNasPlatform: (platform: string) =>
    useVaultConfigStore.getState().setNasPlatform(platform),
  setIsBulkSyncing: (syncing: boolean) =>
    useVaultConfigStore.getState().setIsBulkSyncing(syncing),
  clearAll: () =>
    useVaultConfigStore.getState().clearAll(),
};

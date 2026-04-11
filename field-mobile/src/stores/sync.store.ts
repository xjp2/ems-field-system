import { create } from 'zustand';
import { syncWithServer, getSyncStatus } from '../services/sync.service';
import { SyncResult } from '../types/database';

interface SyncState {
  // State
  pendingCount: number;
  isSyncing: boolean;
  isOnline: boolean;
  lastSync: string | null;
  lastError: string | null;
  
  // Actions
  sync: () => Promise<SyncResult>;
  updateStatus: () => Promise<void>;
  setOnline: (isOnline: boolean) => void;
}

export const useSyncStore = create<SyncState>()((set, get) => ({
  // Initial state
  pendingCount: 0,
  isSyncing: false,
  isOnline: true,
  lastSync: null,
  lastError: null,
  
  // Perform sync
  sync: async () => {
    set({ isSyncing: true, lastError: null });
    
    try {
      const result = await syncWithServer();
      
      set({
        isSyncing: false,
        lastSync: new Date().toISOString(),
        lastError: result.success ? null : result.errors.join(', '),
        pendingCount: result.success ? 0 : get().pendingCount,
      });
      
      return result;
    } catch (error: any) {
      set({
        isSyncing: false,
        lastError: error.message,
      });
      
      return {
        success: false,
        operations_completed: 0,
        operations_failed: 1,
        errors: [error.message],
      };
    }
  },
  
  // Update sync status without syncing
  updateStatus: async () => {
    const status = await getSyncStatus();
    set({
      pendingCount: status.pending,
      isOnline: status.isOnline,
    });
  },
  
  // Set online status
  setOnline: (isOnline: boolean) => {
    set({ isOnline });
    if (isOnline) {
      // Auto-sync when coming back online
      get().sync();
    }
  },
}));

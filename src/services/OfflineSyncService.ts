import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { getDatabase } from "../db/schema";
import { SyncQueueItem, SyncStatus } from "../types";

const SYNC_TASK_NAME = "EMERGENCY_ALERT_BACKGROUND_SYNC";
const MAX_RETRIES = 5;
const RETRY_BACKOFF_BASE_MS = 2000;

export class OfflineSyncService {
  private static instance: OfflineSyncService;
  private isSyncing = false;
  private unsubscribeNetInfo: (() => void) | null = null;

  static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  /**
   * Initialize the sync service:
   * - Register background fetch task
   * - Listen for network state changes to trigger sync
   */
  async initialize(): Promise<void> {
    // Register the background task handler
    TaskManager.defineTask(SYNC_TASK_NAME, async () => {
      try {
        const synced = await this.processSyncQueue();
        return synced > 0
          ? BackgroundFetch.BackgroundFetchResult.NewData
          : BackgroundFetch.BackgroundFetchResult.NoData;
      } catch {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    // Register background fetch (iOS minimum interval ~15 min)
    await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
      minimumInterval: 60 * 15, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });

    // Listen for connectivity changes — sync immediately when back online
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable) {
        this.processSyncQueue();
      }
    });
  }

  /**
   * Enqueue an item for sync. If online, attempt immediate sync.
   */
  async enqueue(
    type: SyncQueueItem["type"],
    payload: Record<string, unknown>
  ): Promise<string> {
    const db = await getDatabase();
    const id = this.generateId();

    await db.runAsync(
      `INSERT INTO sync_queue (id, type, payload, status) VALUES (?, ?, ?, 'pending')`,
      [id, type, JSON.stringify(payload)]
    );

    // Attempt immediate sync if online
    const netState = await NetInfo.fetch();
    if (netState.isConnected && netState.isInternetReachable) {
      this.processSyncQueue();
    }

    return id;
  }

  /**
   * Process all pending items in the sync queue.
   * Returns the number of successfully synced items.
   */
  async processSyncQueue(): Promise<number> {
    if (this.isSyncing) return 0;
    this.isSyncing = true;

    let syncedCount = 0;

    try {
      const db = await getDatabase();
      const pendingItems = await db.getAllAsync<{
        id: string;
        type: string;
        payload: string;
        retry_count: number;
      }>(
        `SELECT id, type, payload, retry_count FROM sync_queue 
         WHERE status IN ('pending', 'failed') AND retry_count < ?
         ORDER BY created_at ASC`,
        [MAX_RETRIES]
      );

      for (const item of pendingItems) {
        try {
          // Mark as syncing
          await db.runAsync(
            `UPDATE sync_queue SET status = 'syncing' WHERE id = ?`,
            [item.id]
          );

          // Send to backend
          await this.sendToBackend(item.type, JSON.parse(item.payload));

          // Mark as synced
          await db.runAsync(
            `UPDATE sync_queue SET status = 'synced', last_error = NULL WHERE id = ?`,
            [item.id]
          );

          syncedCount++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          await db.runAsync(
            `UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
            [errorMessage, item.id]
          );

          // Exponential backoff — skip remaining items if network is down
          const netState = await NetInfo.fetch();
          if (!netState.isConnected) break;
        }
      }

      // Cleanup old synced items (keep last 100)
      await db.runAsync(
        `DELETE FROM sync_queue WHERE status = 'synced' AND id NOT IN (
          SELECT id FROM sync_queue WHERE status = 'synced' ORDER BY created_at DESC LIMIT 100
        )`
      );
    } finally {
      this.isSyncing = false;
    }

    return syncedCount;
  }

  /**
   * Get count of pending sync items (for UI badge).
   */
  async getPendingCount(): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'failed')`
    );
    return result?.count ?? 0;
  }

  /**
   * Send a single item to the backend API.
   */
  private async sendToBackend(
    type: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const endpoints: Record<string, string> = {
      user_response: "/api/responses",
      location_update: "/api/locations",
      call_log: "/api/calls",
    };

    const endpoint = endpoints[type];
    if (!endpoint) throw new Error(`Unknown sync type: ${type}`);

    // TODO: Replace with actual API base URL from config
    const baseUrl = "https://api.yourcompany.com";

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // TODO: Add auth token from SecureStore
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
  }
}

import { UserResponse, UserResponseType, LocationSnapshot } from "../types";
import { getDatabase } from "../db/schema";
import { LocationService } from "./LocationService";
import { OfflineSyncService } from "./OfflineSyncService";

/**
 * ResponseService handles the core user action: responding to an alert
 * with a status ("I am Safe", "Need Assistance", etc.) and capturing
 * geolocation at the time of response.
 *
 * This is designed to work offline-first:
 * 1. Capture response + location locally
 * 2. Persist to SQLite immediately
 * 3. Enqueue for sync
 * 4. Sync engine handles upload when connectivity is available
 */
export class ResponseService {
  private static instance: ResponseService;

  static getInstance(): ResponseService {
    if (!ResponseService.instance) {
      ResponseService.instance = new ResponseService();
    }
    return ResponseService.instance;
  }

  /**
   * Submit a user response to an alert.
   * Captures location, persists locally, and queues for sync.
   *
   * @returns The created UserResponse (always succeeds locally, even offline)
   */
  async submitResponse(
    alertId: string,
    userId: string,
    responseType: UserResponseType
  ): Promise<UserResponse> {
    // Capture location concurrently with building the response
    const locationService = LocationService.getInstance();
    let location: LocationSnapshot | null = null;

    try {
      location = await locationService.captureLocation(8000);
    } catch (error) {
      console.warn("Location capture failed during response:", error);
    }

    const response: UserResponse = {
      id: this.generateId(),
      alertId,
      userId,
      response: responseType,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      locationAccuracy: location?.accuracy ?? null,
      respondedAt: new Date().toISOString(),
      syncedAt: null,
    };

    // Persist locally
    await this.persistResponse(response);

    // Queue for backend sync
    const syncService = OfflineSyncService.getInstance();
    await syncService.enqueue("user_response", {
      ...response,
    });

    return response;
  }

  /**
   * Get the user's response for a specific alert (if any).
   */
  async getResponseForAlert(
    alertId: string,
    userId: string
  ): Promise<UserResponse | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      id: string;
      alert_id: string;
      user_id: string;
      response: UserResponseType;
      latitude: number | null;
      longitude: number | null;
      location_accuracy: number | null;
      responded_at: string;
      synced_at: string | null;
    }>(
      `SELECT * FROM user_responses WHERE alert_id = ? AND user_id = ? ORDER BY responded_at DESC LIMIT 1`,
      [alertId, userId]
    );

    if (!row) return null;

    return {
      id: row.id,
      alertId: row.alert_id,
      userId: row.user_id,
      response: row.response,
      latitude: row.latitude,
      longitude: row.longitude,
      locationAccuracy: row.location_accuracy,
      respondedAt: row.responded_at,
      syncedAt: row.synced_at,
    };
  }

  /**
   * Get all responses by the current user (for history view).
   */
  async getUserResponses(userId: string): Promise<UserResponse[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      alert_id: string;
      user_id: string;
      response: UserResponseType;
      latitude: number | null;
      longitude: number | null;
      location_accuracy: number | null;
      responded_at: string;
      synced_at: string | null;
    }>(
      `SELECT * FROM user_responses WHERE user_id = ? ORDER BY responded_at DESC`,
      [userId]
    );

    return rows.map((row) => ({
      id: row.id,
      alertId: row.alert_id,
      userId: row.user_id,
      response: row.response,
      latitude: row.latitude,
      longitude: row.longitude,
      locationAccuracy: row.location_accuracy,
      respondedAt: row.responded_at,
      syncedAt: row.synced_at,
    }));
  }

  // ─── Private Helpers ───────────────────────────────────────────

  private async persistResponse(response: UserResponse): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO user_responses 
       (id, alert_id, user_id, response, latitude, longitude, location_accuracy, responded_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        response.id,
        response.alertId,
        response.userId,
        response.response,
        response.latitude,
        response.longitude,
        response.locationAccuracy,
        response.respondedAt,
        response.syncedAt,
      ]
    );
  }

  private generateId(): string {
    return `resp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

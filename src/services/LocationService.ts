import * as Location from "expo-location";
import { LocationSnapshot } from "../types";

export class LocationService {
  private static instance: LocationService;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Request foreground + background location permissions.
   * Returns true if at least foreground permission was granted.
   */
  async requestPermissions(): Promise<boolean> {
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== "granted") {
      console.warn("Foreground location permission denied");
      return false;
    }

    // Request background for offline sync scenarios
    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== "granted") {
      console.warn(
        "Background location permission denied — offline location capture will be limited"
      );
    }

    return true;
  }

  /**
   * Capture the user's current location with high accuracy.
   * Used at the moment a user responds to an alert.
   * Falls back to last known location if GPS fix fails within timeout.
   */
  async captureLocation(timeoutMs: number = 10000): Promise<LocationSnapshot | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: timeoutMs,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? -1,
        altitude: location.coords.altitude,
        timestamp: new Date(location.timestamp).toISOString(),
      };
    } catch (error) {
      console.warn("High-accuracy location failed, trying last known:", error);

      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          return {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            accuracy: lastKnown.coords.accuracy ?? -1,
            altitude: lastKnown.coords.altitude,
            timestamp: new Date(lastKnown.timestamp).toISOString(),
          };
        }
      } catch (fallbackError) {
        console.error("Last known location also failed:", fallbackError);
      }

      return null;
    }
  }

  /**
   * Check if location services are enabled on the device.
   */
  async isLocationEnabled(): Promise<boolean> {
    return Location.hasServicesEnabledAsync();
  }
}

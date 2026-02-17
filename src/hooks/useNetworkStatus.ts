import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useAppStore } from "../store/useAppStore";

/**
 * Hook that subscribes to network state changes and updates the global store.
 * Mount this once at the app root.
 */
export function useNetworkStatus(): void {
  const setNetwork = useAppStore((s) => s.setNetwork);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetwork({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    return () => unsubscribe();
  }, [setNetwork]);
}

/**
 * AetherExpense — OTA Updates Engine (expo-updates)
 *
 * Provides manual update checking, downloading, and hot-reloading
 * for offline-first Expo applications.
 */

import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

/**
 * Manually checks for OTA updates from the update server.
 * Handles offline failures, development mode guards, and user confirmation prompts.
 */
export async function manualUpdateCheck(): Promise<void> {
  // Check if updates are enabled (OTA is disabled in local __DEV__ / Expo Go)
  if (__DEV__ || !Updates.isEnabled) {
    Alert.alert(
      'Development Mode',
      'Over-The-Air (OTA) updates are disabled in development builds. Updates are only checked in standalone production builds.'
    );
    return;
  }

  try {
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      Alert.alert(
        'Update Available',
        'A new version of AetherExpense is ready. Download and apply the update now?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Update Now',
            onPress: async () => {
              try {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              } catch (err) {
                Alert.alert(
                  'Download Failed',
                  `Failed to download update: ${err instanceof Error ? err.message : String(err)}`
                );
              }
            },
          },
        ]
      );
    } else {
      Alert.alert('App Up to Date', 'You are running the latest version of AetherExpense.');
    }
  } catch (error) {
    Alert.alert(
      'Offline / Connection Notice',
      'Could not check for updates. Please ensure you are connected to the internet and try again.'
    );
  }
}

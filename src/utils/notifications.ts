/**
 * AetherExpense — Local Device Notifications Manager
 *
 * 100% Offline Local Device Notifications via `expo-notifications`.
 * Zero Firebase / Remote Server / Cloud dependencies.
 * Handles bill payment reminders, notification cancellation on pay/delete, and duplicate prevention.
 * Uses lazy require & environment detection to ensure route imports never crash in Expo Go.
 */

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { getPrivacyMode } from './security';

// Detect whether running in Expo Go (StoreClient)
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo';

let Notifications: any = null;

// Lazily & safely load expo-notifications only outside Expo Go
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }

    if (Platform.OS === 'android' && Notifications && typeof Notifications.setNotificationChannelAsync === 'function') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Bill Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      }).catch((err: any) => console.warn('[Notifications] Android channel setup warning:', err));
    }
  } catch (err) {
    console.warn('[Notifications] Could not load expo-notifications in current environment:', err);
    Notifications = null;
  }
}

/**
 * Requests local notification permissions. Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (isExpoGo || !Notifications) {
    console.log('[Notifications] Local bill notifications require a development build (skipped in Expo Go).');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('[Notifications] Error requesting permissions:', err);
    return false;
  }
}

/**
 * Schedules a local device notification for a bill reminder.
 * Returns the notificationId string or null if not scheduled/permission denied.
 */
export async function scheduleBillNotification(
  billId: string,
  billName: string,
  amountFormatted: string,
  dueDateStr: string,
  reminderDaysBefore: number = 1
): Promise<string | null> {
  if (isExpoGo || !Notifications) {
    console.log('[Notifications] Local bill notification scheduling skipped in Expo Go.');
    return null;
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    // Parse due date YYYY-MM-DD
    const parts = dueDateStr.split('-').map(Number);
    if (parts.length < 3) return null;

    // Trigger date = due date minus reminderDaysBefore at 09:00 AM local time
    const triggerDate = new Date(parts[0], parts[1] - 1, parts[2], 9, 0, 0);
    triggerDate.setDate(triggerDate.getDate() - reminderDaysBefore);

    // If trigger date has already passed, skip scheduling
    if (triggerDate.getTime() <= Date.now()) {
      return null;
    }

    const isPrivacy = await getPrivacyMode();
    const notifTitle = isPrivacy ? 'Bill Due Reminder' : `Bill Due Reminder: ${billName}`;
    const notifBody = isPrivacy
      ? `You have a bill due on ${dueDateStr}.`
      : `${billName} of ${amountFormatted} is due on ${dueDateStr}.`;

    // Schedule local notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title:     notifTitle,
        body:      notifBody,
        sound:     true,
        channelId: 'default',
        data:      { billId },
      },
      trigger: triggerDate as any,
    });

    return notificationId;
  } catch (err) {
    console.warn('[Notifications] Error scheduling bill notification:', err);
    return null;
  }
}

/**
 * Cancels a scheduled notification by its notification identifier.
 */
export async function cancelBillNotification(notificationId?: string | null): Promise<void> {
  if (!notificationId || isExpoGo || !Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (err) {
    console.warn('[Notifications] Error cancelling notification:', err);
  }
}

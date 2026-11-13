// The "rest over" alert. This is the only place omaFIT uses notifications (see eslint.config.js).
// When rest starts, the phone is asked to show one local notification with sound when it ends, so the user
// hears it even in another app. It is created on the phone: no push service, no server, nothing is sent anywhere.
import {
  AndroidImportance,
  cancelScheduledNotificationAsync,
  dismissAllNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Alert, Platform } from 'react-native';

const CHANNEL_ID = 'rest-timer';

let setUp = false;

/** Lets the alert play its sound (with a short banner) when omaFIT is open too. */
function setUpOnce() {
  if (setUp) return;
  setUp = true;
  setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldShowBanner: true,
      shouldShowList: false,
      shouldSetBadge: false,
    }),
  });
}

/** Explains why before Android's own permission prompt. Resolves true if the user wants to continue. */
const explain = () =>
  new Promise<boolean>(resolve =>
    Alert.alert(
      'Hear when rest is over?',
      'omaFIT can play a sound when your rest ends, even if you switch to another app. ' +
        'It needs permission to show notifications. They are only used for the rest timer.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

/**
 * Gets rest alerts ready. Asks for permission the first time only; if the user already said no, it doesn't ask
 * again (they can turn notifications on in the phone's settings). Resolves whether alerts can be shown.
 */
export async function prepareRestAlerts(): Promise<boolean> {
  try {
    setUpOnce();
    if (Platform.OS === 'android') {
      await setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Rest timer',
        description: 'A sound when rest between sets is over.',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: [0, 400, 200, 400],
      });
    }
    const current = await getPermissionsAsync();
    if (current.granted) return true;
    if (current.status !== 'undetermined' || !current.canAskAgain) return false;
    if (!(await explain())) return false;
    return (await requestPermissionsAsync()).granted;
  } catch (e) {
    console.warn('Rest alerts unavailable', e instanceof Error ? e.message : '');
    return false;
  }
}

/** Schedules the alert for `seconds` from now. Returns its id, or null if it couldn't be scheduled. */
export async function scheduleRestAlert(seconds: number): Promise<string | null> {
  try {
    return await scheduleNotificationAsync({
      content: { title: 'Rest over', body: 'Time for your next set.', sound: 'default' },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: CHANNEL_ID,
      },
    });
  } catch (e) {
    console.warn('Could not schedule rest alert', e instanceof Error ? e.message : '');
    return null;
  }
}

/** Cancels a scheduled alert (rest skipped, restarted or the session closed). */
export async function cancelRestAlert(id: string) {
  try {
    await cancelScheduledNotificationAsync(id);
  } catch {
    // Already shown or gone: nothing to cancel
  }
}

/** Removes "Rest over" alerts still sitting in the notification shade, once the user is back in the app. */
export async function clearShownRestAlerts() {
  try {
    await dismissAllNotificationsAsync();
  } catch {
    // Nothing shown
  }
}

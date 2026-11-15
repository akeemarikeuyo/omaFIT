// The "rest over" alert. This is the only place omaFIT uses notifications (see eslint.config.js).
// When rest starts, the phone is asked to show one local notification with sound when it ends, so the user
// hears it even in another app. It is created on the phone: no push service, no server, nothing is sent anywhere.
import {
  AndroidImportance,
  cancelScheduledNotificationAsync,
  dismissNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { getSettings, saveSettings } from '../storage/store';

const CHANNEL_ID = 'rest-timer';
// Every rest alert uses this one id: scheduling a new rest replaces the old one, so there is never more than one
// scheduled or shown at a time
const ALERT_ID = 'rest-over';

let setUp: Promise<void> | null = null;

/** Lets the alert play its sound (with a short banner) when omaFIT is open, and creates the Android channel. */
function setUpOnce() {
  setUp ??= (async () => {
    setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldShowBanner: true,
        shouldShowList: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Rest timer',
        description: 'A sound when rest between sets is over.',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: [0, 500],
      });
    }
  })();
  return setUp;
}

/** Explains why before the phone's own permission prompt. Resolves true if the user wants to continue. */
/** 'yes' / 'no' when the user taps a button; 'closed' if the dialog went away without an answer (ask again later). */
const explain = () =>
  new Promise<'yes' | 'no' | 'closed'>(resolve =>
    Alert.alert(
      'Turn on notifications?',
      'omaFIT uses them for one thing: a sound when your rest between sets is over, even if you switch to another ' +
        'app. Nothing else, and nothing is sent anywhere. You can change this later in your phone settings.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve('no') },
        { text: 'Turn on', onPress: () => resolve('yes') },
      ],
      { cancelable: true, onDismiss: () => resolve('closed') },
    ),
  );

/**
 * Asks once, on the first launch after install (or after this update), whether to turn on rest alerts. Never asks
 * again: if the user says no, they can turn notifications on in the phone's settings.
 */
export async function offerRestAlertsOnce() {
  try {
    if ((await getSettings()).notificationsAsked) return;
    await setUpOnce();
    const current = await getPermissionsAsync();
    if (!current.granted && current.status === 'undetermined' && current.canAskAgain) {
      const answer = await explain();
      // Only a real answer counts: if the dialog was closed some other way, ask again next launch
      if (answer === 'closed') return;
      // Alerts and sound only: omaFIT never sets an app-icon badge (iOS would otherwise ask for that too)
      if (answer === 'yes') await requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    }
    await saveSettings({ notificationsAsked: true });
  } catch (e) {
    console.warn('Could not ask about rest alerts', e instanceof Error ? e.message : '');
  }
}

/** Gets rest alerts ready, without asking anything. Resolves whether alerts can be shown. */
export async function prepareRestAlerts(): Promise<boolean> {
  try {
    await setUpOnce();
    return (await getPermissionsAsync()).granted;
  } catch (e) {
    console.warn('Rest alerts unavailable', e instanceof Error ? e.message : '');
    return false;
  }
}

// Schedule and cancel run one after another, in the order they were called, so a slow schedule for an old rest
// can never land after a newer schedule or a cancel
let queue: Promise<unknown> = Promise.resolve();
function inOrder<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

/** Schedules the alert for `seconds` from now, replacing any earlier one. Resolves whether it was scheduled. */
export function scheduleRestAlert(seconds: number): Promise<boolean> {
  return inOrder(async () => {
    try {
      // An old "Rest over" still in the notification shade goes away when a new rest starts
      await dismissNotificationAsync(ALERT_ID).catch(() => {});
      await scheduleNotificationAsync({
        identifier: ALERT_ID,
        content: { title: 'Rest over', body: 'Time for your next set.', sound: 'default' },
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.round(seconds)),
          channelId: CHANNEL_ID,
        },
      });
      return true;
    } catch (e) {
      console.warn('Could not schedule rest alert', e instanceof Error ? e.message : '');
      return false;
    }
  });
}

/** Cancels the scheduled alert (rest skipped, restarted or the session closed). */
export function cancelRestAlert(): Promise<void> {
  return inOrder(async () => {
    await cancelScheduledNotificationAsync(ALERT_ID).catch(() => {});
  });
}

/** Removes the "Rest over" alert from the notification shade, once the user is back in the app. */
export async function clearShownRestAlerts() {
  try {
    await dismissNotificationAsync(ALERT_ID);
  } catch {
    // Nothing shown
  }
}

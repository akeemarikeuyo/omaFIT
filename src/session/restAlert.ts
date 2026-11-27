// The "rest over" alert, and the notification setup shared with posture breaks (src/session/postureReminders.ts).
// These are the only places omaFIT uses notifications (see eslint.config.js).
// When rest starts, the phone is asked to show one local notification with sound when it ends, so the user
// hears it even in another app. It is created on the phone: no push service, no server, nothing is sent anywhere.
import {
  AndroidImportance,
  cancelScheduledNotificationAsync,
  dismissNotificationAsync,
  getExactAlarmPermissionsAsync,
  getPermissionsAsync,
  requestExactAlarmPermissionsAsync,
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
/** Posture-break reminders' ids start with this (see postureReminders.ts) */
export const POSTURE_BREAK_PREFIX = 'posture-break-';

let setUp: Promise<void> | null = null;
let lastSoundAt = 0;

/**
 * While omaFIT is open the alert is just a sound (no banner: the rest bar is on screen). In another app or with the
 * screen off, Android shows it as a notification with sound and vibration. Also creates the Android channel.
 */
export function setUpOnce() {
  setUp ??= (async () => {
    setNotificationHandler({
      handleNotification: async notification => {
        // Posture breaks stay quiet while omaFIT is open: the user is already here
        if (notification.request.identifier.startsWith(POSTURE_BREAK_PREFIX)) {
          return { shouldPlaySound: false, shouldShowBanner: false, shouldShowList: false, shouldSetBadge: false };
        }
        // The in-app alert and Android's scheduled one can land together: play one sound, not two
        const now = Date.now();
        const play = now - lastSoundAt > 3000;
        if (play) lastSoundAt = now;
        return { shouldPlaySound: play, shouldShowBanner: false, shouldShowList: false, shouldSetBadge: false };
      },
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

/** 'yes' / 'no' when the user taps a button; 'closed' if the dialog went away without an answer (ask again later). */
const explain = () =>
  new Promise<'yes' | 'no' | 'closed'>(resolve =>
    Alert.alert(
      'Turn on notifications?',
      'omaFIT uses them for a sound when your rest between sets is over, even if you switch to another app, and ' +
        'for posture-break reminders if you turn them on in Settings. Nothing is sent anywhere. You can change ' +
        'this later in your phone settings.',
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
    const settings = await getSettings();
    await setUpOnce();
    if (settings.notificationsAsked) {
      // Already answered (e.g. before on-time alerts existed): offer the on-time setting once
      if (!settings.onTimeAlertsAsked && (await getPermissionsAsync()).granted) await offerOnTimeAlerts();
      return;
    }
    const current = await getPermissionsAsync();
    // Android 13+ reports a never-asked notification permission as "denied" with canAskAgain, not "undetermined",
    // so ask whenever it isn't granted and the system still lets us ask
    if (!current.granted && current.canAskAgain) {
      const answer = await explain();
      // Only a real answer counts: if the dialog was closed some other way, ask again next launch
      if (answer === 'closed') return;
      // Alerts and sound only: omaFIT never sets an app-icon badge (iOS would otherwise ask for that too)
      if (answer === 'yes') await requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    }
    await saveSettings({ notificationsAsked: true });
    // With notifications on, make sure Android can deliver them on time
    if ((await getPermissionsAsync()).granted) await offerOnTimeAlerts();
  } catch (e) {
    console.warn('Could not ask about rest alerts', e instanceof Error ? e.message : '');
  }
}

// ---------- on-time delivery (Android 12+) ----------
// Without the "Alarms & reminders" permission, Android schedules the alert as an inexact alarm and may deliver it
// seconds to minutes late. On Android 13+ the user has to switch it on in a system settings page.

const needsExactAlarmPermission = () => Platform.OS === 'android' && Number(Platform.Version) >= 31;

async function canAlertOnTime(): Promise<boolean> {
  if (!needsExactAlarmPermission()) return true;
  try {
    return (await getExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

const explainOnTime = () =>
  new Promise<boolean>(resolve =>
    Alert.alert(
      'Get rest alerts on time?',
      "Android can delay omaFIT's rest alert by a minute or more to save battery. On the next screen, switch on " +
        '"Allow setting alarms and reminders" for omaFIT, then come back. It\'s only used for the rest timer.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Open settings', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

/** Explains and opens Android's "Alarms & reminders" page for omaFIT, if rest alerts could be late. */
async function offerOnTimeAlerts() {
  if (await canAlertOnTime()) return;
  const go = await explainOnTime();
  await saveSettings({ onTimeAlertsAsked: true });
  if (go) await requestExactAlarmPermissionsAsync();
}

export type RestAlertStatus = 'off' | 'late' | 'onTime';

/** For Settings: notifications off, on but possibly late, or on time. */
export async function restAlertStatus(): Promise<RestAlertStatus> {
  try {
    if (!(await getPermissionsAsync()).granted) return 'off';
    return (await canAlertOnTime()) ? 'onTime' : 'late';
  } catch {
    return 'off';
  }
}

/** For Settings: asks for whatever is missing (notifications, then on-time delivery). */
export async function fixRestAlerts(): Promise<void> {
  try {
    await setUpOnce();
    const current = await getPermissionsAsync();
    if (!current.granted) {
      if (!current.canAskAgain) {
        Alert.alert('Notifications are off', 'Turn on notifications for omaFIT in your phone settings, then come back.');
        return;
      }
      const res = await requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
      if (!res.granted) return;
    }
    await offerOnTimeAlerts();
  } catch (e) {
    console.warn('Could not update rest alerts', e instanceof Error ? e.message : '');
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

/**
 * Rest just ended while omaFIT is open: sound the alert now instead of waiting for Android's alarm, which can be
 * late. Replaces the scheduled one (same id), so it never sounds twice.
 */
export function soundRestAlertNow(): Promise<void> {
  return inOrder(async () => {
    try {
      await cancelScheduledNotificationAsync(ALERT_ID).catch(() => {});
      await scheduleNotificationAsync({
        identifier: ALERT_ID,
        content: { title: 'Rest over', body: 'Time for your next set.', sound: 'default' },
        trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
      });
    } catch (e) {
      console.warn('Could not sound rest alert', e instanceof Error ? e.message : '');
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

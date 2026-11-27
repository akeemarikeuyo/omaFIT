// Opt-in posture-break reminders: Monday to Friday, every 90 minutes between the user's work hours, a short posture
// check (never an exercise: people are at work). Local notifications made on the phone: no push service, no
// server, nothing is sent anywhere. Off until the user turns them on in Settings.
import {
  AndroidImportance,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { getSettings, saveSettings, Settings } from '../storage/store';
import { POSTURE_BREAK_PREFIX, setUpOnce } from './restAlert';

const CHANNEL_ID = 'posture-breaks';
export const BREAK_EVERY_MINUTES = 90;
export const DEFAULT_BREAK_HOURS = { startHour: 9, endHour: 17 };
/** Monday to Friday, in expo-notifications' numbering (1 = Sunday) */
const WORKDAYS = [2, 3, 4, 5, 6];

/** Posture checks only: nothing that needs space, kit or changing clothes. */
const MESSAGES = [
  'Sit back in your chair and let your shoulders drop.',
  'Is your screen at eye level? Bring it up rather than your head down.',
  'Stand up and walk for a minute: get some water.',
  'Unclench your jaw and relax your shoulders away from your ears.',
  'Feet flat, hips to the back of the chair, let it hold your back.',
  'Look at something far away for 20 seconds.',
  'Chin back a little, as if your head sits on top of your spine.',
];

/** Times of day for the reminders: every 90 minutes after the start hour, before the end hour. */
export function breakTimes(startHour: number, endHour: number): { hour: number; minute: number }[] {
  const out: { hour: number; minute: number }[] = [];
  for (let m = startHour * 60 + BREAK_EVERY_MINUTES; m < endHour * 60; m += BREAK_EVERY_MINUTES) {
    out.push({ hour: Math.floor(m / 60), minute: m % 60 });
  }
  return out;
}

async function cancelAll() {
  const scheduled = await getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(n => n.identifier.startsWith(POSTURE_BREAK_PREFIX))
      .map(n => cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

/** Makes the phone's schedule match the setting. Safe to call any time (e.g. at launch). */
export async function syncPostureBreaks(settings?: Settings): Promise<void> {
  try {
    const s = settings ?? (await getSettings());
    await cancelAll();
    const cfg = s.postureBreaks;
    if (!cfg?.on || !(await getPermissionsAsync()).granted) return;
    await setUpOnce();
    if (Platform.OS === 'android') {
      await setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Posture breaks',
        description: 'Short posture reminders during your work hours.',
        importance: AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
    let i = 0;
    for (const weekday of WORKDAYS) {
      for (const t of breakTimes(cfg.startHour, cfg.endHour)) {
        const body = MESSAGES[i++ % MESSAGES.length];
        await scheduleNotificationAsync({
          identifier: `${POSTURE_BREAK_PREFIX}${weekday}-${t.hour}-${t.minute}`,
          content: { title: 'Posture break', body, sound: 'default' },
          trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday, hour: t.hour, minute: t.minute, channelId: CHANNEL_ID },
        });
      }
    }
  } catch (e) {
    console.warn('Could not schedule posture breaks', e instanceof Error ? e.message : '');
  }
}

/** Turns reminders on or off from Settings. Asks for notifications if needed. Resolves whether they're on. */
export async function setPostureBreaks(on: boolean, hours = DEFAULT_BREAK_HOURS): Promise<boolean> {
  if (on) {
    const current = await getPermissionsAsync();
    if (!current.granted) {
      if (!current.canAskAgain) {
        Alert.alert('Notifications are off', 'Turn on notifications for omaFIT in your phone settings, then try again.');
        return false;
      }
      const res = await requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
      if (!res.granted) return false;
    }
  }
  await saveSettings({ postureBreaks: { on, ...hours } });
  await syncPostureBreaks();
  return on;
}

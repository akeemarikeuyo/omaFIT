import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, Text, TextInput, Vibration, View } from 'react-native';
import { KeyboardAwareScrollView } from '../components/KeyboardAware';
import { PainPicker } from '../components/PainPicker';
import { Button, ScalePicker } from '../components/ui';
import { cleanPains, lowerBackScore, maxPain, painsOf, redFlagsFor } from '../data/pain';
import { EffectiveExercise, effectiveSession } from '../data/effective';
import { Session } from '../data/plan';
import { RootStackParamList } from '../navigation';
import { cancelRestAlert, clearShownRestAlerts, prepareRestAlerts, scheduleRestAlert } from '../session/restAlert';
import {
  deleteLog,
  getSettings,
  lastPerformance,
  newLogId,
  PainEntry,
  restSecondsFor,
  saveWorkout,
  SetLog,
  unfinishedToday,
  WorkoutLog,
} from '../storage/store';
import { colors, space, ui } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

interface SetState {
  reps: string;
  weight: string;
  done: boolean;
}

const isTimed = (reps: string) => /s\b|sec/i.test(reps);
const firstNumber = (reps: string) => {
  const m = reps.match(/\d+/g);
  return m ? m[m.length - 1] : '';
};

/** Vibration when rest ends in the app and the notification sound isn't available. */
const REST_OVER_VIBRATION = [0, 400, 200, 400];

/** Wait this long after typing before saving, so every keystroke isn't a write. Ticks save at the same pace. */
const SAVE_DELAY_MS = 400;

const numberOrUndefined = (s: string) => {
  const n = Number(s);
  return s && !Number.isNaN(n) ? n : undefined;
};

/** The sets as they'll be saved, including untouched ones, so a resumed session looks exactly as it was left. */
function toSetLogs(exercises: EffectiveExercise[], sets: Record<string, SetState[]>): SetLog[] {
  return exercises.flatMap(ex =>
    (sets[ex.id] ?? []).map((s, i) => ({
      exerciseId: ex.id,
      setIndex: i,
      done: s.done,
      reps: numberOrUndefined(s.reps),
      weightKg: numberOrUndefined(s.weight),
    })),
  );
}

export default function SessionScreen({ route, navigation }: Props) {
  // A workout shouldn't be interrupted by the screen locking. Normal locking returns when the session closes.
  useKeepAwake();
  const { sessionId } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [exercises, setExercises] = useState<EffectiveExercise[]>([]);
  const [sets, setSets] = useState<Record<string, SetState[]>>({});
  const [lastText, setLastText] = useState<Record<string, string>>({});
  const [pains, setPains] = useState<PainEntry[]>([]);
  // Pain is asked on strength days only. The posture routine stays short and is saved as "pain not asked".
  const asksPain = sessionId !== 'posture';
  const [effort, setEffort] = useState(3);
  const [notes, setNotes] = useState('');
  const [restSeconds, setRestSeconds] = useState(60);
  // Rest is stored as the time it ends, so it stays right while the app is in the background
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [alertsOff, setAlertsOff] = useState(false);
  const alertsReady = useRef<Promise<boolean> | null>(null);
  const alertId = useRef<string | null>(null);
  // Bumped whenever rest starts or stops, so a late-arriving schedule for an old rest gets cancelled
  const restGen = useRef(0);
  const rest = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;

  // The workout is saved as it goes. Its id and start time, once the first set is ticked (or when resuming).
  const logId = useRef<string | null>(null);
  const startedAt = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [resumed, setResumed] = useState(false);
  const finishing = useRef(false);
  // Saves run one after another, so an older save can never overwrite a newer one
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    (async () => {
      const { session: s, exercises: exs } = await effectiveSession(sessionId);
      const open = await unfinishedToday(sessionId);
      setSession(s);
      setExercises(exs);
      setRestSeconds(restSecondsFor(s, await getSettings()));
      navigation.setOptions({ title: s.title });
      const initial: Record<string, SetState[]> = {};
      const last: Record<string, string> = {};
      for (const ex of exs) {
        const prev = await lastPerformance(ex.id, open?.id);
        const prevWeight = prev?.find(p => p.weightKg != null)?.weightKg;
        const weight = ex.targetWeightKg ?? prevWeight;
        initial[ex.id] = Array.from({ length: ex.sets }, (_, i) => {
          const saved = open?.sets.find(x => x.exerciseId === ex.id && x.setIndex === i);
          if (saved) {
            return { reps: saved.reps != null ? String(saved.reps) : '', weight: saved.weightKg != null ? String(saved.weightKg) : '', done: saved.done };
          }
          return {
            reps: isTimed(ex.reps) ? '' : firstNumber(ex.reps),
            weight: ex.loaded && weight != null ? String(weight) : '',
            done: false,
          };
        });
        if (prev) {
          last[ex.id] = prev
            .map(p => [p.weightKg != null ? `${p.weightKg}kg` : null, p.reps != null ? `${p.reps}` : null].filter(Boolean).join(' x ') || '✓')
            .join(', ');
        }
      }
      if (open) {
        logId.current = open.id;
        startedAt.current = open.date;
        setPains(painsOf(open));
        setEffort(open.effort);
        setNotes(open.notes);
        setResumed(true);
      }
      setSets(initial);
      setLastText(last);
      setLoaded(true);
    })();
  }, [sessionId, navigation]);

  /** Saves the workout so far as unfinished. Nothing is saved until a set is ticked; untick them all and it's removed. */
  const saveProgress = useCallback(
    (snapshot: { sets: Record<string, SetState[]>; pains: PainEntry[]; effort: number; notes: string }) => {
      if (finishing.current) return;
      const setLogs = toSetLogs(exercises, snapshot.sets);
      const anyDone = setLogs.some(s => s.done);
      saveQueue.current = saveQueue.current
        .then(async () => {
          if (!anyDone) {
            if (logId.current) await deleteLog(logId.current);
            logId.current = null;
            startedAt.current = null;
            return;
          }
          logId.current ??= newLogId();
          startedAt.current ??= new Date().toISOString();
          const log: WorkoutLog = {
            id: logId.current,
            kind: 'session',
            date: startedAt.current,
            session: sessionId,
            sets: setLogs,
            backPain: asksPain ? lowerBackScore(cleanPains(snapshot.pains)) : 0,
            pains: asksPain ? cleanPains(snapshot.pains) : [],
            ...(asksPain ? {} : { painRated: false }),
            effort: snapshot.effort,
            notes: snapshot.notes,
            finished: false,
          };
          await saveWorkout(log);
        })
        .catch(() => console.warn('Could not save workout progress'));
    },
    [exercises, sessionId, asksPain],
  );

  // Save shortly after any change. The latest state is also saved when the app goes to the background or the
  // session closes, so nothing ticked is lost.
  const latest = useRef({ sets, pains, effort, notes });
  useEffect(() => {
    latest.current = { sets, pains, effort, notes };
    if (!loaded) return;
    const t = setTimeout(() => saveProgress(latest.current), SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [loaded, sets, pains, effort, notes, saveProgress]);

  useEffect(() => {
    if (!loaded) return;
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') saveProgress(latest.current);
    });
    return () => {
      sub.remove();
      saveProgress(latest.current);
    };
  }, [loaded, saveProgress]);

  const cancelAlert = useCallback(() => {
    const id = alertId.current;
    alertId.current = null;
    if (id) void cancelRestAlert(id);
  }, []);

  /** Asks the phone to sound the alert when rest ends, so it's heard even in another app. */
  const scheduleAlert = async (endsAt: number, gen: number) => {
    alertsReady.current ??= prepareRestAlerts();
    const ok = await alertsReady.current;
    setAlertsOff(!ok);
    if (!ok || gen !== restGen.current) return;
    const seconds = (endsAt - Date.now()) / 1000;
    if (seconds < 1) return;
    const id = await scheduleRestAlert(seconds);
    if (!id) return;
    if (gen !== restGen.current) void cancelRestAlert(id);
    else alertId.current = id;
  };

  const startRest = (seconds: number) => {
    cancelAlert();
    const gen = ++restGen.current;
    const endsAt = Date.now() + seconds * 1000;
    setNow(Date.now());
    setRestEndsAt(endsAt);
    void scheduleAlert(endsAt, gen);
  };

  const skipRest = () => {
    restGen.current++;
    cancelAlert();
    setRestEndsAt(null);
  };

  // Tick while resting. Uses the end time, so coming back from another app shows the right number at once.
  useEffect(() => {
    if (!restEndsAt) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t < restEndsAt) return;
      // Rest is over. The scheduled notification plays the sound; without it, vibrate if the user is here now.
      if (!alertId.current && t - restEndsAt < 1500) Vibration.vibrate(REST_OVER_VIBRATION);
      alertId.current = null;
      setRestEndsAt(null);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [restEndsAt]);

  // Back in the app: tidy away any "Rest over" alert left in the notification shade
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void clearShownRestAlerts();
    });
    return () => sub.remove();
  }, []);

  // Leaving the session: no alert for a rest that no longer matters
  useEffect(
    () => () => {
      restGen.current++;
      cancelAlert();
    },
    [cancelAlert],
  );

  const update = (exId: string, i: number, patch: Partial<SetState>) => {
    setSets(prev => ({ ...prev, [exId]: prev[exId].map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  };

  const toggleDone = (exId: string, i: number) => {
    const wasDone = sets[exId][i].done;
    update(exId, i, { done: !wasDone });
    if (!wasDone && session) startRest(restSeconds);
  };

  const totalSets = Object.values(sets).reduce((n, a) => n + a.length, 0);
  const doneSets = Object.values(sets).reduce((n, a) => n + a.filter(s => s.done).length, 0);

  const finish = async () => {
    if (doneSets === 0) return Alert.alert('Tick off at least one set first.');
    const rated = asksPain ? cleanPains(pains) : [];
    finishing.current = true;
    // Let any save in progress finish first, then save the final version over it
    await saveQueue.current;
    await saveWorkout({
      id: logId.current ?? newLogId(),
      kind: 'session',
      date: startedAt.current ?? new Date().toISOString(),
      session: sessionId,
      sets: toSetLogs(exercises, sets),
      backPain: lowerBackScore(rated),
      pains: rated,
      ...(asksPain ? {} : { painRated: false }),
      effort,
      notes,
      finished: true,
    });
    if (maxPain(rated) >= 7) {
      Alert.alert('Saved. Take it easy.', `That is a high pain score. ${redFlagsFor(rated.filter(p => p.score >= 7))}`);
    }
    navigation.goBack();
  };

  if (!session) return <View style={ui.screen} />;

  return (
    <View style={ui.screen}>
      {rest > 0 && (
        <Pressable
          onPress={skipRest}
          accessibilityRole="button"
          accessibilityLabel={`Rest, ${rest} seconds left. Tap to skip.`}
          style={{ backgroundColor: colors.purple, padding: space.md, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>Rest {rest}s · tap to skip</Text>
          {alertsOff && (
            <Text style={{ color: '#fff', fontSize: 12, marginTop: 2 }}>
              No sound in other apps. Turn on notifications for omaFIT in phone settings.
            </Text>
          )}
        </Pressable>
      )}
      <KeyboardAwareScrollView contentContainerStyle={ui.content}>
        {resumed && (
          <Text style={[ui.small, { color: colors.accent }]}>
            Continuing where you left off. Your sets save as you tick them.
          </Text>
        )}
        <Text style={ui.muted}>{session.subtitle}</Text>
        <Text style={ui.small}>
          {doneSets}/{totalSets} sets done · {restSeconds} s rest
          {sessionId !== 'posture' ? ' (change in Settings)' : ''}
        </Text>

        {exercises.map((ex, idx) => (
          <View key={ex.id} style={ui.card}>
            <Pressable onPress={() => navigation.navigate('Exercise', { sessionId, exerciseId: ex.id })}>
              <Text style={ui.h3}>
                {idx + 1}. {ex.name} <Text style={{ color: colors.accent }}>▶ demo</Text>
              </Text>
              <Text style={ui.muted}>
                {ex.sets} × {ex.reps}
                {ex.perSide ? ' per side' : ''}
                {ex.targetWeightKg ? ` @ ${ex.targetWeightKg} kg` : ''} · {ex.equipment}
              </Text>
              {!!ex.coachNote && <Text style={[ui.small, { color: colors.accent }]}>Coach: {ex.coachNote}</Text>}
              {!!lastText[ex.id] && <Text style={ui.small}>Last time: {lastText[ex.id]}</Text>}
            </Pressable>

            {(sets[ex.id] ?? []).map((s, i) => (
              <View key={i} style={[ui.row, { marginTop: 2 }]}>
                <Text style={[ui.small, { width: 40 }]}>Set {i + 1}</Text>
                {ex.loaded && (
                  <TextInput
                    style={[ui.input, { flex: 1, paddingVertical: 6 }]}
                    value={s.weight}
                    onChangeText={v => update(ex.id, i, { weight: v.replace(',', '.') })}
                    keyboardType="decimal-pad"
                    placeholder="kg"
                    placeholderTextColor={colors.muted}
                  />
                )}
                {!isTimed(ex.reps) && (
                  <TextInput
                    style={[ui.input, { flex: 1, paddingVertical: 6 }]}
                    value={s.reps}
                    onChangeText={v => update(ex.id, i, { reps: v })}
                    keyboardType="number-pad"
                    placeholder="reps"
                    placeholderTextColor={colors.muted}
                  />
                )}
                {isTimed(ex.reps) && <Text style={[ui.muted, { flex: 1 }]}>{ex.reps}</Text>}
                <Pressable
                  onPress={() => toggleDone(ex.id, i)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: s.done }}
                  style={{
                    width: 40,
                    height: 36,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: s.done ? colors.good : colors.cardAlt,
                    borderWidth: 1,
                    borderColor: s.done ? colors.good : colors.border,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{s.done ? '✓' : ''}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}

        <View style={[ui.card, { gap: space.lg }]}>
          <Text style={ui.h2}>Finish</Text>
          <Text style={ui.small}>
            Ticked sets are already saved.{' '}
            {asksPain ? 'Add any pain, rate your effort, then finish' : 'Rate your effort, then finish'} to complete the
            workout.
          </Text>
          {asksPain && <PainPicker value={pains} onChange={setPains} />}
          <ScalePicker
            label="How hard was it?"
            min={1}
            max={5}
            value={effort}
            onChange={setEffort}
            lowLabel="very easy"
            highLabel="nothing left"
          />
          <TextInput
            style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Notes for your coach (e.g. RDLs felt it in lower back)"
            placeholderTextColor={colors.muted}
          />
          <Button title="Finish & save workout" onPress={finish} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

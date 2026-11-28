import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../components/Brand';
import { KeyboardAwareScrollView } from '../components/KeyboardAware';
import { Button, Pill, Segmented } from '../components/ui';
import { WeekPlan } from '../components/WeekPlan';
import { EffectiveExercise, effectivePlan } from '../data/effective';
import { planMisfits } from '../data/library';
import { areaInfo, painLabel, painsOf, redFlagsFor } from '../data/pain';
import { dayKind, SESSIONS, SessionId, walkToday } from '../data/plan';
import { dayKey, encouragement, summary } from '../data/progress';
import { upcomingDays } from '../data/week';
import { comebackOffer, startDateForWeek } from '../data/comeback';
import { postureCheckDue, snoozeUntil } from '../data/postureCheck';
import { hasShortVersion, SessionLength, sessionMinutes, shortVersion } from '../data/sessionLength';
import { RootStackParamList } from '../navigation';
import {
  AnyLog,
  getLogs,
  getPostureHistory,
  getSettings,
  PostureAssessment,
  isPainRated,
  isUnfinished,
  nextStrengthSession,
  programWeek,
  restSecondsFor,
  saveSettings,
  Settings,
  unfinishedToday,
  weekOf,
  WorkoutLog,
} from '../storage/store';
import { colors, space, ui } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TodayScreen() {
  const nav = useNavigation<Nav>();
  const [week, setWeek] = useState(1);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plan, setPlan] = useState<Record<SessionId, EffectiveExercise[]> | null>(null);
  const [next, setNext] = useState<'A' | 'B'>('A');
  const [logs, setLogs] = useState<AnyLog[]>([]);
  const [open, setOpen] = useState<WorkoutLog | null>(null);

  const [misfits, setMisfits] = useState<string[]>([]);
  const [postureChecks, setPostureChecks] = useState<PostureAssessment[]>([]);

  const load = useCallback(async () => {
    const s = await getSettings();
    setWeek(programWeek(s.startDate));
    setStartDate(s.startDate);
    setSettings(s);
    setNext(await nextStrengthSession());
    setLogs(await getLogs());
    setOpen(await unfinishedToday());
    setPostureChecks(await getPostureHistory());
    const current = await effectivePlan();
    setPlan(current);
    // Only once the user has picked their own equipment: the default plan fits the default kit
    setMisfits(s.equipment ? planMisfits([...current.posture, ...current.A, ...current.B], s.equipment) : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const today = new Date();
  const userWeek = settings ? weekOf(settings) : undefined;
  const kind = dayKind(today, userWeek);
  const walk = walkToday(today, week, userWeek);
  // "Done" means finished today (your local day). An unfinished workout shows as Continue instead.
  // Done cards open a read-only summary: a finished day isn't edited again.
  const doneToday = logs.filter(l => dayKey(new Date(l.date)) === dayKey(today) && !isUnfinished(l));
  const postureLog = doneToday.find(l => l.kind === 'session' && l.session === 'posture');
  const strengthLog = doneToday.find((l): l is WorkoutLog => l.kind === 'session' && l.session !== 'posture');
  const cardioLog = doneToday.find(l => l.kind === 'cardio');
  // After finishing, show the session that was done, not the next one in the A/B rotation
  const strengthId: SessionId = strengthLog?.session ?? next;
  const view = (l: AnyLog) => nav.navigate('LogDetail', { logId: l.id });

  const stats = summary(logs, today, userWeek);

  // Places rated 6 or more in the last 3 logs that asked about pain (strength days)
  const highPains = logs
    .filter(isPainRated)
    .slice(0, 3)
    .flatMap(painsOf)
    .filter(p => p.score >= 6)
    .filter((p, i, all) => all.findIndex(q => painLabel(q) === painLabel(p)) === i);
  const highSpine = highPains.some(p => areaInfo(p.area).spine);
  const highJoints = highPains.filter(p => !areaInfo(p.area).spine);
  const openDone = open ? open.sets.filter(s => s.done).length : 0;
  const painHigh = highPains.length > 0;

  // Full or Short, remembered from last time
  const length: SessionLength = settings?.sessionLength ?? 'full';
  const chooseLength = (l: SessionLength) => {
    setSettings(cur => (cur ? { ...cur, sessionLength: l } : cur));
    saveSettings({ sessionLength: l }).catch(() => console.warn('Could not save session length'));
  };
  const minutesFor = (id: SessionId, l: SessionLength) => {
    const exs = plan?.[id] ?? [];
    const rest = settings ? restSecondsFor(SESSIONS[id], settings) : SESSIONS[id].restSeconds;
    return sessionMinutes(l === 'short' && hasShortVersion(exs) ? shortVersion(exs) : exs, rest);
  };
  // What's still to do today, for the Full / Short choice
  const todo: SessionId[] = [...(postureLog ? [] : ['posture' as const]), ...(kind === 'strength' && !strengthLog ? [strengthId] : [])];
  const canShorten = !!plan && todo.some(id => hasShortVersion(plan[id]));
  const dayMinutes = (l: SessionLength) => todo.reduce((n, id) => n + minutesFor(id, l), 0);

  const start = (id: SessionId) => nav.navigate('Session', { sessionId: id, short: length === 'short' });

  // Back after a break: offer to pick up the program where the user left off
  const comeback = settings && startDate ? comebackOffer(logs, startDate, settings.comebackAnswered) : null;
  const answerComeback = async (resume: boolean) => {
    if (!comeback) return;
    await saveSettings({
      comebackAnswered: comeback.key,
      ...(resume ? { startDate: startDateForWeek(comeback.resumeWeek) } : {}),
    });
    await load();
  };
  // Every 4 weeks after a posture check, suggest a new one
  const checkDue = settings ? postureCheckDue(postureChecks, settings.postureCheckSnoozedUntil) : null;
  const snoozeCheck = async () => {
    await saveSettings({ postureCheckSnoozedUntil: snoozeUntil() });
    await load();
  };
  const away = comeback && (comeback.daysAway < 28 ? `${comeback.daysAway} days` : `${Math.floor(comeback.daysAway / 7)} weeks`);
  // Today's strength session if today is a strength day, otherwise the next one; the week alternates from there
  const days = startDate ? upcomingDays(today, startDate, kind === 'strength' ? (strengthId as 'A' | 'B') : next, userWeek) : [];

  // Today's checklist, in the order to do it: posture first (the warm-up on strength days), then strength, then the walk
  type Item = { key: string; icon: IconName; title: string; detail: string; log?: AnyLog; go: () => void };
  const items: Item[] = [
    {
      key: 'posture',
      icon: 'body-outline',
      title: SESSIONS.posture.title,
      detail: postureLog
        ? 'Done'
        : `About ${minutesFor('posture', length)} min${kind === 'strength' ? ' · your warm-up' : ''}`,
      log: postureLog,
      go: () => start('posture'),
    },
    ...(kind === 'strength'
      ? [
          {
            key: 'strength',
            icon: 'barbell-outline' as IconName,
            title: SESSIONS[strengthId].title,
            detail: strengthLog ? 'Done' : `About ${minutesFor(strengthId, length)} min${length === 'short' ? ' · short' : ''}`,
            log: strengthLog,
            go: () => start(strengthId),
          },
        ]
      : []),
    ...(kind !== 'rest'
      ? [
          {
            key: 'walk',
            icon: 'walk-outline' as IconName,
            title: walk.title,
            detail: cardioLog?.kind === 'cardio' ? `You did: ${cardioLog.type} · ${cardioLog.minutes} min` : walk.target,
            log: cardioLog,
            go: () => nav.navigate('Walk'),
          },
        ]
      : []),
  ];
  const nextItem = items.find(i => !i.log);
  const dayTitle = { strength: 'Strength day', walk: 'Walk day', longwalk: 'Long walk day', rest: 'Rest day' }[kind];

  // One notice at a time, most important first, so warnings never pile up above the day's plan
  const notice = painHigh ? 'pain' : comeback ? 'comeback' : misfits.length > 0 ? 'misfits' : checkDue != null ? 'check' : null;

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <KeyboardAwareScrollView contentContainerStyle={ui.content}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <Brand />
          <Pressable
            onPress={() => nav.navigate('Tabs', { screen: 'Progress' })}
            accessibilityRole="button"
            accessibilityLabel={`${stats.streak}-day streak. Open progress.`}
            style={[ui.row, { gap: 4, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card }]}
          >
            <Ionicons name="flame" size={18} color={stats.streak > 0 ? colors.accent : colors.muted} />
            <Text style={{ color: stats.streak > 0 ? colors.accent : colors.muted, fontWeight: '800', fontSize: 16 }}>{stats.streak}</Text>
          </Pressable>
        </View>
        <View style={{ gap: 2 }}>
          <Text style={ui.small}>
            {today.toDateString()} · Program week {week}
          </Text>
          <Text style={ui.muted}>{encouragement(stats)}</Text>
        </View>

        {notice === 'pain' && (
          <View style={[ui.card, { borderColor: colors.warn }]}>
            <Text style={[ui.h3, { color: colors.warn }]}>
              Pain has been high recently: {highPains.map(p => painLabel(p).toLowerCase()).join(', ')}
            </Text>
            <Text style={ui.muted}>
              {highSpine ? 'Keep today gentle: posture routine items 1, 6, 7, 8 and 9 plus a walk. ' : ''}
              {highJoints.length
                ? `Go easy on what loads the ${highJoints.map(p => painLabel(p).toLowerCase()).join(' and ')}: ` +
                  `${[...new Set(highJoints.map(p => areaInfo(p.area).loads))].join('; ')}. `
                : ''}
              {redFlagsFor(highPains)}
            </Text>
          </View>
        )}

        {notice === 'comeback' && comeback && (
          <View style={ui.card}>
            <Text style={ui.h2}>Welcome back</Text>
            <Text style={ui.muted}>
              {comeback.neverStarted
                ? `You set up omaFIT ${away} ago. The plan has moved on to week ${comeback.weekNow} without you. `
                : `Your last workout was ${away} ago. The plan has moved on to week ${comeback.weekNow}. `}
              Start at week {comeback.resumeWeek} instead, so the walks and runs match what your body is used to.
            </Text>
            {!comeback.neverStarted && (
              <Text style={ui.small}>Go a little lighter on weights in your first strength session back.</Text>
            )}
            <Button title={`Start at week ${comeback.resumeWeek}`} onPress={() => answerComeback(true)} />
            <Button title={`Keep week ${comeback.weekNow}`} kind="secondary" onPress={() => answerComeback(false)} />
          </View>
        )}

        {notice === 'misfits' && (
          <Pressable onPress={() => nav.navigate('PlanBuilder')} style={[ui.card, { borderColor: colors.warn }]}>
            <Text style={[ui.h3, { color: colors.warn }]}>Your plan needs equipment you don't have</Text>
            <Text style={ui.muted}>
              {misfits.length === 1 ? '1 exercise' : `${misfits.length} exercises`} (e.g. {misfits[0]}) can't be done with
              your equipment. Build my plan swaps them for ones you can do.
            </Text>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Build my plan →</Text>
          </Pressable>
        )}

        {notice === 'check' && checkDue != null && (
          <View style={ui.card}>
            <Text style={ui.h2}>Time for a posture check</Text>
            <Text style={ui.muted}>
              Your last one was {Math.floor(checkDue / 7)} weeks ago. New photos show what has changed since. They go
              only to your AI provider, and omaFIT doesn't keep them.
            </Text>
            <Button title="Check my posture" onPress={() => nav.navigate('PlanBuilder', { checkIn: true })} />
            <Button title="Not now" kind="secondary" onPress={snoozeCheck} />
          </View>
        )}

        {open && (
          <Pressable
            onPress={() => start(open.session)}
            accessibilityRole="button"
            style={[ui.card, { borderColor: colors.accent, borderWidth: 2 }]}
          >
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.h2}>Continue {SESSIONS[open.session].title}</Text>
              <Pill text="Unfinished" />
            </View>
            <Text style={ui.muted}>
              {openDone} of {open.sets.length} sets done. Pick up where you left off.
            </Text>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Continue →</Text>
          </Pressable>
        )}

        <View style={[ui.card, { gap: space.md }, !open && { borderColor: colors.accent, borderWidth: 2 }]}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.h2}>Today</Text>
            <Text style={ui.small}>{dayTitle}</Text>
          </View>

          {canShorten && !open && (
            <View style={{ gap: space.xs }}>
              <Segmented
                options={[
                  { key: 'full', label: `Full · ~${dayMinutes('full')} min` },
                  { key: 'short', label: `Short · ~${dayMinutes('short')} min` },
                ]}
                value={length}
                onChange={chooseLength}
              />
              {length === 'short' && <Text style={ui.small}>Short keeps the key exercises with fewer sets.</Text>}
            </View>
          )}

          {items.map((item, i) => (
            <Pressable
              key={item.key}
              onPress={() => (item.log ? view(item.log) : item.go())}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.detail}. ${item.log ? 'Tap to see what you did.' : 'Tap to start.'}`}
              style={[ui.row, { gap: space.md }]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: item.log ? colors.good : item === nextItem ? colors.accentSoft : colors.cardAlt,
                }}
              >
                <Ionicons
                  name={item.log ? 'checkmark' : item.icon}
                  size={20}
                  color={item.log ? '#fff' : item === nextItem ? colors.accent : colors.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ui.body, { fontWeight: '700' }, !!item.log && { color: colors.muted }]}>
                  {i + 1}. {item.title}
                </Text>
                <Text style={ui.small}>{item.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}

          {kind === 'rest' && (
            <View style={[ui.row, { gap: space.md }]}>
              <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt }}>
                <Ionicons name="moon-outline" size={20} color={colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ui.body, { fontWeight: '700' }]}>Rest</Text>
                <Text style={ui.small}>Recovery is part of the plan. Strength days need it.</Text>
              </View>
            </View>
          )}

          {kind !== 'rest' && !cardioLog && (
            <Text style={ui.small}>Walk at talking pace. Can't walk or run? Skipping counts too.</Text>
          )}

          {!open &&
            (nextItem ? (
              <Button title={`Start ${nextItem.title}`} onPress={nextItem.go} />
            ) : (
              <View style={[ui.row, { justifyContent: 'center' }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.good} />
                <Text style={[ui.body, { color: colors.good, fontWeight: '700' }]}>All done for today</Text>
              </View>
            ))}
        </View>

        {days.length > 0 && (
          <WeekPlan
            days={days}
            plan={plan}
            onOpenExercise={(sessionId, exerciseId) => nav.navigate('Exercise', { sessionId, exerciseId })}
          />
        )}

        <View style={[ui.row, { flexWrap: 'wrap', justifyContent: 'center', gap: space.md }]}>
          <Text style={ui.small}>Other workouts:</Text>
          {(['A', 'B'] as const).map(id => (
            <Text key={id} onPress={() => start(id)} accessibilityRole="button" style={{ color: colors.accent, fontWeight: '700' }}>
              {SESSIONS[id].title}
            </Text>
          ))}
          <Text onPress={() => nav.navigate('Walk')} accessibilityRole="button" style={{ color: colors.accent, fontWeight: '700' }}>
            Walk / run
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

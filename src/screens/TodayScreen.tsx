import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../components/Brand';
import { KeyboardAwareScrollView } from '../components/KeyboardAware';
import { LogRow } from '../components/LogRow';
import { Button, Pill, Segmented } from '../components/ui';
import { WeekPlan } from '../components/WeekPlan';
import { EffectiveExercise, effectivePlan } from '../data/effective';
import { planMisfits } from '../data/library';
import { areaInfo, painLabel, painsOf, redFlagsFor } from '../data/pain';
import { dayKind, SESSIONS, SessionId, walkToday } from '../data/plan';
import { dailyStats, dayKey, encouragement, summary } from '../data/progress';
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
  const last7 = dailyStats(logs, 7);

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

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <KeyboardAwareScrollView contentContainerStyle={ui.content}>
        <Brand />
        <View>
          <Text style={ui.small}>{today.toDateString()} · Program week {week}</Text>
          <Text style={ui.h1}>Today</Text>
        </View>

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

        {comeback && (
          <View style={[ui.card, { borderColor: colors.accent, gap: space.sm }]}>
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

        {checkDue != null && !comeback && (
          <View style={[ui.card, { gap: space.sm }]}>
            <Text style={ui.h2}>Time for a posture check</Text>
            <Text style={ui.muted}>
              Your last one was {Math.floor(checkDue / 7)} weeks ago. New photos show what has changed since. They go
              only to your AI provider, and omaFIT doesn't keep them.
            </Text>
            <Button title="Check my posture" onPress={() => nav.navigate('PlanBuilder', { checkIn: true })} />
            <Button title="Not now" kind="secondary" onPress={snoozeCheck} />
          </View>
        )}

        <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Progress' })} style={ui.card}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.h2}>
              <Text style={{ color: stats.streak > 0 ? colors.accent : colors.text }}>{stats.streak}</Text>-day streak
            </Text>
            <View style={ui.row}>
              {last7.map(d => (
                <View
                  key={d.key}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    // A planned rest day shows dimmer: it keeps the streak
                    backgroundColor: d.active ? colors.accent : dayKind(d.date, userWeek) === 'rest' ? `${colors.accent}66` : colors.cardAlt,
                    borderWidth: d.key === last7[6].key ? 1 : 0,
                    borderColor: colors.accent,
                  }}
                />
              ))}
            </View>
          </View>
          <Text style={ui.muted}>{encouragement(stats)}</Text>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>See progress →</Text>
        </Pressable>

        {misfits.length > 0 && (
          <Pressable onPress={() => nav.navigate('PlanBuilder')} style={[ui.card, { borderColor: colors.warn }]}>
            <Text style={[ui.h3, { color: colors.warn }]}>Your plan needs equipment you don't have</Text>
            <Text style={ui.muted}>
              {misfits.length === 1 ? '1 exercise' : `${misfits.length} exercises`} (e.g. {misfits[0]}) can't be done with
              your equipment. Build my plan swaps them for ones you can do.
            </Text>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Build my plan →</Text>
          </Pressable>
        )}

        {painHigh && (
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

        {canShorten && !open && (
          <View style={{ gap: space.xs }}>
            <Text style={ui.small}>How much time do you have today?</Text>
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

        <Pressable onPress={() => (postureLog ? view(postureLog) : start('posture'))} style={ui.card}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.h2}>{SESSIONS.posture.title}</Text>
            {postureLog && <Pill text="Done" color={colors.good} />}
          </View>
          <Text style={ui.muted}>{postureLog
              ? SESSIONS.posture.subtitle
              : `Daily, about ${minutesFor('posture', length)} min${length === 'short' ? ' (short)' : ''}. Also your warm-up on strength days.`}</Text>
          <CardLink done={!!postureLog} />
        </Pressable>

        {kind === 'strength' && (
          <Pressable
            onPress={() => (strengthLog ? view(strengthLog) : start(strengthId))}
            style={[ui.card, !strengthLog && { borderColor: colors.accent }]}
          >
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.h2}>{SESSIONS[strengthId].title}</Text>
              {strengthLog ? <Pill text="Done" color={colors.good} /> : <Pill text="Today" />}
            </View>
            <Text style={ui.muted}>{SESSIONS[strengthId].subtitle}</Text>
            {!strengthLog && (
              <Text style={ui.small}>
                About {minutesFor(strengthId, length)} min{length === 'short' ? ', short version' : ''}
              </Text>
            )}
            {!strengthLog && (
              <Text style={ui.muted}>Do the posture routine first as your warm-up. Add a 20 min walk later.</Text>
            )}
            <CardLink done={!!strengthLog} />
          </Pressable>
        )}

        {(kind === 'walk' || kind === 'longwalk' || kind === 'strength') && (
          <Pressable
            onPress={() => (cardioLog ? view(cardioLog) : nav.navigate('Walk'))}
            style={[ui.card, kind !== 'strength' && !cardioLog && { borderColor: colors.accent }]}
          >
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.h2}>{walk.title}</Text>
              {cardioLog ? <Pill text="Done" color={colors.good} /> : kind !== 'strength' && <Pill text="Today" />}
            </View>
            <Text style={ui.muted}>
              {cardioLog?.kind === 'cardio' ? `You did: ${cardioLog.type} · ${cardioLog.minutes} min` : walk.target}
            </Text>
            {!cardioLog && (
              <Text style={ui.small}>Weeks {walk.weeks} of the plan. Talking pace. Running shoes, not slides. Can't walk or run? Skipping counts too.</Text>
            )}
            <CardLink done={!!cardioLog} />
          </Pressable>
        )}

        {kind === 'rest' && (
          <View style={ui.card}>
            <Text style={ui.h2}>Rest day</Text>
            <Text style={ui.muted}>Just the posture routine. Strength sessions need the recovery.</Text>
          </View>
        )}

        {days.length > 0 && (
          <WeekPlan
            days={days}
            plan={plan}
            onOpenExercise={(sessionId, exerciseId) => nav.navigate('Exercise', { sessionId, exerciseId })}
          />
        )}

        <View style={ui.card}>
          <Text style={ui.h3}>Start a new session</Text>
          <View style={[ui.row, { flexWrap: 'wrap' }]}>
            {(['A', 'B'] as const).map(id => (
              <Button key={id} title={SESSIONS[id].title} kind="secondary" onPress={() => start(id)} />
            ))}
            <Button title="Walk / run" kind="secondary" onPress={() => nav.navigate('Walk')} />
          </View>
        </View>

        <View style={[ui.row, { justifyContent: 'space-between', marginTop: space.md }]}>
          <Text style={ui.h2}>Recent</Text>
          {logs.length > 3 && (
            <Text onPress={() => nav.navigate('Tabs', { screen: 'Progress' })} style={{ color: colors.accent, fontWeight: '700' }}>
              See all →
            </Text>
          )}
        </View>
        {logs.length === 0 && <Text style={ui.muted}>Nothing logged yet.</Text>}
        {logs.slice(0, 3).map(l => (
          <LogRow key={l.id} log={l} onDeleted={load} />
        ))}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}


/** "Start →" for something to do today; "View →" once it's done (opens a read-only summary). */
function CardLink({ done }: { done: boolean }) {
  return <Text style={{ color: done ? colors.muted : colors.accent, fontWeight: '700' }}>{done ? 'View →' : 'Start →'}</Text>;
}

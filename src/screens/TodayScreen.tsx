import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../components/Brand';
import { KeyboardAwareScrollView } from '../components/KeyboardAware';
import { LogRow } from '../components/LogRow';
import { Button, Pill } from '../components/ui';
import { effectivePlan } from '../data/effective';
import { planMisfits } from '../data/library';
import { areaInfo, painLabel, painsOf, redFlagsFor } from '../data/pain';
import { dayKind, SESSIONS, SessionId, walkToday } from '../data/plan';
import { dailyStats, dayKey, encouragement, summary } from '../data/progress';
import { RootStackParamList } from '../navigation';
import {
  AnyLog,
  getLogs,
  getSettings,
  isPainRated,
  isUnfinished,
  nextStrengthSession,
  programWeek,
  unfinishedToday,
  WorkoutLog,
} from '../storage/store';
import { colors, space, ui } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TodayScreen() {
  const nav = useNavigation<Nav>();
  const [week, setWeek] = useState(1);
  const [next, setNext] = useState<'A' | 'B'>('A');
  const [logs, setLogs] = useState<AnyLog[]>([]);
  const [open, setOpen] = useState<WorkoutLog | null>(null);

  const [misfits, setMisfits] = useState<string[]>([]);

  const load = useCallback(async () => {
    const s = await getSettings();
    setWeek(programWeek(s.startDate));
    setNext(await nextStrengthSession());
    setLogs(await getLogs());
    setOpen(await unfinishedToday());
    // Only once the user has picked their own equipment: the default plan fits the default kit
    if (s.equipment) {
      const plan = await effectivePlan();
      setMisfits(planMisfits([...plan.posture, ...plan.A, ...plan.B], s.equipment));
    } else setMisfits([]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const today = new Date();
  const kind = dayKind(today);
  const walk = walkToday(today, week);
  // "Done" means finished today (your local day). An unfinished workout shows as Continue instead.
  // Done cards open a read-only summary: a finished day isn't edited again.
  const doneToday = logs.filter(l => dayKey(new Date(l.date)) === dayKey(today) && !isUnfinished(l));
  const postureLog = doneToday.find(l => l.kind === 'session' && l.session === 'posture');
  const strengthLog = doneToday.find((l): l is WorkoutLog => l.kind === 'session' && l.session !== 'posture');
  const cardioLog = doneToday.find(l => l.kind === 'cardio');
  // After finishing, show the session that was done, not the next one in the A/B rotation
  const strengthId: SessionId = strengthLog?.session ?? next;
  const view = (l: AnyLog) => nav.navigate('LogDetail', { logId: l.id });

  const stats = summary(logs);
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

  const start = (id: SessionId) => nav.navigate('Session', { sessionId: id });

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
                    backgroundColor: d.active ? colors.accent : colors.cardAlt,
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

        <Pressable onPress={() => (postureLog ? view(postureLog) : start('posture'))} style={ui.card}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.h2}>{SESSIONS.posture.title}</Text>
            {postureLog && <Pill text="Done" color={colors.good} />}
          </View>
          <Text style={ui.muted}>{SESSIONS.posture.subtitle}</Text>
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

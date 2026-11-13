import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../components/Brand';
import { KeyboardAwareScrollView } from '../components/KeyboardAware';
import { Button, Pill } from '../components/ui';
import { areaInfo, painLabel, painsOf, redFlagsFor } from '../data/pain';
import { dayKind, SESSIONS, SessionId, walkForWeek } from '../data/plan';
import { dailyStats, encouragement, summary } from '../data/progress';
import { RootStackParamList } from '../navigation';
import {
  addLog,
  AnyLog,
  CardioLog,
  deleteLog,
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
  const [showWalk, setShowWalk] = useState(false);
  const [open, setOpen] = useState<WorkoutLog | null>(null);

  const load = useCallback(async () => {
    const s = await getSettings();
    setWeek(programWeek(s.startDate));
    setNext(await nextStrengthSession());
    setLogs(await getLogs());
    setOpen(await unfinishedToday());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const today = new Date();
  const kind = dayKind(today);
  const walk = walkForWeek(week);
  const todayStr = today.toISOString().slice(0, 10);
  // "Done" means finished. An unfinished workout shows as Continue instead.
  const doneToday = logs.filter(l => l.date.slice(0, 10) === todayStr && !isUnfinished(l));
  const postureDone = doneToday.some(l => l.kind === 'session' && l.session === 'posture');
  const strengthDone = doneToday.some(l => l.kind === 'session' && l.session !== 'posture');
  const cardioDone = doneToday.some(l => l.kind === 'cardio');

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

  const confirmDelete = (l: AnyLog) =>
    Alert.alert('Delete this entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteLog(l.id); load(); } },
    ]);

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

        <Pressable onPress={() => start('posture')} style={ui.card}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.h2}>{SESSIONS.posture.title}</Text>
            {postureDone && <Pill text="Done" color={colors.good} />}
          </View>
          <Text style={ui.muted}>{SESSIONS.posture.subtitle}</Text>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Start →</Text>
        </Pressable>

        {kind === 'strength' && (
          <Pressable onPress={() => start(next)} style={[ui.card, { borderColor: colors.accent }]}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.h2}>{SESSIONS[next].title}</Text>
              {strengthDone ? <Pill text="Done" color={colors.good} /> : <Pill text="Today" />}
            </View>
            <Text style={ui.muted}>{SESSIONS[next].subtitle}</Text>
            <Text style={ui.muted}>Do the posture routine first as your warm-up. Add a 20 min walk later.</Text>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Start →</Text>
          </Pressable>
        )}

        {(kind === 'walk' || kind === 'longwalk' || kind === 'strength') && (
          <View style={ui.card}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.h2}>{kind === 'strength' ? 'Walk' : kind === 'longwalk' ? 'Long walk' : 'Walk / run'}</Text>
              {cardioDone && <Pill text="Done" color={colors.good} />}
            </View>
            <Text style={ui.body}>
              {kind === 'strength' ? '20 min easy walk' : kind === 'longwalk' ? walk.saturday : walk.weekday}
            </Text>
            <Text style={ui.small}>Weeks {walk.weeks} of the plan. Talking pace. Running shoes, not slides.</Text>
            {showWalk ? (
              <WalkForm
                onDone={async () => {
                  setShowWalk(false);
                  load();
                }}
              />
            ) : (
              <Button title="Log walk / run" kind="secondary" onPress={() => setShowWalk(true)} />
            )}
          </View>
        )}

        {kind === 'rest' && (
          <View style={ui.card}>
            <Text style={ui.h2}>Rest day</Text>
            <Text style={ui.muted}>Just the posture routine. Strength sessions need the recovery.</Text>
          </View>
        )}

        <View style={ui.card}>
          <Text style={ui.h3}>Do a different session</Text>
          <View style={[ui.row, { flexWrap: 'wrap' }]}>
            {(['A', 'B'] as const).map(id => (
              <Button key={id} title={SESSIONS[id].title} kind="secondary" onPress={() => start(id)} />
            ))}
          </View>
        </View>

        <Text style={[ui.h2, { marginTop: space.md }]}>Recent</Text>
        {logs.length === 0 && <Text style={ui.muted}>Nothing logged yet.</Text>}
        {logs.slice(0, 15).map(l => (
          <Pressable key={l.id} onLongPress={() => confirmDelete(l)} style={[ui.card, ui.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={ui.body}>
                {l.kind === 'cardio' ? `${l.type} · ${l.minutes} min` : SESSIONS[l.session].title}
              </Text>
              <Text style={ui.small}>{new Date(l.date).toDateString()} · long-press to delete</Text>
            </View>
            {isUnfinished(l) && <Text style={{ color: colors.muted, fontWeight: '700' }}>unfinished</Text>}
          </Pressable>
        ))}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function WalkForm({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState<CardioLog['type']>('walk');
  const [minutes, setMinutes] = useState('30');
  const [notes, setNotes] = useState('');

  const save = async () => {
    const m = Number(minutes);
    if (!m || m <= 0) return Alert.alert('Enter the minutes');
    // Pain is asked on strength days only, so a walk is saved as "not asked", never as "no pain"
    await addLog({ kind: 'cardio', date: new Date().toISOString(), type, minutes: m, backPain: 0, painRated: false, notes });
    onDone();
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={ui.row}>
        {(['walk', 'run-walk', 'run'] as const).map(t => (
          <Button key={t} title={t} kind={t === type ? 'primary' : 'secondary'} onPress={() => setType(t)} />
        ))}
      </View>
      <TextInput
        style={ui.input}
        value={minutes}
        onChangeText={setMinutes}
        keyboardType="number-pad"
        placeholder="Minutes"
        placeholderTextColor={colors.muted}
      />
      <TextInput
        style={ui.input}
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes (optional)"
        placeholderTextColor={colors.muted}
      />
      <Button title="Save" onPress={save} />
    </View>
  );
}

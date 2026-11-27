import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChartMode, DailyChart } from '../components/DailyChart';
import { LogRow } from '../components/LogRow';
import { Button, painColor, Segmented } from '../components/ui';
import { EffectiveExercise, effectivePlan } from '../data/effective';
import { SessionId, WeekSetup } from '../data/plan';
import { dailyStats, encouragement, exerciseHistory, painPlaces, summary } from '../data/progress';
import { RootStackParamList } from '../navigation';
import { AnyLog, getLogs, getSettings, weekOf } from '../storage/store';
import { colors, space, ui } from '../theme';

const MODES: { id: ChartMode; label: string }[] = [
  { id: 'sets', label: 'Sets done' },
  { id: 'walk', label: 'Walk min' },
  { id: 'pain', label: 'Pain' },
];
/** History entries shown at a time */
const HISTORY_PAGE = 20;

const RANGES = [
  { days: 14, label: '2 weeks' },
  { days: 30, label: '30 days' },
];

export default function ProgressScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [logs, setLogs] = useState<AnyLog[]>([]);
  const [plan, setPlan] = useState<Record<SessionId, EffectiveExercise[]> | null>(null);
  const [userWeek, setUserWeek] = useState<WeekSetup | undefined>(undefined);
  const [mode, setMode] = useState<ChartMode>('sets');
  const [range, setRange] = useState(14);
  const [historyCount, setHistoryCount] = useState(HISTORY_PAGE);
  const reload = useCallback(() => {
    getLogs().then(setLogs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      getLogs().then(setLogs);
      effectivePlan().then(setPlan);
      getSettings().then(st => setUserWeek(weekOf(st)));
    }, []),
  );

  const s = summary(logs, new Date(), userWeek);
  const days = dailyStats(logs, range);
  const activeDays = days.filter(d => d.active).length;

  const pains = days.flatMap(d => (d.maxPain == null ? [] : [d.maxPain]));
  let caption: string;
  if (mode === 'sets') {
    const sets = days.reduce((n, d) => n + d.postureSets + d.strengthSets, 0);
    caption = `${sets} sets on ${activeDays} of the last ${range} days`;
  } else if (mode === 'walk') {
    const mins = days.reduce((n, d) => n + d.walkMinutes, 0);
    caption = `${mins} min walked in the last ${range} days`;
  } else {
    caption = pains.length
      ? `Worst pain each day, any area. Average ${(pains.reduce((a, b) => a + b, 0) / pains.length).toFixed(1)}/10 on logged days. Lower is better.`
      : 'Nothing logged yet.';
  }
  const places = mode === 'pain' ? painPlaces(logs, days[0].date) : [];

  // Weighted plan exercises with logged weights: first best set → latest best set
  const lifts = (['A', 'B'] as const).flatMap(sessionId =>
    (plan?.[sessionId] ?? [])
      .filter(ex => ex.loaded)
      .map(ex => ({ sessionId, ex, points: exerciseHistory(logs, ex.id).filter(p => p.weightKg != null) }))
      .filter(l => l.points.length > 0),
  );

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScrollView contentContainerStyle={ui.content}>
        <Text style={ui.h1}>Progress</Text>
        <Text style={[ui.body, { color: colors.accent }]}>{encouragement(s)}</Text>

        <View style={[ui.row, { alignItems: 'stretch' }]}>
          <Tile value={s.streak} label="day streak" highlight={s.streak > 0} />
          <Tile value={`${s.activeThisWeek}/${s.daysIntoWeek}`} label="days this week" />
          <Tile value={s.bestStreak} label="best streak" />
        </View>

        <View style={ui.card}>
          <Segmented options={MODES.map(m => ({ key: m.id, label: m.label }))} value={mode} onChange={setMode} />
          <View style={{ marginTop: space.sm }}>
            <DailyChart days={days} mode={mode} />
          </View>
          <Text style={ui.muted}>{caption}</Text>
          {mode === 'pain' && places.length > 0 && (
            <View style={{ gap: 4 }}>
              <Text style={ui.h3}>Where</Text>
              {places.map(p => (
                <View key={p.label} style={[ui.row, { justifyContent: 'space-between' }]}>
                  <Text style={ui.body}>{p.label}</Text>
                  <Text style={ui.small}>
                    {p.days} {p.days === 1 ? 'day' : 'days'} · worst{' '}
                    <Text style={{ color: painColor(p.worst), fontWeight: '700' }}>{p.worst}/10</Text>
                  </Text>
                </View>
              ))}
            </View>
          )}
          {mode === 'pain' && places.length === 0 && pains.length > 0 && (
            <Text style={ui.small}>No pain or discomfort logged in this period.</Text>
          )}
          <Segmented
            options={RANGES.map(r => ({ key: r.days, label: r.label }))}
            value={range}
            onChange={setRange}
          />
        </View>

        <View style={[ui.row, { alignItems: 'stretch' }]}>
          <Tile value={s.totalWorkouts} label="workouts logged" />
          <Tile value={s.totalWalkMinutes} label="walk minutes" />
        </View>

        {lifts.length > 0 && (
          <View style={[ui.card, { gap: space.sm }]}>
            <Text style={ui.h3}>Strength progress</Text>
            <Text style={ui.small}>Best weight, first logged → latest. Tap one for the chart.</Text>
            {lifts.map(({ sessionId, ex, points }) => {
              const first = points[0].weightKg ?? 0;
              const last = points[points.length - 1].weightKg ?? 0;
              return (
                <Pressable
                  key={ex.id}
                  onPress={() => nav.navigate('Exercise', { sessionId, exerciseId: ex.id })}
                  accessibilityRole="button"
                  style={[ui.row, { justifyContent: 'space-between' }]}
                >
                  <Text style={[ui.body, { flex: 1 }]} numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <Text style={[ui.small, last > first && { color: colors.good, fontWeight: '700' }]}>
                    {first === last ? `${last} kg` : `${first} → ${last} kg`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[ui.h2, { marginTop: space.md }]}>History</Text>
        <Text style={ui.small}>Tap an entry to see what you did. Long-press to delete it.</Text>
        {logs.length === 0 && <Text style={ui.muted}>Nothing logged yet.</Text>}
        {logs.slice(0, historyCount).map(l => (
          <LogRow key={l.id} log={l} onDeleted={reload} />
        ))}
        {logs.length > historyCount && (
          <Button title="Show more" kind="secondary" onPress={() => setHistoryCount(n => n + HISTORY_PAGE)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ value, label, highlight }: { value: number | string; label: string; highlight?: boolean }) {
  return (
    <View style={[ui.card, { flex: 1, alignItems: 'center', gap: 2 }, highlight && { borderColor: colors.accent }]}>
      <Text style={{ color: highlight ? colors.accent : colors.text, fontSize: 26, fontWeight: '800' }}>{value}</Text>
      <Text style={[ui.small, { textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

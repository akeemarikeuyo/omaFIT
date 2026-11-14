import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChartMode, DailyChart } from '../components/DailyChart';
import { painColor, Segmented } from '../components/ui';
import { dailyStats, encouragement, painPlaces, summary } from '../data/progress';
import { AnyLog, getLogs } from '../storage/store';
import { colors, space, ui } from '../theme';

const MODES: { id: ChartMode; label: string }[] = [
  { id: 'sets', label: 'Sets done' },
  { id: 'walk', label: 'Walk min' },
  { id: 'pain', label: 'Pain' },
];
const RANGES = [
  { days: 14, label: '2 weeks' },
  { days: 30, label: '30 days' },
];

export default function ProgressScreen() {
  const [logs, setLogs] = useState<AnyLog[]>([]);
  const [mode, setMode] = useState<ChartMode>('sets');
  const [range, setRange] = useState(14);

  useFocusEffect(
    useCallback(() => {
      getLogs().then(setLogs);
    }, []),
  );

  const s = summary(logs);
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

import React from 'react';
import { Text, View } from 'react-native';
import { DayStats } from '../data/progress';
import { colors, space, ui } from '../theme';
import { painColor } from './ui';

export type ChartMode = 'sets' | 'walk' | 'pain';

const CHART_HEIGHT = 140;
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Segment {
  value: number;
  color: string;
}

function segmentsFor(d: DayStats, mode: ChartMode): Segment[] {
  if (mode === 'sets') {
    return [
      { value: d.postureSets, color: colors.purple },
      { value: d.strengthSets, color: colors.accent },
    ].filter(s => s.value > 0);
  }
  if (mode === 'walk') return d.walkMinutes > 0 ? [{ value: d.walkMinutes, color: colors.good }] : [];
  // Pain-free days still get a short bar so they read as a logged, good day
  return d.maxPain == null ? [] : [{ value: Math.max(d.maxPain, 0.4), color: painColor(d.maxPain) }];
}

const total = (segs: Segment[]) => segs.reduce((n, s) => n + s.value, 0);

/** Bar chart with one column per day, oldest on the left and today on the right. */
export function DailyChart({ days, mode }: { days: DayStats[]; mode: ChartMode }) {
  const columns = days.map(d => ({ d, segs: segmentsFor(d, mode) }));
  const max = mode === 'pain' ? 10 : Math.max(1, ...columns.map(c => total(c.segs)));
  const showValues = days.length <= 14;
  const todayKey = days[days.length - 1]?.key;

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT + 16, gap: 3 }}>
        {columns.map(({ d, segs }) => {
          const sum = total(segs);
          const label = mode === 'pain' ? d.maxPain : sum;
          return (
            <View
              key={d.key}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
              accessible
              accessibilityLabel={`${d.date.toDateString()}: ${segs.length ? `${label} ${unit(mode)}` : 'nothing logged'}`}
            >
              {showValues && segs.length > 0 && (
                <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 2 }}>{label}</Text>
              )}
              {segs.length === 0 ? (
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
              ) : (
                <View
                  style={{
                    width: '100%',
                    maxWidth: 22,
                    height: Math.max(3, (sum / max) * CHART_HEIGHT),
                    borderRadius: 4,
                    overflow: 'hidden',
                    flexDirection: 'column-reverse',
                  }}
                >
                  {segs.map((s, i) => (
                    <View key={i} style={{ flex: s.value, backgroundColor: s.color }} />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 3 }}>
        {days.map((d, i) => {
          const isToday = d.key === todayKey;
          // On the 30-day view, label only Mondays and today
          const show = showValues || isToday || d.date.getDay() === 1;
          return (
            <Text
              key={d.key}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 10,
                color: isToday ? colors.accent : colors.muted,
                fontWeight: isToday ? '800' : '400',
              }}
              numberOfLines={1}
            >
              {show ? (showValues ? WEEKDAY[d.date.getDay()] : String(d.date.getDate())) : ''}
            </Text>
          );
        })}
      </View>

      {mode === 'sets' && (
        <View style={[ui.row, { gap: space.lg }]}>
          <Legend color={colors.purple} text="Posture" />
          <Legend color={colors.accent} text="Strength" />
        </View>
      )}
    </View>
  );
}

function unit(mode: ChartMode) {
  return mode === 'sets' ? 'sets' : mode === 'walk' ? 'minutes' : 'back pain out of 10';
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={ui.row}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={ui.small}>{text}</Text>
    </View>
  );
}

// "Your progress" for one exercise: best set per workout as bars, oldest on the left.
import React from 'react';
import { Text, View } from 'react-native';
import { ExercisePoint, pointValue } from '../data/progress';
import { colors, space, ui } from '../theme';

const CHART_HEIGHT = 110;
/** Workouts shown in the chart */
const SHOWN = 12;

const setText = (p: ExercisePoint) =>
  [p.weightKg != null ? `${p.weightKg} kg` : null, p.reps != null ? `${p.reps} reps` : null].filter(Boolean).join(' × ') || 'done';

export function ExerciseProgress({ points, swapped }: { points: ExercisePoint[]; swapped?: boolean }) {
  if (points.length === 0) {
    return (
      <View style={ui.card}>
        <Text style={ui.h3}>Your progress</Text>
        <Text style={ui.muted}>Nothing logged yet. Your best set from each workout shows here.</Text>
      </View>
    );
  }
  const byWeight = points.some(p => p.weightKg != null);
  const shown = points.slice(-SHOWN);
  const max = Math.max(1, ...shown.map(p => pointValue(p, byWeight)));
  const first = points[0];
  const last = points[points.length - 1];
  const best = points.reduce((a, b) => (pointValue(b, byWeight) > pointValue(a, byWeight) ? b : a));
  const change = pointValue(last, byWeight) - pointValue(first, byWeight);
  const unit = byWeight ? 'kg' : 'reps';

  return (
    <View style={[ui.card, { gap: space.sm }]}>
      <Text style={ui.h3}>Your progress</Text>
      <View
        style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT + 32, gap: 4 }}
        accessible
        accessibilityLabel={`Best ${byWeight ? 'weight' : 'reps'} over your last ${shown.length} workouts, from ${pointValue(shown[0], byWeight)} to ${pointValue(shown[shown.length - 1], byWeight)} ${unit}.`}
      >
        {shown.map((p, i) => {
          const v = pointValue(p, byWeight);
          const d = new Date(p.date);
          return (
            <View key={`${p.date}-${i}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
              <Text style={[ui.small, { fontSize: 10 }]}>{v || ''}</Text>
              <View
                style={{
                  width: '100%',
                  height: Math.max(3, (v / max) * CHART_HEIGHT),
                  borderRadius: 4,
                  backgroundColor: i === shown.length - 1 ? colors.accent : colors.purple,
                }}
              />
              <Text style={[ui.small, { fontSize: 10 }]}>{`${d.getDate()}/${d.getMonth() + 1}`}</Text>
            </View>
          );
        })}
      </View>
      <Text style={ui.body}>
        Best: {setText(best)} · Last: {setText(last)}
      </Text>
      {points.length > 1 && (
        <Text style={[ui.small, { color: change > 0 ? colors.good : colors.muted }]}>
          {change > 0
            ? `Up ${Math.round(change * 10) / 10} ${unit} since your first logged workout.`
            : change < 0
              ? `${Math.round(-change * 10) / 10} ${unit} below your first logged workout. Lighter days are part of training.`
              : 'Same as your first logged workout.'}
        </Text>
      )}
      {swapped && <Text style={ui.small}>Includes workouts from before this exercise was swapped in.</Text>}
    </View>
  );
}

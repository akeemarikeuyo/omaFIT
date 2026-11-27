// "Your week": today and the next six days from the plan. Tap a day to see its exercises.
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { EffectiveExercise } from '../data/effective';
import { SESSIONS, SessionId } from '../data/plan';
import { PlannedDay } from '../data/week';
import { colors, space, ui } from '../theme';
import { Pill } from './ui';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(i: number, d: Date) {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return `${WEEKDAY[d.getDay()]} ${d.getDate()}`;
}

/** One line per day, e.g. "Posture · Strength Day A · Walk 20 min" */
function daySummary(day: PlannedDay) {
  const parts = ['Posture'];
  if (day.strength) parts.push(SESSIONS[day.strength].title);
  parts.push(day.walk ? day.walk.target : 'Rest');
  return parts.join(' · ');
}

function ExerciseList({
  id,
  exercises,
  onOpen,
}: {
  id: SessionId;
  exercises: EffectiveExercise[];
  onOpen: (sessionId: SessionId, exerciseId: string) => void;
}) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={ui.h3}>{SESSIONS[id].title}</Text>
      {exercises.map((ex, i) => (
        <Pressable key={ex.id} onPress={() => onOpen(id, ex.id)} hitSlop={4} accessibilityRole="button">
          <Text style={ui.body}>
            {i + 1}. {ex.name}{' '}
            <Text style={ui.small}>
              {ex.sets} × {ex.reps}
              {ex.perSide ? ' per side' : ''}
              {ex.targetWeightKg ? ` @ ${ex.targetWeightKg} kg` : ''}
            </Text>
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function WeekPlan({
  days,
  plan,
  onOpenExercise,
}: {
  days: PlannedDay[];
  plan: Record<SessionId, EffectiveExercise[]> | null;
  onOpenExercise: (sessionId: SessionId, exerciseId: string) => void;
}) {
  // Tomorrow starts open, so what's coming next is in view
  const [openDay, setOpenDay] = useState<number | null>(1);

  return (
    <View style={[ui.card, { gap: space.sm }]}>
      <Text style={ui.h2}>Your week</Text>
      {days.map((day, i) => {
        const isOpen = openDay === i;
        return (
          <View key={day.date.toDateString()} style={{ gap: space.sm }}>
            <Pressable
              onPress={() => setOpenDay(isOpen ? null : i)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${dayLabel(i, day.date)}: ${daySummary(day)}. Tap to ${isOpen ? 'hide' : 'show'} exercises.`}
              style={[ui.row, { alignItems: 'flex-start' }]}
            >
              <Text style={[ui.h3, { width: 84, color: i <= 1 ? colors.accent : colors.text }]}>{dayLabel(i, day.date)}</Text>
              <Ionicons
                name={day.kind === 'strength' ? 'barbell-outline' : day.kind === 'rest' ? 'moon-outline' : 'walk-outline'}
                size={16}
                color={colors.muted}
                style={{ marginTop: 2 }}
              />
              <Text style={[day.kind === 'rest' ? ui.muted : ui.body, { flex: 1 }]}>{daySummary(day)}</Text>
              <Text style={ui.small}>{isOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {isOpen && (
              <View style={{ gap: space.md, paddingLeft: space.md, borderLeftWidth: 2, borderLeftColor: colors.border }}>
                {day.kind === 'rest' && <Pill text="Rest day" />}
                {day.strength && plan && <ExerciseList id={day.strength} exercises={plan[day.strength]} onOpen={onOpenExercise} />}
                {plan && <ExerciseList id="posture" exercises={plan.posture} onOpen={onOpenExercise} />}
                {day.walk ? (
                  <View style={{ gap: 2 }}>
                    <Text style={ui.h3}>{day.walk.title}</Text>
                    <Text style={ui.body}>{day.walk.target}</Text>
                  </View>
                ) : (
                  <Text style={ui.muted}>No walk or strength: recovery is part of the plan.</Text>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

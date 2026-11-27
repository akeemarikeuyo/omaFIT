// A finished workout or walk, read-only. Logged days stay as they were: nothing here can be edited.
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { painColor } from '../components/ui';
import { exerciseLabel } from '../data/effective';
import { painLabel, painsOf } from '../data/pain';
import { SESSIONS } from '../data/plan';
import { RootStackParamList } from '../navigation';
import { AnyLog, getLogs, isPainRated, isUnfinished, SetLog } from '../storage/store';
import { colors, space, ui } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LogDetail'>;

const EFFORT = ['', 'very easy', 'easy', 'moderate', 'hard', 'nothing left'];
const CARDIO = { walk: 'Walk', 'run-walk': 'Run-walk', run: 'Run', skipping: 'Skipping' } as const;

const setText = (s: SetLog) =>
  [s.weightKg != null ? `${s.weightKg} kg` : null, s.reps != null ? `${s.reps}` : null].filter(Boolean).join(' × ') || '✓';

/** Sets grouped by exercise, in the order they were logged. */
function byExercise(sets: SetLog[]) {
  const groups: { id: string; done: SetLog[]; total: number; skipped: boolean }[] = [];
  for (const s of sets) {
    let g = groups.find(x => x.id === s.exerciseId);
    if (!g) groups.push((g = { id: s.exerciseId, done: [], total: 0, skipped: false }));
    g.total++;
    if (s.skipped) g.skipped = true;
    if (s.done) g.done.push(s);
  }
  return groups;
}

export default function LogDetailScreen({ route, navigation }: Props) {
  const [log, setLog] = useState<AnyLog | null | undefined>(undefined);

  useEffect(() => {
    getLogs().then(all => {
      const l = all.find(x => x.id === route.params.logId) ?? null;
      setLog(l);
      if (l) navigation.setOptions({ title: l.kind === 'cardio' ? CARDIO[l.type] : SESSIONS[l.session].title });
    });
  }, [route.params.logId, navigation]);

  if (log === undefined) return <View style={ui.screen} />;
  if (log === null) {
    return (
      <View style={[ui.screen, { padding: space.lg }]}>
        <Text style={ui.muted}>This entry was deleted.</Text>
      </View>
    );
  }

  const when = new Date(log.date);
  const pains = painsOf(log);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <View style={ui.card}>
        <Text style={ui.small}>
          {when.toDateString()} · {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {log.kind === 'cardio' ? (
          <Text style={ui.h2}>
            {CARDIO[log.type]} · {log.minutes} min
          </Text>
        ) : (
          <>
            <Text style={ui.h2}>{SESSIONS[log.session].title}</Text>
            <Text style={ui.muted}>
              {log.sets.filter(s => s.done).length} of {log.sets.length} sets done
              {log.finished !== false && log.effort ? ` · effort ${log.effort}/5 (${EFFORT[log.effort]})` : ''}
            </Text>
          </>
        )}
        {isUnfinished(log) && <Text style={[ui.small, { color: colors.warn }]}>Not finished.</Text>}
        <Text style={ui.small}>Logged entries can't be edited. To delete one, long-press it in History on the Progress tab.</Text>
      </View>

      {log.kind === 'session' &&
        byExercise(log.sets).map(g => (
          <View key={g.id} style={[ui.card, { gap: 2 }]}>
            <Text style={ui.h3}>{exerciseLabel(g.id)}</Text>
            <Text style={g.done.length ? ui.body : ui.muted}>
              {g.done.length ? g.done.map(setText).join(',  ') : 'Skipped'}
            </Text>
            {g.done.length > 0 && g.done.length < g.total && (
              <Text style={ui.small}>
                {g.done.length} of {g.total} sets{g.skipped ? ', skipped the rest' : ''}
              </Text>
            )}
          </View>
        ))}

      {isPainRated(log) && (
        <View style={[ui.card, { gap: 4 }]}>
          <Text style={ui.h3}>Pain or discomfort</Text>
          {pains.length === 0 && <Text style={ui.muted}>None logged.</Text>}
          {pains.map((p, i) => (
            <View key={i} style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.body}>{painLabel(p)}</Text>
              <Text style={{ color: painColor(p.score), fontWeight: '700' }}>{p.score}/10</Text>
            </View>
          ))}
        </View>
      )}

      {!!log.notes && (
        <View style={ui.card}>
          <Text style={ui.h3}>Notes</Text>
          <Text style={ui.body}>{log.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
}

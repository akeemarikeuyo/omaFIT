// One logged workout or walk in a list (Today's latest entries, Progress history). Tap to view, long-press to delete.
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SESSIONS } from '../data/plan';
import { RootStackParamList } from '../navigation';
import { AnyLog, deleteLog, isUnfinished } from '../storage/store';
import { colors, ui } from '../theme';

const CARDIO = { walk: 'Walk', 'run-walk': 'Run-walk', run: 'Run', skipping: 'Skipping' } as const;

export const logTitle = (l: AnyLog) => (l.kind === 'cardio' ? `${CARDIO[l.type]} · ${l.minutes} min` : SESSIONS[l.session].title);

export function LogRow({ log, onDeleted }: { log: AnyLog; onDeleted: () => void }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const confirmDelete = () =>
    Alert.alert('Delete this entry?', `${logTitle(log)}, ${new Date(log.date).toDateString()}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteLog(log.id); onDeleted(); } },
    ]);

  return (
    <Pressable
      onPress={() => nav.navigate('LogDetail', { logId: log.id })}
      onLongPress={confirmDelete}
      accessibilityRole="button"
      accessibilityHint="Opens the details. Long-press to delete."
      style={[ui.card, ui.row, { justifyContent: 'space-between' }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={ui.body}>{logTitle(log)}</Text>
        <Text style={ui.small}>{new Date(log.date).toDateString()}</Text>
      </View>
      {isUnfinished(log) && <Text style={{ color: colors.muted, fontWeight: '700' }}>unfinished</Text>}
    </Pressable>
  );
}

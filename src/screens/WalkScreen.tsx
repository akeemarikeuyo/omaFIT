// Log a walk or run: today's target from the plan, type, minutes, any pain or discomfort, notes.
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from '../components/KeyboardAware';
import { PainPicker } from '../components/PainPicker';
import { Button, Segmented } from '../components/ui';
import { cleanPains, lowerBackScore, maxPain, redFlagsFor } from '../data/pain';
import { CardioType, walkToday, WalkToday } from '../data/plan';
import { RootStackParamList } from '../navigation';
import { addLog, getSettings, PainEntry, programWeek } from '../storage/store';
import { colors, space, ui } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Walk'>;

const TYPES: { key: CardioType; label: string }[] = [
  { key: 'walk', label: 'Walk' },
  { key: 'run-walk', label: 'Run-walk' },
  { key: 'run', label: 'Run' },
  { key: 'skipping', label: 'Skipping' },
];

export default function WalkScreen({ navigation }: Props) {
  const [plan, setPlan] = useState<WalkToday | null>(null);
  const [type, setType] = useState<CardioType>('walk');
  const [minutes, setMinutes] = useState('');
  const [pains, setPains] = useState<PainEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      const p = walkToday(new Date(), programWeek(s.startDate));
      setPlan(p);
      setType(p.type);
      setMinutes(String(p.minutes));
      navigation.setOptions({ title: p.title });
    });
  }, [navigation]);

  const save = async () => {
    const m = Number(minutes);
    if (!m || m <= 0) return Alert.alert('Enter the minutes');
    setSaving(true);
    const rated = cleanPains(pains);
    await addLog({
      kind: 'cardio',
      date: new Date().toISOString(),
      type,
      minutes: Math.round(m),
      backPain: lowerBackScore(rated),
      pains: rated,
      notes: notes.trim(),
    });
    if (maxPain(rated) >= 7) {
      Alert.alert('Saved. Take it easy.', `That is a high pain score. ${redFlagsFor(rated.filter(p => p.score >= 7))}`);
    }
    navigation.goBack();
  };

  if (!plan) return <View style={ui.screen} />;

  return (
    <KeyboardAwareScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <View style={[ui.card, { borderColor: colors.accent }]}>
        <Text style={ui.small}>Today's plan · weeks {plan.weeks}</Text>
        <Text style={ui.h2}>{plan.target}</Text>
        <Text style={ui.muted}>Talking pace: you should be able to speak in full sentences. Running shoes, not slides.</Text>
      </View>

      <View style={[ui.card, { gap: space.md }]}>
        <Text style={ui.h3}>What did you do?</Text>
        <Segmented options={TYPES} value={type} onChange={setType} />
        <View style={{ gap: space.xs }}>
          <Text style={ui.h3}>Minutes</Text>
          <TextInput
            style={ui.input}
            value={minutes}
            onChangeText={v => setMinutes(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="Minutes"
            placeholderTextColor={colors.muted}
            maxLength={3}
          />
        </View>
      </View>

      <View style={ui.card}>
        <PainPicker value={pains} onChange={setPains} />
      </View>

      <View style={[ui.card, { gap: space.md }]}>
        <TextInput
          style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Notes (optional), e.g. route, how your knees felt"
          placeholderTextColor={colors.muted}
        />
        <Button title="Save walk / run" onPress={save} loading={saving} />
      </View>
    </KeyboardAwareScrollView>
  );
}

// First-run setup: a few short steps so new users don't have to hunt through Settings.
// Everything here can be changed later in Settings. The AI step can be skipped: the app works without a key.
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AISettings } from '../components/AISettings';
import { KeyboardAwareScrollView } from '../components/KeyboardAware';
import { LogoMark, TAGLINE, Wordmark } from '../components/Brand';
import { Button, Segmented } from '../components/ui';
import { DEFAULT_LEVEL, LEVELS, levelInfo, TrainingLevel } from '../data/level';
import { BODYWEIGHT, EQUIPMENT_OPTIONS, toggleEquipmentKey } from '../data/library';
import { RootStackParamList } from '../navigation';
import { offerRestAlertsOnce } from '../session/restAlert';
import { saveSettings } from '../storage/store';
import { colors, space, ui } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Setup'>;

// Steps, in order. "About you" and the AI key are optional.
const WELCOME = 0;
const LEVEL = 1;
const ABOUT = 2;
const EQUIPMENT = 3;
const AI = 4;
const STEPS = 5;

export default function SetupScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<TrainingLevel>(DEFAULT_LEVEL);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [goals, setGoals] = useState('');
  const [sitting, setSitting] = useState('');
  const [health, setHealth] = useState('');

  const finish = async () => {
    const hours = Number(sitting);
    const profile = {
      ...(goals.trim() ? { goals: goals.trim() } : {}),
      ...(hours > 0 && hours <= 24 ? { sittingHoursPerDay: Math.round(hours) } : {}),
      ...(health.trim() ? { healthNotes: health.trim() } : {}),
    };
    await saveSettings({
      level,
      equipment: equipment.length ? equipment : [BODYWEIGHT],
      onboarded: true,
      ...(Object.keys(profile).length ? { profile } : {}),
    });
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    // Now that they're in, ask once about the rest-over alert
    // Wait until the switch to Today has finished: a dialog opened mid-transition can be closed straight away
    setTimeout(() => void offerRestAlertsOnce(), 900);
  };

  const next = () => (step < STEPS - 1 ? setStep(step + 1) : finish());

  return (
    <SafeAreaView style={ui.screen}>
      <KeyboardAwareScrollView contentContainerStyle={[ui.content, { flexGrow: 1 }]}>
        <View style={[ui.row, { justifyContent: 'center', gap: 6, marginBottom: space.md }]} accessibilityLabel={`Step ${step + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View
              key={i}
              style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? colors.accent : colors.cardAlt }}
            />
          ))}
        </View>

        {step === WELCOME && (
          <View style={{ gap: space.lg, alignItems: 'center', paddingTop: space.lg }}>
            <LogoMark size={120} />
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Wordmark size={34} />
              <Text style={[ui.muted, { fontStyle: 'italic' }]}>{TAGLINE}</Text>
            </View>
            <View style={[ui.card, { gap: space.sm, alignSelf: 'stretch' }]}>
              <Text style={ui.body}>• A daily 10-minute posture routine for people who sit a lot</Text>
              <Text style={ui.body}>• Strength days and walks that fit a working week</Text>
              <Text style={ui.body}>• An AI coach (your own key) that tailors the plan to you</Text>
              <Text style={ui.small}>
                Free and open source. No account: your data stays on this phone and goes only to the AI you choose.
              </Text>
            </View>
          </View>
        )}

        {step === LEVEL && (
          <View style={{ gap: space.md }}>
            <Text style={ui.h1}>Your level</Text>
            <Text style={ui.muted}>So your coach knows how hard and how long to make your workouts.</Text>
            <Segmented options={LEVELS.map(l => ({ key: l.id, label: l.label }))} value={level} onChange={setLevel} />
            <View style={ui.card}>
              <Text style={ui.body}>{levelInfo(level).who}</Text>
            </View>
            <Text style={ui.small}>Not sure? Start with Beginner and move up in Settings when it feels easy.</Text>
          </View>
        )}

        {step === ABOUT && (
          <View style={{ gap: space.md }}>
            <Text style={ui.h1}>About you</Text>
            <Text style={ui.muted}>
              Optional, but it makes the biggest difference to your plan. Saved on this phone and sent only to the AI
              you choose.
            </Text>
            <View style={{ gap: space.xs }}>
              <Text style={ui.h3}>Your goals</Text>
              <TextInput
                style={ui.input}
                value={goals}
                onChangeText={setGoals}
                placeholder="e.g. better posture, more strength"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={{ gap: space.xs }}>
              <Text style={ui.h3}>Hours sitting per day</Text>
              <TextInput
                style={ui.input}
                value={sitting}
                onChangeText={v => setSitting(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="e.g. 9"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={{ gap: space.xs }}>
              <Text style={ui.h3}>Any pain, injuries or health notes?</Text>
              <TextInput
                style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={health}
                onChangeText={setHealth}
                multiline
                placeholder="e.g. old knee injury, lower back gets stiff"
                placeholderTextColor={colors.muted}
              />
              <Text style={ui.small}>Your coach avoids loading a painful area. It gives training tips, not medical advice.</Text>
            </View>
            <Text style={ui.small}>Add your name, age and more later in Settings → You.</Text>
          </View>
        )}

        {step === EQUIPMENT && (
          <View style={{ gap: space.md }}>
            <Text style={ui.h1}>Your equipment</Text>
            <Text style={ui.muted}>
              Your coach only picks exercises you can do with what you have. No gym equipment? Just pick Bodyweight.
            </Text>
            <View style={[ui.row, { flexWrap: 'wrap' }]}>
              {EQUIPMENT_OPTIONS.map(o => (
                <Button
                  key={o.key}
                  title={o.label}
                  kind={equipment.includes(o.key) ? 'primary' : 'secondary'}
                  onPress={() => setEquipment(cur => toggleEquipmentKey(cur, o.key))}
                  style={{ paddingHorizontal: space.md, paddingVertical: 8 }}
                />
              ))}
            </View>
            <Text style={ui.small}>
              After setup, run "Build my plan" on the Review tab to fit your workouts to this equipment.
            </Text>
          </View>
        )}

        {step === AI && (
          <View style={{ gap: space.md }}>
            <Text style={ui.h1}>Your AI coach</Text>
            <Text style={ui.muted}>
              Optional. Workouts, logging and progress work without it. Add a key now or later in Settings.
            </Text>
            <Text onPress={finish} accessibilityRole="button" style={{ color: colors.accent, fontWeight: '700' }}>
              Skip for now →
            </Text>
            <AISettings embedded />
          </View>
        )}

        <View style={{ flex: 1 }} />
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Button
            title={step === WELCOME ? "Let's set up" : step === STEPS - 1 ? 'Finish' : step === ABOUT && !goals && !sitting && !health ? 'Skip' : 'Next'}
            onPress={next}
            disabled={step === EQUIPMENT && equipment.length === 0}
          />
          {step === EQUIPMENT && equipment.length === 0 && (
            <Text style={[ui.small, { textAlign: 'center' }]}>Pick at least one (Bodyweight counts).</Text>
          )}
          {step === STEPS - 1 && <Button title="Skip for now" kind="secondary" onPress={finish} />}
          {step > 0 && <Button title="Back" kind="secondary" onPress={() => setStep(step - 1)} />}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

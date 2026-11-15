// First-run setup: a few short steps so new users don't have to hunt through Settings.
// Everything here can be changed later in Settings. The AI step can be skipped: the app works without a key.
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
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

const STEPS = 4;

export default function SetupScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<TrainingLevel>(DEFAULT_LEVEL);
  const [equipment, setEquipment] = useState<string[]>([]);

  const finish = async () => {
    await saveSettings({ level, equipment: equipment.length ? equipment : [BODYWEIGHT], onboarded: true });
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    // Now that they're in, ask once about the rest-over alert
    void offerRestAlertsOnce();
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

        {step === 0 && (
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

        {step === 1 && (
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

        {step === 2 && (
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

        {step === 3 && (
          <View style={{ gap: space.md }}>
            <Text style={ui.h1}>Your AI coach</Text>
            <Text style={ui.muted}>
              Optional. Workouts, logging and progress work without it. Add a key now or later in Settings.
            </Text>
            <AISettings embedded />
          </View>
        )}

        <View style={{ flex: 1 }} />
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Button
            title={step === 0 ? "Let's set up" : step === STEPS - 1 ? 'Finish' : 'Next'}
            onPress={next}
            disabled={step === 2 && equipment.length === 0}
          />
          {step === 2 && equipment.length === 0 && (
            <Text style={[ui.small, { textAlign: 'center' }]}>Pick at least one (Bodyweight counts).</Text>
          )}
          {step === STEPS - 1 && <Button title="Skip for now" kind="secondary" onPress={finish} />}
          {step > 0 && <Button title="Back" kind="secondary" onPress={() => setStep(step - 1)} />}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

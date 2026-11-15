import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AISettings } from '../components/AISettings';
import { Button, Segmented } from '../components/ui';
import { DEFAULT_LEVEL, LEVELS, levelInfo, levelOf, TrainingLevel } from '../data/level';
import { DEFAULT_REVIEW_DAY, reviewDayOf, WEEKDAYS } from '../data/reviewSchedule';
import { getSettings, MIN_REST_SECONDS, Profile, REST_OPTIONS, saveSettings } from '../storage/store';
import { DAY_A } from '../data/plan';
import { DEFAULT_EQUIPMENT, EQUIPMENT_OPTIONS, toggleEquipmentKey, userEquipment } from '../data/library';
import { KeyboardAwareScrollView } from '../components/KeyboardAware';
import { colors, space, ui } from '../theme';

/** Profile as text-field values */
type ProfileForm = Record<keyof Required<Profile>, string>;
const EMPTY_PROFILE: ProfileForm = {
  name: '',
  age: '',
  work: '',
  sittingHoursPerDay: '',
  goals: '',
  postureNotes: '',
  healthNotes: '',
};

export default function SettingsScreen() {
  const [startDate, setStartDate] = useState('');
  const [bodyweight, setBodyweight] = useState('');
  const [rest, setRest] = useState(DAY_A.restSeconds);
  const [reviewDay, setReviewDay] = useState(DEFAULT_REVIEW_DAY);
  const [level, setLevel] = useState<TrainingLevel>(DEFAULT_LEVEL);
  const [customRest, setCustomRest] = useState('');
  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE);
  const [equipment, setEquipment] = useState<string[]>(DEFAULT_EQUIPMENT);
  const [equipmentNotes, setEquipmentNotes] = useState('');
  const [personalTab, setPersonalTab] = useState<'profile' | 'equipment'>('profile');

  const load = useCallback(async () => {
    const s = await getSettings();
    setRest(Math.max(MIN_REST_SECONDS, s.restSeconds ?? DAY_A.restSeconds));
    setReviewDay(reviewDayOf(s));
    setLevel(levelOf(s));
    setStartDate(s.startDate);
    setBodyweight(s.bodyweightKg ? String(s.bodyweightKg) : '');
    setEquipment(userEquipment(s));
    setEquipmentNotes(s.equipmentNotes ?? '');
    const p = s.profile ?? {};
    setProfile({
      name: p.name ?? '',
      age: p.age ? String(p.age) : '',
      work: p.work ?? '',
      sittingHoursPerDay: p.sittingHoursPerDay ? String(p.sittingHoursPerDay) : '',
      goals: p.goals ?? '',
      postureNotes: p.postureNotes ?? '',
      healthNotes: p.healthNotes ?? '',
    });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const chooseLevel = async (l: TrainingLevel) => {
    setLevel(l);
    await saveSettings({ level: l });
  };

  const chooseReviewDay = async (day: number) => {
    setReviewDay(day);
    await saveSettings({ reviewDay: day });
  };

  const chooseRest = async (seconds: number) => {
    setRest(seconds);
    await saveSettings({ restSeconds: seconds });
  };

  const saveCustomRest = async () => {
    const v = Math.round(Number(customRest));
    if (!v || v < MIN_REST_SECONDS) return Alert.alert(`Rest must be at least ${MIN_REST_SECONDS} seconds`);
    if (v > 600) return Alert.alert('Keep rest under 10 minutes');
    await chooseRest(v);
    setCustomRest('');
  };

  const saveProgram = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return Alert.alert('Use the date format YYYY-MM-DD');
    const bw = Number(bodyweight);
    await saveSettings({ startDate, bodyweightKg: bodyweight && bw > 0 ? bw : undefined });
    Alert.alert('Saved');
  };

  const saveProfile = async () => {
    const num = (v: string, max: number) => {
      const n = Number(v);
      return v.trim() && n > 0 && n <= max ? n : undefined;
    };
    const text = (v: string) => v.trim() || undefined;
    await saveSettings({
      profile: {
        name: text(profile.name),
        age: num(profile.age, 120),
        work: text(profile.work),
        sittingHoursPerDay: num(profile.sittingHoursPerDay, 24),
        goals: text(profile.goals),
        postureNotes: text(profile.postureNotes),
        healthNotes: text(profile.healthNotes),
      },
    });
    Alert.alert('Saved', 'Your coach will use this from the next chat or review.');
  };

  const toggleEquipment = (key: string) => setEquipment(cur => toggleEquipmentKey(cur, key));

  const saveEquipment = async () => {
    await saveSettings({ equipment, equipmentNotes: equipmentNotes.trim() || undefined });
    Alert.alert('Saved', 'Run "Build my plan" on the Review tab to fit your plan to this equipment.');
  };

  const field = (key: keyof ProfileForm) => ({
    value: profile[key],
    onChangeText: (v: string) => setProfile(p => ({ ...p, [key]: v })),
    placeholderTextColor: colors.muted,
  });

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <KeyboardAwareScrollView contentContainerStyle={ui.content}>
        <Text style={ui.h1}>Settings</Text>

        <AISettings />

        <View style={ui.card}>
          <Text style={ui.h2}>Training level</Text>
          <Segmented options={LEVELS.map(l => ({ key: l.id, label: l.label }))} value={level} onChange={chooseLevel} />
          <Text style={ui.muted}>{levelInfo(level).who}</Text>
          <Text style={ui.small}>
            Your AI coach fits exercise difficulty, sets and session length to this from the next plan, review or chat.
            Not sure? Start with Beginner and move up when it feels easy.
          </Text>
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>Weekly review day</Text>
          <Text style={ui.small}>
            Your weekly AI review opens on this day and stays open until you run it, once a week. Sunday suits most
            plans: it's the rest day, so changes are ready for Monday.
          </Text>
          <Segmented options={WEEKDAYS.map((label, key) => ({ key, label }))} value={reviewDay} onChange={chooseReviewDay} />
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>Rest between sets</Text>
          <Text style={ui.small}>
            Used on strength days. Minimum {MIN_REST_SECONDS} s. The posture routine keeps its short 20 s gaps.
          </Text>
          <View style={[ui.row, { flexWrap: 'wrap' }]}>
            {REST_OPTIONS.map(s => (
              <Button
                key={s}
                title={`${s}s`}
                kind={s === rest ? 'primary' : 'secondary'}
                onPress={() => chooseRest(s)}
                style={{ paddingHorizontal: space.md, paddingVertical: 9 }}
              />
            ))}
          </View>
          {!REST_OPTIONS.includes(rest) && <Text style={[ui.small, { color: colors.accent }]}>Current: {rest} s</Text>}
          <View style={ui.row}>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              value={customRest}
              onChangeText={setCustomRest}
              keyboardType="number-pad"
              placeholder="Other (seconds)"
              placeholderTextColor={colors.muted}
            />
            <Button title="Set" kind="secondary" onPress={saveCustomRest} disabled={!customRest.trim()} />
          </View>
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>Program</Text>
          <Text style={ui.h3}>Start date</Text>
          <Text style={ui.small}>Sets which week of the walking/running plan you are on.</Text>
          <TextInput
            style={ui.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
          />
          <Text style={[ui.h3, { marginTop: space.sm }]}>Bodyweight (kg, optional)</Text>
          <TextInput
            style={ui.input}
            value={bodyweight}
            onChangeText={setBodyweight}
            keyboardType="decimal-pad"
            placeholder="e.g. 62"
            placeholderTextColor={colors.muted}
          />
          <Button title="Save" kind="secondary" onPress={saveProgram} />
        </View>

        <View style={ui.card}>
          <Segmented
            options={[
              { key: 'profile', label: 'About you' },
              { key: 'equipment', label: 'Your equipment' },
            ]}
            value={personalTab}
            onChange={setPersonalTab}
          />

          {personalTab === 'profile' ? (
            <>
              <Text style={ui.small}>
                Optional. Helps your AI coach personalise your posture and workout plan. Saved on this phone only, and sent
                to your AI provider when you chat or run a review.
              </Text>
              <TextInput style={ui.input} placeholder="Name" {...field('name')} />
              <View style={ui.row}>
                <TextInput style={[ui.input, { flex: 1 }]} placeholder="Age" keyboardType="number-pad" {...field('age')} />
                <TextInput
                  style={[ui.input, { flex: 1 }]}
                  placeholder="Hours sitting / day"
                  keyboardType="number-pad"
                  {...field('sittingHoursPerDay')}
                />
              </View>
              <TextInput style={ui.input} placeholder="Work, e.g. software engineer" {...field('work')} />
              <TextInput style={ui.input} placeholder="Goals, e.g. better posture, more strength" {...field('goals')} />
              <TextInput
                style={[ui.input, { minHeight: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="Posture notes, e.g. forward head, rounded shoulders"
                {...field('postureNotes')}
              />
              <TextInput
                style={[ui.input, { minHeight: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="Health notes, e.g. old knee injury, occasional lower back pain"
                {...field('healthNotes')}
              />
              <Button title="Save profile" kind="secondary" onPress={saveProfile} />
            </>
          ) : (
            <>
              <Text style={ui.small}>
                The AI only picks exercises you can do with this. Bodyweight exercises are always included; pick
                "Bodyweight only" if you have no gym equipment. Bands can stand in for cables, and dumbbells for
                kettlebells.
              </Text>
              <View style={[ui.row, { flexWrap: 'wrap' }]}>
                {EQUIPMENT_OPTIONS.map(o => (
                  <Button
                    key={o.key}
                    title={o.label}
                    kind={equipment.includes(o.key) ? 'primary' : 'secondary'}
                    onPress={() => toggleEquipment(o.key)}
                    style={{ paddingHorizontal: space.md, paddingVertical: 8 }}
                  />
                ))}
              </View>
              <TextInput
                style={ui.input}
                value={equipmentNotes}
                onChangeText={setEquipmentNotes}
                placeholder="Notes, e.g. flat bench, dumbbells up to 20 kg"
                placeholderTextColor={colors.muted}
              />
              <Button title="Save equipment" kind="secondary" onPress={saveEquipment} />
            </>
          )}
        </View>

        <Text style={ui.small}>
          omaFIT is free and open source. The coach gives training suggestions, not medical advice.
        </Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

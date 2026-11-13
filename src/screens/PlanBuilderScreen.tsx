import { useFocusEffect } from '@react-navigation/native';
import { currentProvider } from '../api/ai';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { findDemo, imageUrls } from '../api/demos';
import { applyProposal, buildPlan, PhotoView, PosturePhoto } from '../api/planBuilder';
import { Button, Pill } from '../components/ui';
import { exerciseLabel } from '../data/effective';
import { EQUIPMENT_OPTIONS, userEquipment } from '../data/library';
import { SessionId } from '../data/plan';
import { RootStackParamList } from '../navigation';
import { getProposals, getSettings, PlanProposal, Settings } from '../storage/store';
import { colors, space, ui } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanBuilder'>;

const VIEWS: { view: PhotoView; label: string; required: boolean }[] = [
  { view: 'front', label: 'Front', required: true },
  { view: 'left side', label: 'Left side', required: true },
  { view: 'right side', label: 'Right side (optional)', required: false },
];
const SESSION_LABEL: Record<SessionId, string> = { posture: 'Posture routine', A: 'Day A', B: 'Day B' };
const LONG_EDGE = 1024;

/** Picks or takes a photo, then shrinks it on the phone before it is ever sent anywhere. */
async function getPhoto(fromCamera: boolean): Promise<{ uri: string; base64: string } | null> {
  if (fromCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access in your phone settings, or choose a photo instead.');
      return null;
    }
  }
  const pick = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const res = await pick({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const size = a.width >= a.height ? { width: LONG_EDGE, height: null } : { width: null, height: LONG_EDGE };
  const rendered = await ImageManipulator.ImageManipulator.manipulate(a.uri).resize(size).renderAsync();
  const out = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.7, base64: true });
  return out.base64 ? { uri: out.uri, base64: out.base64 } : null;
}

export default function PlanBuilderScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [photos, setPhotos] = useState<Partial<Record<PhotoView, { uri: string; base64: string }>>>({});
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setSettings);
      getProposals().then(p => setProposal(p[0] ?? null));
    }, []),
  );

  const addPhoto = async (view: PhotoView, fromCamera: boolean) => {
    try {
      const p = await getPhoto(fromCamera);
      if (p) setPhotos(cur => ({ ...cur, [view]: p }));
    } catch (e) {
      Alert.alert('Could not use that photo', e instanceof Error ? e.message : String(e));
    }
  };

  const run = async () => {
    const list: PosturePhoto[] = VIEWS.flatMap(v => (photos[v.view] ? [{ view: v.view, base64: photos[v.view]!.base64 }] : []));
    const missing = VIEWS.filter(v => v.required && !photos[v.view]);
    const go = async () => {
      setLoading(true);
      try {
        setProposal(await buildPlan(list));
        setPhotos({}); // photos are only kept for this one request
      } catch (e) {
        Alert.alert('Could not build a plan', e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };
    if (list.length && missing.length) {
      Alert.alert('Add the other photo?', 'Front and side views together give the best posture read.', [
        { text: 'Add it', style: 'cancel' },
        { text: 'Continue anyway', onPress: go },
      ]);
    } else go();
  };

  const apply = async (p: PlanProposal) => {
    await applyProposal(p);
    setProposal({ ...p, applied: true });
    Alert.alert('Plan updated', 'Your sessions now include these changes. "Reset plan to original" on Review undoes them.');
  };

  const p = settings?.profile ?? {};
  const profileFilled = [p.goals, p.postureNotes, p.healthNotes, p.sittingHoursPerDay, p.work].filter(Boolean).length;
  const have = settings ? userEquipment(settings) : [];
  const provider = settings ? currentProvider(settings) : null;
  const equipmentText = ['Bodyweight', ...EQUIPMENT_OPTIONS.filter(o => have.includes(o.key)).map(o => o.label)].join(', ');
  const changeCount = proposal ? proposal.add.length + proposal.swap.length + proposal.remove.length + proposal.adjust.length : 0;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Text style={ui.muted}>
        Your AI coach reads your profile, equipment, recent logs and (optionally) posture photos, then suggests changes to
        your posture routine and strength days. It only picks exercises from the built-in library, so every one has a
        demo. Nothing changes until you tap Apply.
      </Text>

      <View style={ui.card}>
        <Text style={ui.h2}>1. You and your equipment</Text>
        <Text style={ui.body}>Profile: {profileFilled ? `${profileFilled} of 5 details filled in` : 'not filled in yet'}</Text>
        <Text style={ui.body}>Equipment: {equipmentText}</Text>
        {!!settings?.equipmentNotes && <Text style={ui.small}>{settings.equipmentNotes}</Text>}
        <Button title="Edit in Settings" kind="secondary" onPress={() => navigation.navigate('Tabs', { screen: 'Settings' })} />
      </View>

      <View style={ui.card}>
        <Text style={ui.h2}>2. Posture photos (optional)</Text>
        <Text style={ui.small}>
          Stand relaxed, as you normally do. Full body in frame, fitted clothes, phone at hip height about 2-3 m away,
          plain background. Side view = your side to the camera.
        </Text>
        {VIEWS.map(v => {
          const ph = photos[v.view];
          return (
            <View key={v.view} style={[ui.row, { alignItems: 'center' }]}>
              <View
                style={{
                  width: 54,
                  height: 72,
                  borderRadius: 8,
                  backgroundColor: colors.cardAlt,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {ph ? (
                  <Image source={{ uri: ph.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <Text style={ui.small}>none</Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={ui.h3}>{v.label}</Text>
                <View style={ui.row}>
                  <Button title="Camera" kind="secondary" onPress={() => addPhoto(v.view, true)} style={{ paddingVertical: 8 }} />
                  <Button title="Gallery" kind="secondary" onPress={() => addPhoto(v.view, false)} style={{ paddingVertical: 8 }} />
                  {ph && (
                    <Button
                      title="✕"
                      kind="secondary"
                      onPress={() => setPhotos(cur => ({ ...cur, [v.view]: undefined }))}
                      style={{ paddingVertical: 8 }}
                    />
                  )}
                </View>
              </View>
            </View>
          );
        })}
        <Text style={ui.small}>
          Photos are shrunk on your phone, sent only to your AI provider ({provider?.label ?? 'not set'}) for this one
          request, and not saved by omaFIT. Only the written findings are kept. The AI describes what it sees; it can't
          diagnose anything.
        </Text>
        {provider?.id === 'gemini' && (
          <Text style={[ui.small, { color: colors.warn }]}>
            On Gemini's free tier, Google may use what you send, including these photos, to improve its products. Skip
            the photos or use a paid plan if that matters to you.
          </Text>
        )}
      </View>

      <Button title="Analyse and build my plan" onPress={run} loading={loading} />
      {loading && <Text style={[ui.small, { textAlign: 'center' }]}>This can take up to a minute.</Text>}

      {proposal && (
        <View style={[ui.card, { borderColor: proposal.applied ? colors.border : colors.accent }]}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.small}>{new Date(proposal.date).toDateString()}</Text>
            {proposal.applied && changeCount > 0 && <Pill text="Applied" color={colors.good} />}
          </View>

          {proposal.findings.length > 0 && (
            <View style={{ gap: 2 }}>
              <Text style={ui.h3}>What the AI noticed</Text>
              {proposal.findings.map((f, i) => (
                <Text key={i} style={ui.body}>• {f}</Text>
              ))}
            </View>
          )}
          <Text style={ui.body}>{proposal.summary}</Text>
          {!!proposal.safetyNote && <Text style={[ui.body, { color: colors.warn }]}>{proposal.safetyNote}</Text>}

          {proposal.add.map((a, i) => (
            <Change
              key={`a${i}`}
              tag={`Add to ${SESSION_LABEL[a.session]}`}
              title={a.name}
              detail={`${a.sets} × ${a.reps}${a.perSide ? ' per side' : ''}`}
              reason={a.reason}
              demoId={a.libraryId}
            />
          ))}
          {proposal.swap.map((w, i) => (
            <Change key={`s${i}`} tag="Swap" title={`${exerciseLabel(w.exerciseId)} → ${w.name}`} reason={w.reason} demoId={w.libraryId} />
          ))}
          {proposal.adjust.map((j, i) => (
            <Change
              key={`j${i}`}
              tag="Adjust"
              title={exerciseLabel(j.exerciseId)}
              detail={[j.sets != null ? `${j.sets} sets` : null, j.reps ? `${j.reps} reps` : null].filter(Boolean).join(' · ')}
              reason={j.reason}
            />
          ))}
          {proposal.remove.map((r, i) => (
            <Change key={`r${i}`} tag="Remove" title={exerciseLabel(r.exerciseId)} reason={r.reason} />
          ))}

          {proposal.rejected.length > 0 && (
            <View style={{ gap: 2 }}>
              <Text style={[ui.h3, { color: colors.warn }]}>Blocked by the app's safety checks</Text>
              {proposal.rejected.map((r, i) => (
                <Text key={i} style={ui.small}>• {r.what}: {r.why}</Text>
              ))}
            </View>
          )}

          {changeCount === 0 ? (
            <Text style={ui.muted}>No changes suggested. Your current plan fits.</Text>
          ) : (
            !proposal.applied && <Button title="Apply to my plan" onPress={() => apply(proposal)} />
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Change({
  tag,
  title,
  detail,
  reason,
  demoId,
}: {
  tag: string;
  title: string;
  detail?: string;
  reason: string;
  demoId?: string;
}) {
  const demo = findDemo(demoId);
  return (
    <View style={[ui.row, { backgroundColor: colors.cardAlt, borderRadius: 10, padding: space.md, alignItems: 'flex-start' }]}>
      {demo && (
        <Image
          source={{ uri: imageUrls(demo)[0] }}
          style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: '#fff' }}
          contentFit="cover"
          cachePolicy="disk"
          accessibilityLabel={`Demo of ${demo.name}`}
        />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[ui.small, { color: colors.accent, fontWeight: '700' }]}>{tag}</Text>
        <Text style={ui.h3}>{title}</Text>
        {!!detail && <Text style={ui.body}>{detail}</Text>}
        {!!reason && <Text style={ui.small}>{reason}</Text>}
      </View>
    </View>
  );
}

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { ExerciseDemo } from '../components/ExerciseDemo';
import { Button, Pill } from '../components/ui';
import { EffectiveExercise, effectiveSession } from '../data/effective';
import { RootStackParamList } from '../navigation';
import { KeyboardAwareScrollView } from '../components/KeyboardAware';
import { colors, space, ui } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Exercise'>;

/** Opens in the YouTube app if installed, otherwise the browser. */
const openVideo = (url: string) =>
  Linking.openURL(url).catch(() => Alert.alert('Could not open YouTube', 'Check your internet connection.'));

export default function ExerciseScreen({ route, navigation }: Props) {
  const { sessionId, exerciseId } = route.params;
  const [ex, setEx] = useState<EffectiveExercise | null>(null);

  useEffect(() => {
    effectiveSession(sessionId).then(({ exercises }) => {
      const found = exercises.find(e => e.id === exerciseId) ?? null;
      setEx(found);
      if (found) navigation.setOptions({ title: found.name });
    });
  }, [sessionId, exerciseId, navigation]);

  if (!ex) return <View style={ui.screen} />;

  return (
    <KeyboardAwareScrollView style={ui.screen} contentContainerStyle={ui.content}>
      {/* key forces the demo to reload if the exercise was swapped by a review */}
      <ExerciseDemo
        key={`${ex.id}:${ex.name}`}
        slotKey={ex.swapped ? `${ex.id}:swap:${ex.name}` : ex.id}
        demoId={ex.demoId}
        searchTerms={ex.demoSearch}
        exerciseName={ex.name}
      />

      {ex.videoUrl ? (
        <Button title="▶ Watch video demo (YouTube)" onPress={() => openVideo(ex.videoUrl!)} />
      ) : (
        <Pressable
          onPress={() =>
            openVideo(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} exercise shorts`)}`)
          }
          accessibilityRole="link"
        >
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Find a video on YouTube</Text>
        </Pressable>
      )}

      <View style={ui.card}>
        {ex.swapped &&<Pill text="Swapped by weekly review" />}
        <Text style={ui.h2}>{ex.name}</Text>
        <Text style={ui.body}>
          {ex.sets} × {ex.reps}
          {ex.perSide ? ' per side' : ''}
          {ex.targetWeightKg ? ` @ ${ex.targetWeightKg} kg` : ''}
        </Text>
        <Text style={ui.muted}>{ex.equipment}</Text>
      </View>

      <View style={ui.card}>
        <Text style={ui.h3}>Form cues</Text>
        {ex.cues.map((c, i) => (
          <Text key={i} style={ui.body}>• {c}</Text>
        ))}
        {!!ex.coachNote && (
          <Text style={[ui.body, { color: colors.accent, marginTop: space.sm }]}>Coach: {ex.coachNote}</Text>
        )}
      </View>

      <Text style={ui.small}>
        The demo shows the movement pattern. Your plan's cues and equipment win if they differ, e.g. a band
        instead of a cable.
      </Text>
    </KeyboardAwareScrollView>
  );
}

import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { DemoExercise, imageUrls, resolveDemo, searchDemos } from '../api/demos';
import { setGifPick } from '../storage/store';
import { colors, space, ui } from '../theme';

const FRAME_MS = 900;

/**
 * Plays the start/end photos of a free-exercise-db demo on a loop, like a simple GIF,
 * and lets you search for a better-matching demo if the default one is off.
 */
export function ExerciseDemo({
  slotKey,
  demoId,
  searchTerms,
  exerciseName,
}: {
  slotKey: string;
  demoId?: string;
  searchTerms?: string[];
  exerciseName: string;
}) {
  const [demo, setDemo] = useState<DemoExercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState(exerciseName);

  /** Switch to a demo and restart its animation from the first photo. */
  const showDemo = (d: DemoExercise | null) => {
    setDemo(d);
    setFrame(0);
    setFailed(false);
  };

  const searchKey = (searchTerms ?? []).join('|');
  useEffect(() => {
    let alive = true;
    resolveDemo(slotKey, demoId, searchKey ? searchKey.split('|') : []).then(d => {
      if (!alive) return;
      showDemo(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [slotKey, demoId, searchKey]);

  const urls = demo ? imageUrls(demo) : [];
  const frameCount = urls.length;

  useEffect(() => {
    if (frameCount < 2) return;
    const t = setInterval(() => setFrame(f => (f + 1) % frameCount), FRAME_MS);
    return () => clearInterval(t);
  }, [demo?.id, frameCount]);

  const choose = async (d: DemoExercise) => {
    await setGifPick(slotKey, d.id);
    showDemo(d);
    setPicking(false);
  };

  const results = picking ? searchDemos(query) : [];

  return (
    <View style={{ gap: space.sm }}>
      <View
        style={{
          aspectRatio: 3 / 2,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.purple} />
        ) : demo && !failed ? (
          <>
            {/* Render every frame and show one, so flipping doesn't flash while loading */}
            {urls.map((u, i) => (
              <Image
                key={u}
                source={{ uri: u }}
                style={{ position: 'absolute', width: '100%', height: '100%', opacity: i === frame ? 1 : 0 }}
                contentFit="contain"
                cachePolicy="disk"
                onError={() => setFailed(true)}
                accessibilityLabel={i === frame ? `Demo of ${demo.name}, position ${i + 1}` : undefined}
              />
            ))}
          </>
        ) : (
          <Text style={[ui.muted, { color: '#444', padding: space.lg, textAlign: 'center' }]}>
            {failed
              ? 'The demo photos could not load. Check your internet connection.'
              : 'No close demo for this one. Follow the cues below, or search for one.'}
          </Text>
        )}
      </View>

      {demo && (
        <Text style={ui.small}>
          Demo: {demo.name}
          {urls.length > 1 ? ` · start ↔ end position` : ''}
        </Text>
      )}

      <Pressable onPress={() => setPicking(p => !p)} accessibilityRole="button">
        <Text style={{ color: colors.accent, fontWeight: '700' }}>
          {picking ? 'Close' : demo ? 'Wrong demo? Choose another' : 'Search for a demo'}
        </Text>
      </Pressable>

      {picking && (
        <View style={[ui.card, { padding: space.sm, gap: space.sm }]}>
          <TextInput
            style={ui.input}
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. band pull apart"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
          />
          {results.length === 0 && <Text style={ui.muted}>No matches. Try fewer or different words.</Text>}
          {results.map(r => (
            <Pressable
              key={r.id}
              onPress={() => choose(r)}
              style={{ paddingVertical: 8, paddingHorizontal: space.sm, borderBottomWidth: 1, borderColor: colors.border }}
            >
              <Text style={[ui.body, r.id === demo?.id && { color: colors.accent }]}>{r.name}</Text>
              {!!r.equipment && <Text style={ui.small}>{r.equipment}</Text>}
            </Pressable>
          ))}
        </View>
      )}

      <Text style={ui.small}>Demos: free-exercise-db (public domain).</Text>
    </View>
  );
}

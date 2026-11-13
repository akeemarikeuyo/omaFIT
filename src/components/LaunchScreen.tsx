import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';
import { APP_NAME, DumbbellIcon } from './Brand';

/**
 * Full-screen omaFIT logo shown while the app starts. It matches the native splash screen
 * (gold dumbbell on the dark background), then fades out over the app.
 * Expo Go shows its own loading screen before this; built apps go straight from the native splash to this.
 */
export function LaunchScreen({ visible, onLayout, onHidden }: { visible: boolean; onLayout?: () => void; onHidden: () => void }) {
  // Created once and kept for the component's life
  const [opacity] = useState(() => new Animated.Value(1));
  const [lift] = useState(() => new Animated.Value(0));

  // A gentle "lift": the dumbbell rises and settles, like a rep
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lift, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [lift]);

  useEffect(() => {
    if (visible) return;
    Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onHidden();
    });
  }, [visible, opacity, onHidden]);

  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity }]}
      onLayout={onLayout}
      pointerEvents={visible ? 'auto' : 'none'}
      accessible
      accessibilityLabel={`${APP_NAME} is loading`}
    >
      <Animated.View style={{ transform: [{ translateY }] }}>
        <DumbbellIcon size={150} />
      </Animated.View>
      <Text style={styles.word}>
        oma<Text style={{ color: colors.accent }}>FIT</Text>
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 22, zIndex: 10 },
  word: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: 0.5 },
});

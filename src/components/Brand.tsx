import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../theme';

export const APP_NAME = 'omaFIT';

// Same shape as the app icon (scripts/make-icons.js). [x0, y0, x1, y1, radius] in a 0..1 box.
const SHAPES: [number, number, number, number, number][] = [
  [0.3, 0.465, 0.7, 0.535, 0.02],
  [0.22, 0.28, 0.31, 0.72, 0.03],
  [0.69, 0.28, 0.78, 0.72, 0.03],
  [0.13, 0.35, 0.21, 0.65, 0.03],
  [0.79, 0.35, 0.87, 0.65, 0.03],
  [0.08, 0.44, 0.13, 0.56, 0.015],
  [0.87, 0.44, 0.92, 0.56, 0.015],
];

/** The omaFIT dumbbell mark. Only the middle 44% of the box is drawn, so the height is ~half the size. */
export function DumbbellIcon({ size = 32, color = colors.accent }: { size?: number; color?: string }) {
  const top = 0.28;
  return (
    <View style={{ width: size, height: size * 0.44 }} accessibilityElementsHidden importantForAccessibility="no">
      {SHAPES.map(([x0, y0, x1, y1, r], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: x0 * size,
            top: (y0 - top) * size,
            width: (x1 - x0) * size,
            height: (y1 - y0) * size,
            borderRadius: r * size,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

/** "omaFIT" wordmark with the dumbbell beside it. */
export function Brand({ size = 22 }: { size?: number }) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.35 }}
      accessible
      accessibilityRole="header"
      accessibilityLabel={APP_NAME}
    >
      <Text style={{ fontSize: size, fontWeight: '800', color: colors.text, letterSpacing: 0.3 }}>
        oma<Text style={{ color: colors.accent }}>FIT</Text>
      </Text>
      <DumbbellIcon size={size * 1.6} />
    </View>
  );
}

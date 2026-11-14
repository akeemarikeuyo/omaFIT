import React from 'react';
import { Image, Text, View } from 'react-native';
import { colors } from '../theme';

export const APP_NAME = 'omaFIT';
export const TAGLINE = 'Sit Right. Move More. Live Better.';

// Generated from assets/logo.png by scripts/make-icons.js, like the app icon
const MARK = require('../../assets/logo-mark.png');

/** The omaFIT logo: a figure in motion with a gold spine. Square. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={MARK}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** The "omaFIT" wordmark on its own. */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <Text style={{ fontSize: size, fontWeight: '800', color: colors.text, letterSpacing: 0.3 }}>
      oma<Text style={{ color: colors.accent }}>FIT</Text>
    </Text>
  );
}

/** Logo and wordmark side by side, for screen headers. */
export function Brand({ size = 22 }: { size?: number }) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.35 }}
      accessible
      accessibilityRole="header"
      accessibilityLabel={APP_NAME}
    >
      <LogoMark size={size * 1.7} />
      <Wordmark size={size} />
    </View>
  );
}

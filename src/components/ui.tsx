import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View, ViewStyle } from 'react-native';
import { colors, space, ui } from '../theme';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const bg = kind === 'primary' ? colors.accent : kind === 'danger' ? colors.danger : colors.cardAlt;
  const fg = kind === 'primary' ? colors.accentText : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: 12,
          paddingVertical: 13,
          paddingHorizontal: space.lg,
          alignItems: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>
      )}
    </Pressable>
  );
}

/** A row of tappable numbers, used for pain (0-10) and effort (1-5). */
export function ScalePicker({
  label,
  min,
  max,
  value,
  onChange,
  lowLabel,
  highLabel,
  colorFor,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  lowLabel?: string;
  highLabel?: string;
  colorFor?: (v: number) => string;
}) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <View style={{ gap: space.xs }}>
      <Text style={ui.h3}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {values.map(v => {
          const selected = v === value;
          const c = colorFor ? colorFor(v) : colors.accent;
          return (
            <Pressable
              key={v}
              onPress={() => onChange(v)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                minWidth: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? c : colors.cardAlt,
                borderWidth: 1,
                borderColor: selected ? c : colors.border,
              }}
            >
              <Text style={{ color: selected ? colors.accentText : colors.text, fontWeight: '700' }}>{v}</Text>
            </Pressable>
          );
        })}
      </View>
      {(lowLabel || highLabel) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={ui.small}>{lowLabel}</Text>
          <Text style={ui.small}>{highLabel}</Text>
        </View>
      )}
    </View>
  );
}

export const painColor = (v: number) => (v <= 2 ? colors.good : v <= 4 ? colors.accent : v <= 6 ? colors.warn : colors.danger);

export function Pill({ text, color = colors.purple }: { text: string; color?: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: color, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

/** A row of tabs; the selected one is highlighted. */
export function Segmented<K extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: 10, padding: 3 }}>
      {options.map(o => {
        const selected = o.key === value;
        return (
          <Pressable
            key={String(o.key)}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              paddingVertical: 7,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: selected ? colors.accent : 'transparent',
            }}
          >
            <Text style={{ color: selected ? colors.accentText : colors.text, fontWeight: '700', fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A card with a title that opens and closes. Shows a one-line summary while closed. */
export function Section({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={ui.card}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}${summary && !open ? `, ${summary}` : ''}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
        hitSlop={8}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.h2}>{title}</Text>
          {!!summary && !open && <Text style={ui.small}>{summary}</Text>}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
      </Pressable>
      {open && <View style={{ gap: space.md }}>{children}</View>}
    </View>
  );
}

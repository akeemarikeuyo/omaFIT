// "Pain or discomfort": pick where from a dropdown, then rate it from 0 (none) to 10 (worst).
// Nothing added means no pain or discomfort.
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { areaInfo, MAX_PAIN_NOTE, PAIN_AREAS, painLabel, PainAreaInfo, samePlace, SIDES } from '../data/pain';
import { URGENT_FLAGS } from '../data/plan';
import type { PainEntry } from '../storage/store';
import { colors, space, ui } from '../theme';
import { painColor, ScalePicker } from './ui';

const chip = (selected = false) => ({
  paddingVertical: 8,
  paddingHorizontal: space.md,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: selected ? colors.accent : colors.border,
  backgroundColor: selected ? colors.accent : colors.cardAlt,
});

export function PainPicker({ value, onChange }: { value: PainEntry[]; onChange: (v: PainEntry[]) => void }) {
  const [open, setOpen] = useState(false);
  // A joint picked from the list, waiting for its side
  const [needsSide, setNeedsSide] = useState<PainAreaInfo | null>(null);

  const add = (entry: Omit<PainEntry, 'score'>) => {
    setOpen(false);
    setNeedsSide(null);
    // Same place twice: keep the one already there
    if (entry.area !== 'other' && value.some(p => samePlace(p, entry))) return;
    onChange([...value, { ...entry, score: 0 }]);
  };

  const pickArea = (a: PainAreaInfo) => (a.sided ? setNeedsSide(a) : add({ area: a.id }));
  const update = (i: number, patch: Partial<PainEntry>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <Text style={ui.h3}>Pain or discomfort</Text>
        <Text style={ui.small}>Leave this empty if nothing hurts.</Text>
      </View>

      {value.map((p, i) => (
        <View key={i} style={[ui.card, { backgroundColor: colors.cardAlt, gap: space.sm }]}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={[ui.body, { fontWeight: '700', flex: 1 }]}>{painLabel(p)}</Text>
            <Pressable
              onPress={() => remove(i)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${painLabel(p)}`}
              hitSlop={10}
            >
              <Text style={{ color: colors.muted, fontWeight: '700' }}>Remove</Text>
            </Pressable>
          </View>
          {p.area === 'other' && (
            <TextInput
              style={ui.input}
              value={p.note ?? ''}
              onChangeText={note => update(i, { note })}
              placeholder="Where? e.g. right calf"
              placeholderTextColor={colors.muted}
              maxLength={MAX_PAIN_NOTE}
            />
          )}
          <ScalePicker
            label="How bad?"
            min={0}
            max={10}
            value={p.score}
            onChange={score => update(i, { score })}
            lowLabel="none"
            highLabel="worst"
            colorFor={painColor}
          />
          {p.score === 0 && <Text style={[ui.small, { color: colors.warn }]}>Tap a number, or remove it.</Text>}
        </View>
      ))}

      {needsSide ? (
        <View style={[ui.card, { backgroundColor: colors.cardAlt, gap: space.sm }]}>
          <Text style={ui.body}>Which {needsSide.label.toLowerCase()}?</Text>
          <View style={[ui.row, { flexWrap: 'wrap' }]}>
            {SIDES.map(s => (
              <Pressable key={s.id} onPress={() => add({ area: needsSide.id, side: s.id })} accessibilityRole="button" style={chip()}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{s.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setNeedsSide(null)} accessibilityRole="button" style={{ padding: 8 }}>
              <Text style={{ color: colors.muted, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Pressable
            onPress={() => setOpen(o => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            style={[ui.input, ui.row, { justifyContent: 'space-between' }]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>+ Add pain or discomfort</Text>
            <Text style={{ color: colors.muted }}>{open ? '▲' : '▼'}</Text>
          </Pressable>
          {open && (
            <View style={[ui.card, { padding: 0, overflow: 'hidden' }]}>
              {PAIN_AREAS.map((a, i) => (
                <Pressable
                  key={a.id}
                  onPress={() => pickArea(a)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    paddingVertical: 12,
                    paddingHorizontal: space.md,
                    borderTopWidth: i ? 1 : 0,
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.cardAlt : 'transparent',
                  })}
                >
                  <Text style={ui.body}>
                    {a.label}
                    {areaInfo(a.id).sided ? <Text style={ui.small}>  · left / right</Text> : null}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      <Text style={[ui.small, { color: colors.danger }]}>{URGENT_FLAGS}</Text>
    </View>
  );
}

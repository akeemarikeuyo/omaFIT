import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import {
  currentModel,
  DEFAULT_PROVIDER,
  listModels,
  ModelOption,
  PROVIDER_IDS,
  PROVIDERS,
  ProviderId,
  settingsWithProvider,
  testConnection,
} from '../api/ai';
import { getKey, getSettings, saveSettings, setKey, Settings } from '../storage/store';
import { colors, space, ui } from '../theme';
import { Button } from './ui';

const mask = (k: string | null) => (k ? `••••${k.slice(-4)}` : 'not set');

/** Settings card: pick an AI provider, save its key, optionally pick a model, test the connection. */
export function AISettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [provider, setProvider] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [showGuide, setShowGuide] = useState<boolean | null>(null);
  const [savedKeys, setSavedKeys] = useState<Partial<Record<ProviderId, string | null>>>({});
  const [keyInput, setKeyInput] = useState('');
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [busy, setBusy] = useState<'models' | 'test' | null>(null);

  const load = useCallback(async () => {
    const s = await settingsWithProvider();
    setSettings(s);
    setProvider(s.aiProvider ?? DEFAULT_PROVIDER);
    const entries = await Promise.all(PROVIDER_IDS.map(async id => [id, await getKey(id)] as const));
    setSavedKeys(Object.fromEntries(entries));
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const info = PROVIDERS[provider];
  const saved = savedKeys[provider] ?? null;
  const hasAnyKey = PROVIDER_IDS.some(id => savedKeys[id]);
  const model = settings ? currentModel({ ...settings, aiProvider: provider }) : info.defaultModel;

  const pickProvider = async (id: ProviderId) => {
    setProvider(id);
    setKeyInput('');
    setModels(null);
    await saveSettings({ aiProvider: id });
    setSettings(await getSettings());
  };

  const saveKey = async () => {
    await setKey(provider, keyInput);
    setKeyInput('');
    await load();
    Alert.alert('Saved', `Your ${info.label} key is stored in the phone’s secure storage.`);
  };

  const removeKey = () =>
    Alert.alert(`Remove your ${info.label} key?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await setKey(provider, ''); load(); } },
    ]);

  const loadModels = async () => {
    setBusy('models');
    try {
      setModels(await listModels(provider));
    } catch (e) {
      Alert.alert('Could not load models', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const chooseModel = async (id: string | undefined) => {
    await saveSettings({ aiModels: { ...settings?.aiModels, [provider]: id } });
    setSettings(await getSettings());
    setModels(null);
  };

  const test = async () => {
    setBusy('test');
    try {
      await testConnection();
      Alert.alert('Connected', `${info.label} (${model}) is working.`);
    } catch (e) {
      Alert.alert('Connection failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={ui.card}>
      <Text style={ui.h2}>AI coach</Text>
      <Text style={ui.muted}>
        Pick the AI that powers Build my plan, the weekly review and Coach chat, and add your own API key for it.
        Everything else in omaFIT works without one.
      </Text>

      {!hasAnyKey && (
        <View style={{ backgroundColor: colors.cardAlt, borderRadius: 10, padding: space.md, gap: 2 }}>
          <Text style={[ui.h3, { color: colors.accent }]}>No paid AI account? Use Gemini, it's free.</Text>
          <Text style={ui.small}>
            A Claude Pro, ChatGPT Plus or Gemini app subscription can't be used here; those need a separate, paid API
            key. Google's Gemini API has a free tier, and getting a key takes about 2 minutes.
          </Text>
        </View>
      )}

      <View style={[ui.row, { flexWrap: 'wrap' }]}>
        {PROVIDER_IDS.map(id => (
          <Button
            key={id}
            title={`${PROVIDERS[id].label}${id === 'gemini' ? ' · Free' : ''}${savedKeys[id] ? ' ✓' : ''}`}
            kind={id === provider ? 'primary' : 'secondary'}
            onPress={() => pickProvider(id)}
            style={{ paddingHorizontal: space.md, paddingVertical: 9 }}
          />
        ))}
      </View>

      <Text style={ui.small}>
        {info.label} by {info.company}. {info.note}
      </Text>

      {provider === 'gemini' && (
        <GeminiGuide
          open={showGuide ?? !saved}
          onToggle={() => setShowGuide(!(showGuide ?? !saved))}
          onOpenStudio={() => Linking.openURL(info.keyUrl)}
        />
      )}

      <Text style={[ui.h3, { marginTop: space.sm }]}>{info.label} API key</Text>
      <Text style={ui.small}>Current: {mask(saved)}. Stored encrypted on this phone, sent only to {info.company}.</Text>
      <TextInput
        style={ui.input}
        value={keyInput}
        onChangeText={setKeyInput}
        placeholder={info.keyPlaceholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Pressable onPress={() => Linking.openURL(info.keyUrl)} accessibilityRole="link">
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Get a {info.label} key →</Text>
        </Pressable>
        {saved && <Text onPress={removeKey} style={{ color: colors.danger }}>Remove key</Text>}
      </View>
      <Button title="Save key" onPress={saveKey} disabled={!keyInput.trim()} />

      <Text style={[ui.h3, { marginTop: space.sm }]}>Model</Text>
      <Text style={ui.small}>
        {model}
        {model === info.defaultModel ? ' (default)' : ''}
      </Text>
      <View style={ui.row}>
        <Button
          title={models ? 'Hide models' : 'Choose model'}
          kind="secondary"
          onPress={() => (models ? setModels(null) : loadModels())}
          disabled={!saved}
          loading={busy === 'models'}
          style={{ flex: 1 }}
        />
        <Button title="Test" kind="secondary" onPress={test} disabled={!saved} loading={busy === 'test'} style={{ flex: 1 }} />
      </View>
      {models && (
        <View style={{ gap: 2 }}>
          <ModelRow id={info.defaultModel} label="Default (recommended)" selected={model === info.defaultModel} onPress={() => chooseModel(undefined)} />
          {models.length === 0 && <Text style={ui.small}>No chat models found for this key.</Text>}
          {models
            .filter(m => m.id !== info.defaultModel)
            .slice(0, 40)
            .map(m => (
              <ModelRow key={m.id} id={m.id} label={m.label} selected={m.id === model} onPress={() => chooseModel(m.id)} />
            ))}
        </View>
      )}
      {busy === 'models' && <ActivityIndicator color={colors.accent} />}
    </View>
  );
}

const GEMINI_STEPS = [
  'Tap "Open Google AI Studio" below.',
  'Sign in with your Google account (any Gmail works). Accept the terms if it asks.',
  'Tap "Create API key". If it asks for a project, let it create a new one.',
  'Copy the key. It is a long code that starts with "AIza".',
  'Come back here, paste it in the box below and tap Save key.',
  'Tap Test. You should see "Gemini is working".',
];

/** Step-by-step help for getting a free Gemini key. */
function GeminiGuide({ open, onToggle, onOpenStudio }: { open: boolean; onToggle: () => void; onOpenStudio: () => void }) {
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: space.md, gap: space.sm }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={ui.h3}>
          {open ? '▾' : '▸'} How to get a free Gemini key (2 min)
        </Text>
      </Pressable>
      {open && (
        <>
          {GEMINI_STEPS.map((step, i) => (
            <View key={i} style={[ui.row, { alignItems: 'flex-start' }]}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.accentText, fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
              </View>
              <Text style={[ui.body, { flex: 1 }]}>{step}</Text>
            </View>
          ))}
          <Button title="Open Google AI Studio" onPress={onOpenStudio} />
          <Text style={ui.small}>
            Free, no card needed. Keep your key private: anyone who has it can use your free quota. You can delete it any
            time in AI Studio.
          </Text>
        </>
      )}
    </View>
  );
}

function ModelRow({ id, label, selected, onPress }: { id: string; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ paddingVertical: 8, paddingHorizontal: space.sm, borderRadius: 8, backgroundColor: selected ? colors.cardAlt : 'transparent' }}
    >
      <Text style={[ui.body, selected && { color: colors.accent }]}>{label}</Text>
      {label !== id && <Text style={ui.small}>{id}</Text>}
    </Pressable>
  );
}

import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, ScrollViewInstance, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { askCoach } from '../api/coach';
import { Button } from '../components/ui';
import { ChatMessage, clearChat, getChat, saveChat } from '../storage/store';
import { colors, space, ui } from '../theme';

const STARTERS = [
  'My lower back is stiff today. What should I do?',
  'RDLs felt it in my lower back, not hamstrings. Why?',
  'Can I swap face pulls for something else?',
];

export default function CoachScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  useFocusEffect(useCallback(() => { getChat().then(setMessages); }, []));

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || sending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: t }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const reply = await askCoach(next);
      const withReply: ChatMessage[] = [...next, { role: 'assistant', content: reply }];
      setMessages(withReply);
      await saveChat(withReply);
    } catch (e) {
      Alert.alert('Coach unavailable', e instanceof Error ? e.message : String(e));
      setMessages(messages);
      setInput(t);
    } finally {
      setSending(false);
    }
  };

  const clear = () =>
    Alert.alert('Clear chat?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await clearChat(); setMessages([]); } },
    ]);

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[ui.row, { justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.lg }]}>
          <Text style={ui.h1}>Coach</Text>
          {messages.length > 0 && <Text onPress={clear} style={{ color: colors.muted }}>Clear</Text>}
        </View>
        <ScrollView
          ref={scroll}
          contentContainerStyle={ui.content}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <View style={{ gap: space.sm }}>
              <Text style={ui.muted}>
                Ask about your plan, a sore back day or an exercise. The coach sees your plan and last 2 weeks of
                logs. It can't see your form, so use the demos for that.
              </Text>
              {STARTERS.map(s => (
                <Button key={s} title={s} kind="secondary" onPress={() => send(s)} />
              ))}
            </View>
          )}
          {messages.map((m, i) => (
            <View
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                backgroundColor: m.role === 'user' ? colors.accent : colors.card,
                borderRadius: 14,
                padding: space.md,
              }}
            >
              <Text style={[ui.body, m.role === 'user' && { color: colors.accentText }]}>{m.content}</Text>
            </View>
          ))}
          {sending && <Text style={ui.muted}>Coach is typing…</Text>}
        </ScrollView>
        <View style={[ui.row, { padding: space.md, borderTopWidth: 1, borderColor: colors.border }]}>
          <TextInput
            style={[ui.input, { flex: 1 }]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask your coach…"
            placeholderTextColor={colors.muted}
            multiline
          />
          <Button title="Send" onPress={() => send(input)} disabled={!input.trim()} loading={sending} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

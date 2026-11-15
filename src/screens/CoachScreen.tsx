import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, ScrollViewInstance, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { askCoach } from '../api/coach';
import { KeyboardAvoider } from '../components/KeyboardAware';
import { Button, Pill } from '../components/ui';
import { describeChange, exerciseLabel } from '../data/effective';
import { ChatMessage, ChatProposal, clearChat, getChat, mergeOverrides, Overrides, saveChat } from '../storage/store';
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
      const withReply: ChatMessage[] = [...next, { role: 'assistant', content: reply.text, proposal: reply.proposal }];
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

  /** Apply or decline a change the coach suggested. Only an Apply tap changes the plan. */
  const decide = async (index: number, apply: boolean) => {
    const m = messages[index];
    if (!m.proposal || m.proposal.status !== 'pending') return;
    if (apply) {
      const patch: Overrides = {};
      for (const c of m.proposal.changes) patch[c.exerciseId] = c.change;
      await mergeOverrides(patch);
    }
    const updated = messages.map((x, i) =>
      i === index && x.proposal ? { ...x, proposal: { ...x.proposal, status: apply ? ('applied' as const) : ('dismissed' as const) } } : x,
    );
    setMessages(updated);
    await saveChat(updated);
  };

  const clear = () =>
    Alert.alert('Clear chat?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await clearChat(); setMessages([]); } },
    ]);

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <KeyboardAvoider onKeyboardShown={() => scroll.current?.scrollToEnd({ animated: true })}>
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
                logs, and can suggest changes, like swapping an exercise: nothing changes until you tap Apply. It
                can't see your form, so use the demos for that.
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
              {m.proposal && <ProposalCard proposal={m.proposal} onDecide={apply => decide(i, apply)} />}
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
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

/** A plan change the coach suggested, already safety-checked by the app. */
function ProposalCard({ proposal, onDecide }: { proposal: ChatProposal; onDecide: (apply: boolean) => void }) {
  const { changes, rejected, status } = proposal;
  return (
    <View style={{ marginTop: space.sm, gap: space.sm, borderTopWidth: 1, borderColor: colors.border, paddingTop: space.sm }}>
      {changes.map((c, i) => (
        <View key={i} style={{ gap: 2 }}>
          <Text style={ui.h3}>{exerciseLabel(c.exerciseId)}</Text>
          <Text style={[ui.body, { color: colors.accent }]}>{describeChange(c)}</Text>
          {!!c.reason && <Text style={ui.small}>{c.reason}</Text>}
        </View>
      ))}
      {rejected.map((r, i) => (
        <Text key={i} style={[ui.small, { color: colors.warn }]}>
          Blocked by the app's safety checks: {exerciseLabel(r.exerciseId)}. {r.why}
        </Text>
      ))}
      {changes.length > 0 && status === 'pending' && (
        <View style={ui.row}>
          <Button title="Apply" onPress={() => onDecide(true)} style={{ flex: 1 }} />
          <Button title="No thanks" kind="secondary" onPress={() => onDecide(false)} style={{ flex: 1 }} />
        </View>
      )}
      {status === 'applied' && <Pill text="Applied to your plan" color={colors.good} />}
      {status === 'dismissed' && changes.length > 0 && <Pill text="Not applied" color={colors.cardAlt} />}
    </View>
  );
}

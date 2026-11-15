import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { runWeeklyReview } from '../api/coach';
import { Button, Pill } from '../components/ui';
import { describeChange, exerciseLabel } from '../data/effective';
import { DEFAULT_REVIEW_DAY, reviewDayOf, reviewStatus, ReviewStatus, WEEKDAYS, WEEKDAYS_LONG } from '../data/reviewSchedule';
import { RootStackParamList } from '../navigation';
import {
  getProposals,
  getReviews,
  getSettings,
  Settings,
  PlanProposal,
  markReviewApplied,
  mergeOverrides,
  Overrides,
  ReviewRecord,
  resetPlan,
  saveReview,
} from '../storage/store';
import { colors, space, ui } from '../theme';

const exerciseName = exerciseLabel;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ReviewScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [rejected, setRejected] = useState<{ exerciseId: string; why: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const [plan, setPlan] = useState<PlanProposal | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const load = useCallback(async () => {
    setReviews(await getReviews());
    setPlan((await getProposals())[0] ?? null);
    setSettings(await getSettings());
  }, []);

  const reviewDay = settings ? reviewDayOf(settings) : DEFAULT_REVIEW_DAY;
  // Until settings load, show the button; the review itself re-checks the limit
  const status: ReviewStatus = settings ? reviewStatus(reviews, settings) : { allowed: true };
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async () => {
    setLoading(true);
    try {
      const r = await runWeeklyReview();
      await saveReview({
        date: new Date().toISOString(),
        summary: r.summary,
        safetyNote: r.safetyNote,
        changes: r.changes,
        applied: r.changes.length === 0,
      });
      setRejected(r.rejected);
      await load();
    } catch (e) {
      Alert.alert('Review failed', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const apply = async (r: ReviewRecord) => {
    const patch: Overrides = {};
    for (const c of r.changes) patch[c.exerciseId] = c.change;
    await mergeOverrides(patch);
    await markReviewApplied(r.id);
    await load();
  };

  const reset = () =>
    Alert.alert('Reset plan?', 'Removes all applied review and plan-builder changes and returns to the original plan. Your logs are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => { await resetPlan(); load(); } },
    ]);

  const latest = reviews[0];

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScrollView contentContainerStyle={ui.content}>
        <Pressable onPress={() => nav.navigate('PlanBuilder')} style={[ui.card, { borderColor: colors.accent }]}>
          {plan ? (
            <>
              <View style={[ui.row, { justifyContent: 'space-between' }]}>
                <Text style={ui.h2}>Your AI plan</Text>
                {plan.applied ? <Pill text="Applied" color={colors.good} /> : <Pill text="Not applied" />}
              </View>
              <Text style={ui.muted}>
                Built {new Date(plan.date).toDateString()}. See your coach's feedback, apply it, or build again.
              </Text>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>View plan →</Text>
            </>
          ) : (
            <>
              <Text style={ui.h2}>Build my plan with AI</Text>
              <Text style={ui.muted}>
                Add posture photos and your equipment, and your AI coach tailors your posture routine and strength days.
              </Text>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Start →</Text>
            </>
          )}
        </Pressable>

        <Text style={ui.h1}>Weekly review</Text>
        <Text style={ui.muted}>
          Your AI coach reads your last 2 weeks of logs and suggests next week's changes. Nothing changes until you tap Apply,
          and the app blocks weight jumps over about 10%.
        </Text>
        <Text style={ui.small}>
          Once a week, from {WEEKDAYS_LONG[reviewDay]} (change your review day in Settings).
        </Text>
        {status.allowed ? (
          <>
            <Button title="Run this week's review" onPress={run} loading={loading} />
            {status.afterReset && (
              <Text style={ui.small}>Unlocked because you reset your plan to the original.</Text>
            )}
          </>
        ) : (
          <View style={[ui.card, { alignItems: 'center', gap: 2 }]}>
            <Text style={ui.h3}>This week's review is done</Text>
            <Text style={ui.muted}>
              Next review: {status.next ? `${WEEKDAYS[status.next.getDay()]} ${status.next.getDate()} ${MONTHS[status.next.getMonth()]}` : ''}
            </Text>
            <Text style={[ui.small, { textAlign: 'center' }]}>
              Give the changes a week to work. Coach chat is always open for questions.
            </Text>
          </View>
        )}

        {rejected.length > 0 && (
          <View style={[ui.card, { borderColor: colors.warn }]}>
            <Text style={[ui.h3, { color: colors.warn }]}>Suggestions the app blocked</Text>
            {rejected.map((r, i) => (
              <Text key={i} style={ui.muted}>• {exerciseName(r.exerciseId)}: {r.why}</Text>
            ))}
          </View>
        )}

        {reviews.map(r => (
          <View key={r.id} style={[ui.card, r === latest && { borderColor: colors.accent }]}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.small}>{new Date(r.date).toDateString()}</Text>
              {r.applied && r.changes.length > 0 && <Pill text="Applied" color={colors.good} />}
            </View>
            <Text style={ui.body}>{r.summary}</Text>
            {!!r.safetyNote && <Text style={[ui.body, { color: colors.warn }]}>{r.safetyNote}</Text>}
            {r.changes.length === 0 ? (
              <Text style={ui.muted}>No changes this week. Keep going as planned.</Text>
            ) : (
              <View style={{ gap: space.sm }}>
                {r.changes.map((c, i) => (
                  <View key={i} style={{ backgroundColor: colors.cardAlt, borderRadius: 10, padding: space.md, gap: 2 }}>
                    <Text style={ui.h3}>{exerciseName(c.exerciseId)}</Text>
                    <Text style={[ui.body, { color: colors.accent }]}>{describeChange(c)}</Text>
                    <Text style={ui.small}>{c.reason}</Text>
                  </View>
                ))}
                {!r.applied && <Button title="Apply these changes" onPress={() => apply(r)} />}
              </View>
            )}
          </View>
        ))}

        <Button title="Reset plan to original" kind="secondary" onPress={reset} style={{ marginTop: space.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

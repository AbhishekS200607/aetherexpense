/**
 * AetherExpense — Offline Local Financial Intelligence Assistant Screen
 *
 * 100% Offline Assistant powered by local SQLite financial data calculations.
 * Supports natural-language financial Q&A, Health Score analysis, Anomaly Detection,
 * and Smart Budget Recommendations with Accept/Edit/Dismiss human confirmation.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { eq } from 'drizzle-orm';

import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppStore } from '@/store/appStore';
import { createDrizzleDB } from '@/database/client';
import { budgets } from '@/database/schema';
import { generateUUID } from '@/utils/uuid';
import { todayISO } from '@/utils/dates';
import {
  computeFinancialHealthScore,
  generateSmartBudgetSuggestions,
  detectAnomaliesAndInsights,
  parseNaturalLanguageQuery,
  HealthScoreResult,
  SuggestedBudget,
  FinancialInsight,
  AssistantAnswer,
} from '@/utils/financialIntelligence';

const SUGGESTED_QUESTIONS = [
  'My salary is ₹60,000. What should be my budget?',
  'Where did I spend the most?',
  'How much did I save?',
  'How should I divide my 60000 salary?',
  'Can I afford ₹5,000?',
];

export default function AssistantScreen() {
  const sqliteDb = useSQLiteContext();
  const currencyCode = useSettingsStore((s) => s.currency);
  const invalidateData = useAppStore((s) => s.invalidateData);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [healthScore, setHealthScore] = useState<HealthScoreResult | null>(null);
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [budgetSuggestions, setBudgetSuggestions] = useState<SuggestedBudget[]>([]);
  const [chatHistory, setChatHistory] = useState<AssistantAnswer[]>([]);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    async function loadIntelligence() {
      if (!sqliteDb) return;
      try {
        const db = createDrizzleDB(sqliteDb);
        const [scoreRes, insightRes, budgetRes] = await Promise.all([
          computeFinancialHealthScore(db),
          detectAnomaliesAndInsights(db, currencyCode),
          generateSmartBudgetSuggestions(db, currencyCode),
        ]);

        setHealthScore(scoreRes);
        setInsights(insightRes);
        setBudgetSuggestions(budgetRes);
      } catch (err) {
        console.error('[Assistant] Error loading intelligence:', err);
      } finally {
        setLoading(false);
      }
    }
    loadIntelligence();
  }, [sqliteDb, dataVersion, currencyCode]);

  const handleAskQuestion = async (queryText: string) => {
    if (!queryText.trim() || !sqliteDb) return;

    setInputQuery('');
    setLoading(true);

    try {
      const db = createDrizzleDB(sqliteDb);
      const answer = await parseNaturalLanguageQuery(db, queryText, currencyCode);

      setChatHistory((prev) => [...prev, answer]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error('[Assistant] Error parsing query:', err);
    } finally {
      setLoading(false);
    }
  };

  // Accept Suggested Budget (Inserts into SQLite budgets table)
  const handleAcceptBudget = async (sugg: SuggestedBudget) => {
    if (!sqliteDb) return;
    try {
      const db = createDrizzleDB(sqliteDb);
      const now = todayISO();

      // Deactivate existing budget for category if present
      await db
        .update(budgets)
        .set({ is_active: 0 })
        .where(eq(budgets.category_id, sugg.categoryId));

      // Insert new suggested budget
      await db.insert(budgets).values({
        id:          generateUUID(),
        name:        `${sugg.categoryName} Budget`,
        amount:      sugg.suggestedPaise,
        period:      'monthly',
        start_date:  now,
        category_id: sugg.categoryId,
        warn_at:     80,
        is_active:   1,
        created_at:  now,
        updated_at:  now,
      });

      invalidateData();
      Alert.alert(
        'Budget Created',
        `Monthly budget of ${sugg.suggestedFormatted} configured for ${sugg.categoryName}.`
      );

      // Remove from suggestions list
      setBudgetSuggestions((prev) => prev.filter((b) => b.categoryId !== sugg.categoryId));
    } catch (err) {
      console.error('[Assistant] Error accepting budget suggestion:', err);
      Alert.alert('Error', 'Failed to create budget.');
    }
  };

  const handleDismissBudget = (categoryId: string) => {
    setBudgetSuggestions((prev) => prev.filter((b) => b.categoryId !== categoryId));
  };

  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Local Financial Intelligence</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Financial Health Score Card ──────────────────────────────── */}
          {healthScore && (
            <View style={styles.healthCard}>
              <View style={styles.healthHeader}>
                <View style={styles.healthScoreChip}>
                  <Text style={styles.scoreNumber}>{healthScore.score}</Text>
                  <Text style={styles.scoreMax}>/100</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.healthLabel}>FINANCIAL HEALTH</Text>
                  <Text style={styles.healthRating}>{healthScore.rating}</Text>
                </View>
              </View>

              {healthScore.positives.map((pos, idx) => (
                <Text key={idx} style={styles.positiveText}>{pos}</Text>
              ))}
              {healthScore.attentionItems.map((att, idx) => (
                <Text key={idx} style={styles.attentionText}>{att}</Text>
              ))}
            </View>
          )}

          {/* ─── Financial Anomaly & Insight Cards ───────────────────────── */}
          {insights.map((ins) => (
            <View key={ins.id} style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Ionicons
                  name={ins.type === 'warning' ? 'warning-outline' : 'sparkles-outline'}
                  size={20}
                  color={ins.type === 'warning' ? EthosColors.error : EthosColors.primary}
                />
                <Text style={styles.insightTitle}>{ins.title}</Text>
              </View>
              <Text style={styles.insightBody}>{ins.message}</Text>
            </View>
          ))}

          {/* ─── Smart Budget Suggestions Carousel ───────────────────────── */}
          {budgetSuggestions.length > 0 && (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>Smart Budget Suggestions</Text>
              {budgetSuggestions.map((sugg) => (
                <View key={sugg.categoryId} style={styles.suggestionCard}>
                  <View style={styles.suggestionHeader}>
                    <View style={styles.catIconBox}>
                      <Ionicons name={sugg.categoryIcon as any} size={20} color={EthosColors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggCatName}>{sugg.categoryName}</Text>
                      <Text style={styles.suggReason}>{sugg.reasoning}</Text>
                    </View>
                    <Text style={styles.suggAmount}>{sugg.suggestedFormatted}</Text>
                  </View>

                  <View style={styles.suggActions}>
                    <Pressable
                      onPress={() => handleDismissBudget(sugg.categoryId)}
                      style={styles.dismissBtn}
                    >
                      <Text style={styles.dismissText}>Dismiss</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleAcceptBudget(sugg)}
                      style={styles.acceptBtn}
                    >
                      <Text style={styles.acceptText}>Accept Budget</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ─── Chat Conversation Area ────────────────────────────────────── */}
          {chatHistory.map((item, idx) => (
            <View key={idx} style={styles.chatMessageWrap}>
              {/* User Question */}
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{item.questionText}</Text>
              </View>

              {/* Assistant Answer Card */}
              <View style={styles.assistantCard}>
                <View style={styles.assistantTitleRow}>
                  <Ionicons name="sparkles" size={16} color={EthosColors.primary} />
                  <Text style={styles.assistantTitle}>Offline Intelligence</Text>
                </View>

                <Text style={styles.answerText}>{item.answerText}</Text>

                {item.metrics && (
                  <View style={styles.metricsRow}>
                    {item.metrics.map((m, mIdx) => (
                      <View key={mIdx} style={styles.metricChip}>
                        <Text style={styles.metricLabel}>{m.label}</Text>
                        <Text style={styles.metricVal}>{m.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}

          {/* ─── Suggested Questions Chips ────────────────────────────────── */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Suggested Questions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleAskQuestion(q)}
                  style={({ pressed }) => [styles.questionChip, pressed && styles.chipPressed]}
                >
                  <Text style={styles.questionText}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* ─── Query Input Toolbar ────────────────────────────────────────── */}
        <View style={[styles.inputToolbar, { paddingBottom: bottomPadding }]}>
          <TextInput
            value={inputQuery}
            onChangeText={setInputQuery}
            placeholder="Ask about your spending, savings, budgets..."
            placeholderTextColor={EthosColors.outline}
            style={styles.queryInput}
            onSubmitEditing={() => handleAskQuestion(inputQuery)}
          />
          <Pressable
            onPress={() => handleAskQuestion(inputQuery)}
            disabled={!inputQuery.trim() || loading}
            style={({ pressed }) => [
              styles.sendBtn,
              (!inputQuery.trim() || loading) && { opacity: 0.4 },
              pressed && { opacity: 0.8 },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={EthosColors.onPrimary} />
            ) : (
              <Ionicons name="arrow-up" size={20} color={EthosColors.onPrimary} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: EthosColors.background,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
    backgroundColor:   EthosColors.surface,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
  },
  navBtn: {
    padding: 4,
  },
  headerTitle: {
    ...EthosTypography.headlineLg,
    color:      EthosColors.onSurface,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackMd,
    paddingBottom:     100,
    gap:               EthosSpacing.stackLg,
  },
  healthCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.stackSm,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           EthosSpacing.stackMd,
    marginBottom:  EthosSpacing.stackSm,
  },
  healthScoreChip: {
    flexDirection:   'row',
    alignItems:      'baseline',
    backgroundColor: EthosColors.surfaceContainerHigh,
    borderRadius:    EthosRadius.md,
    paddingHorizontal: 12,
    paddingVertical:   6,
  },
  scoreNumber: {
    ...EthosTypography.headlineLg,
    fontSize:   24,
    color:      EthosColors.primary,
    fontWeight: '700',
  },
  scoreMax: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  healthLabel: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: 1,
  },
  healthRating: {
    ...EthosTypography.bodyLg,
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  positiveText: {
    ...EthosTypography.bodyMd,
    color: '#059669',
  },
  attentionText: {
    ...EthosTypography.bodyMd,
    color: EthosColors.error,
  },
  insightCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             6,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  insightTitle: {
    ...EthosTypography.bodyLg,
    fontWeight: '600',
    color:      EthosColors.primary,
  },
  insightBody: {
    ...EthosTypography.bodyMd,
    color: EthosColors.onSurfaceVariant,
  },
  sectionWrap: {
    gap: EthosSpacing.stackSm,
  },
  sectionTitle: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  suggestionCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.stackMd,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           EthosSpacing.stackMd,
  },
  catIconBox: {
    width:           40,
    height:          40,
    borderRadius:    EthosRadius.md,
    backgroundColor: EthosColors.surfaceContainerLow,
    alignItems:      'center',
    justifyContent:  'center',
  },
  suggCatName: {
    ...EthosTypography.bodyLg,
    fontWeight: '600',
    color:      EthosColors.primary,
  },
  suggReason: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  suggAmount: {
    ...EthosTypography.headlineLg,
    fontSize:   18,
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  suggActions: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
    gap:            EthosSpacing.stackMd,
  },
  dismissBtn: {
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackSm,
  },
  dismissText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  acceptBtn: {
    backgroundColor:   EthosColors.primary,
    borderRadius:      EthosRadius.md,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackSm + 2,
  },
  acceptText: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color:      EthosColors.onPrimary,
  },
  chatMessageWrap: {
    gap: EthosSpacing.stackSm,
  },
  userBubble: {
    alignSelf:         'flex-end',
    backgroundColor:   EthosColors.primary,
    borderRadius:      EthosRadius.lg,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackSm + 2,
    maxWidth:          '85%',
  },
  userText: {
    ...EthosTypography.bodyMd,
    color: EthosColors.onPrimary,
  },
  assistantCard: {
    alignSelf:       'flex-start',
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    maxWidth:        '92%',
    gap:             EthosSpacing.stackSm,
  },
  assistantTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  assistantTitle: {
    ...EthosTypography.labelSm,
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  answerText: {
    ...EthosTypography.bodyMd,
    color: EthosColors.onSurface,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    marginTop:     4,
  },
  metricChip: {
    backgroundColor: EthosColors.surfaceContainerLow,
    borderRadius:    EthosRadius.md,
    paddingHorizontal: 10,
    paddingVertical:   6,
  },
  metricLabel: {
    ...EthosTypography.labelSm,
    fontSize: 10,
    color:    EthosColors.outline,
  },
  metricVal: {
    ...EthosTypography.bodyMd,
    fontWeight: '600',
    color:      EthosColors.primary,
  },
  questionChip: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    borderRadius:    EthosRadius.full,
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  chipPressed: {
    backgroundColor: EthosColors.surfaceContainerLow,
  },
  questionText: {
    ...EthosTypography.labelMd,
    color: EthosColors.primary,
  },
  inputToolbar: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               EthosSpacing.stackSm,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackSm + 2,
    backgroundColor:   EthosColors.surface,
    borderTopWidth:    EthosBorder.width,
    borderTopColor:    EthosBorder.color,
  },
  queryInput: {
    flex:              1,
    backgroundColor:   EthosColors.surfaceContainerLow,
    borderRadius:      EthosRadius.full,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackSm + 2,
    ...EthosTypography.bodyMd,
    color:             EthosColors.onSurface,
  },
  sendBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: EthosColors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
});

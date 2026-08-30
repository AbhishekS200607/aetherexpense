/**
 * AetherExpense — Aether AI (Offline Local Financial Intelligence Copilot)
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
  'Where did I spend the most this month?',
  'How much did I save?',
  'Can I afford ₹5,000 extra expense?',
  'How should I divide my income?',
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
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
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
        {/* ─── Sleek Header Bar ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={EthosColors.onSurface} />
          </Pressable>

          <View style={styles.headerCenter}>
            <View style={styles.avatarChip}>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            </View>
            <View style={{ gap: 1 }}>
              <Text style={styles.headerTitle}>Aether AI</Text>
              <View style={styles.onlineBadge}>
                <View style={styles.greenDot} />
                <Text style={styles.badgeText}>Offline Copilot</Text>
              </View>
            </View>
          </View>

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
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.healthLabel}>FINANCIAL HEALTH SCORE</Text>
                  <Text style={styles.healthRating}>{healthScore.rating}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {healthScore.positives.map((pos, idx) => (
                <View key={`pos-${idx}`} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.positiveText}>{pos}</Text>
                </View>
              ))}
              {healthScore.attentionItems.map((att, idx) => (
                <View key={`att-${idx}`} style={styles.bulletRow}>
                  <Ionicons name="alert-circle" size={16} color={EthosColors.error} />
                  <Text style={styles.attentionText}>{att}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ─── Financial Anomaly & Insight Cards ───────────────────────── */}
          {insights.map((ins) => (
            <View key={ins.id} style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <View style={[
                  styles.insightIconBox,
                  ins.type === 'warning' ? { backgroundColor: 'rgba(239,68,68,0.1)' } : { backgroundColor: 'rgba(99,102,241,0.1)' }
                ]}>
                  <Ionicons
                    name={ins.type === 'warning' ? 'warning' : 'sparkles'}
                    size={16}
                    color={ins.type === 'warning' ? EthosColors.error : EthosColors.primary}
                  />
                </View>
                <Text style={styles.insightTitle}>{ins.title}</Text>
              </View>
              <Text style={styles.insightBody}>{ins.message}</Text>
            </View>
          ))}

          {/* ─── Smart Budget Suggestions Carousel ───────────────────────── */}
          {budgetSuggestions.length > 0 && (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>Smart Budget Recommendations</Text>
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
          {chatHistory.length === 0 && (
            <View style={styles.emptyWelcomeCard}>
              <Ionicons name="chatbubbles-outline" size={32} color={EthosColors.primary} />
              <Text style={styles.welcomeTitle}>Ask Aether AI Anything</Text>
              <Text style={styles.welcomeSubtext}>
                Get instant insights about your expenses, budgets, savings rate, or salary allocation — 100% offline & private.
              </Text>
            </View>
          )}

          {chatHistory.map((item, idx) => (
            <View key={idx} style={styles.chatMessageWrap}>
              {/* User Question */}
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{item.questionText}</Text>
              </View>

              {/* Aether AI Answer Card */}
              <View style={styles.assistantCard}>
                <View style={styles.assistantTitleRow}>
                  <View style={styles.smallAvatar}>
                    <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                  </View>
                  <Text style={styles.assistantTitle}>Aether AI</Text>
                </View>

                <Text style={styles.answerText}>{item.answerText}</Text>

                {item.metrics && item.metrics.length > 0 && (
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
            <Text style={styles.sectionTitle}>Suggested Prompts</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleAskQuestion(q)}
                  style={({ pressed }) => [styles.questionChip, pressed && styles.chipPressed]}
                >
                  <Ionicons name="sparkles-outline" size={14} color={EthosColors.primary} />
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
            placeholder="Ask Aether AI about your spending..."
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
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
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
    paddingVertical:   10,
    backgroundColor:   EthosColors.surface,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
  },
  navBtn: {
    padding: 6,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  avatarChip: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: EthosColors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerTitle: {
    ...EthosTypography.headlineLg,
    fontSize:   16,
    color:      EthosColors.onSurface,
    fontWeight: '700',
    lineHeight: 20,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  greenDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#10B981',
  },
  badgeText: {
    ...EthosTypography.labelSm,
    fontSize: 11,
    color:    EthosColors.outline,
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
  },
  healthScoreChip: {
    flexDirection:   'row',
    alignItems:      'baseline',
    backgroundColor: EthosColors.surfaceContainerLow,
    borderRadius:    EthosRadius.md,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
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
    fontSize:      10,
  },
  healthRating: {
    ...EthosTypography.bodyLg,
    color:      EthosColors.primary,
    fontWeight: '700',
  },
  divider: {
    height:          1,
    backgroundColor: EthosBorder.color,
    marginVertical:  4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  positiveText: {
    ...EthosTypography.bodyMd,
    color:    '#059669',
    fontSize: 13,
    flex:     1,
  },
  attentionText: {
    ...EthosTypography.bodyMd,
    color:    EthosColors.error,
    fontSize: 13,
    flex:     1,
  },
  insightCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             8,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  insightIconBox: {
    width:          28,
    height:         28,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
  },
  insightTitle: {
    ...EthosTypography.bodyLg,
    fontWeight: '600',
    color:      EthosColors.primary,
    fontSize:   14,
  },
  insightBody: {
    ...EthosTypography.bodyMd,
    color:    EthosColors.onSurfaceVariant,
    fontSize: 13,
  },
  sectionWrap: {
    gap: EthosSpacing.stackSm,
  },
  sectionTitle: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize:      11,
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
    fontSize:   14,
  },
  suggReason: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  suggAmount: {
    ...EthosTypography.headlineLg,
    fontSize:   16,
    color:      EthosColors.primary,
    fontWeight: '700',
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
    color:      '#FFFFFF',
  },
  emptyWelcomeCard: {
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderRadius:      EthosRadius.lg,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    padding:           EthosSpacing.containerPadding + 4,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    marginVertical:    12,
  },
  welcomeTitle: {
    ...EthosTypography.headlineLg,
    fontSize:   16,
    fontWeight: '600',
    color:      EthosColors.primary,
  },
  welcomeSubtext: {
    ...EthosTypography.bodyMd,
    fontSize:   13,
    color:      EthosColors.outline,
    textAlign:  'center',
    lineHeight: 18,
  },
  chatMessageWrap: {
    gap: EthosSpacing.stackSm,
  },
  userBubble: {
    alignSelf:         'flex-end',
    backgroundColor:   EthosColors.primary,
    borderRadius:      EthosRadius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   10,
    maxWidth:          '85%',
  },
  userText: {
    ...EthosTypography.bodyMd,
    color:    '#FFFFFF',
    fontSize: 14,
  },
  assistantCard: {
    alignSelf:       'flex-start',
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderTopLeftRadius: 4,
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
  smallAvatar: {
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: EthosColors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  assistantTitle: {
    ...EthosTypography.labelSm,
    color:      EthosColors.primary,
    fontWeight: '700',
    fontSize:   12,
  },
  answerText: {
    ...EthosTypography.bodyMd,
    color:    EthosColors.onSurface,
    fontSize: 14,
    lineHeight: 20,
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
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
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
    fontSize:   13,
  },
  questionChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
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
    color:    EthosColors.primary,
    fontSize: 13,
  },
  inputToolbar: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               EthosSpacing.stackSm,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   10,
    backgroundColor:   EthosColors.surface,
    borderTopWidth:    EthosBorder.width,
    borderTopColor:    EthosBorder.color,
  },
  queryInput: {
    flex:              1,
    backgroundColor:   EthosColors.surfaceContainerLow,
    borderRadius:      EthosRadius.full,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   10,
    ...EthosTypography.bodyMd,
    fontSize:          14,
    color:             EthosColors.onSurface,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
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


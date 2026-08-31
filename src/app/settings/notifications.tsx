/**
 * AetherExpense — Notification Settings & Reminders Screen
 *
 * Full animated local notification controls for bill reminders, budget overspend alerts,
 * and instant interactive animated toast testing.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useToastStore } from '@/store/toastStore';
import { requestNotificationPermissions } from '@/utils/notifications';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';

export default function NotificationsScreen() {
  const showToast = useToastStore((s) => s.showToast);

  const [billReminders, setBillReminders] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [recurringAlerts, setRecurringAlerts] = useState(true);

  const handleToggleBillReminders = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        showToast({
          type: 'warning',
          title: 'Permission Notice',
          message: 'Device notification permissions are disabled in system settings.',
        });
      } else {
        showToast({
          type: 'success',
          title: 'Bill Reminders Enabled',
          message: 'You will receive 100% offline local device reminders 1 day before bill due dates.',
        });
      }
    } else {
      showToast({
        type: 'info',
        title: 'Bill Reminders Disabled',
        message: 'Local bill due notifications have been paused.',
      });
    }
    setBillReminders(val);
  };

  const handleToggleBudgetAlerts = (val: boolean) => {
    setBudgetAlerts(val);
    showToast({
      type: val ? 'success' : 'info',
      title: val ? 'Budget Alerts Enabled' : 'Budget Alerts Paused',
      message: val
        ? 'Animated warning cards will notify you when spending hits 80% or 100% of budget limits.'
        : 'Budget threshold notifications are turned off.',
    });
  };

  const handleToggleRecurringAlerts = (val: boolean) => {
    setRecurringAlerts(val);
    showToast({
      type: val ? 'success' : 'info',
      title: val ? 'Execution Notifications On' : 'Execution Notifications Off',
      message: val
        ? 'You will get animated notification cards when auto-recurring rules execute.'
        : 'Silent background execution enabled.',
    });
  };

  const handleTestAnimatedSuccess = () => {
    showToast({
      type: 'success',
      title: 'Payment Successful! 🎉',
      message: '₹3,500.00 transferred from Bank Account to Cash Wallet.',
    });
  };

  const handleTestAnimatedWarning = () => {
    showToast({
      type: 'warning',
      title: 'Budget Alert (85% Used)',
      message: 'Dining & Food spending reached ₹8,500 of ₹10,000 monthly limit.',
    });
  };

  const handleTestAnimatedError = () => {
    showToast({
      type: 'error',
      title: 'Transfer Failed',
      message: 'Insufficient balance in Bank Account. Available: ₹2,000.00.',
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Navbar */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications & Reminders</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Local Notifications Group */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>100% Offline Local Device Alerts</Text>
          <View style={styles.bentoCard}>
            {/* Bill Reminders Row */}
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="receipt-outline" size={18} color="#6366F1" />
              </View>
              <View style={styles.rowLabelWrap}>
                <Text style={styles.rowTitle}>Bill Payment Reminders</Text>
                <Text style={styles.rowSub}>Local notifications 1 day prior to due date</Text>
              </View>
              <Switch
                value={billReminders}
                onValueChange={handleToggleBillReminders}
                trackColor={{ false: EthosColors.outlineVariant, true: EthosColors.primary }}
              />
            </View>

            {/* Budget Overspend Row */}
            <View style={[styles.row, styles.rowBorder]}>
              <View style={[styles.rowIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="warning-outline" size={18} color="#D97706" />
              </View>
              <View style={styles.rowLabelWrap}>
                <Text style={styles.rowTitle}>Budget Overspend Warnings</Text>
                <Text style={styles.rowSub}>Animated cards at 80% & 100% budget thresholds</Text>
              </View>
              <Switch
                value={budgetAlerts}
                onValueChange={handleToggleBudgetAlerts}
                trackColor={{ false: EthosColors.outlineVariant, true: EthosColors.primary }}
              />
            </View>

            {/* Recurring Rule Alerts */}
            <View style={[styles.row, styles.rowBorder]}>
              <View style={[styles.rowIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="refresh-outline" size={18} color="#059669" />
              </View>
              <View style={styles.rowLabelWrap}>
                <Text style={styles.rowTitle}>Recurring Transaction Logs</Text>
                <Text style={styles.rowSub}>In-app notification when automated rules run</Text>
              </View>
              <Switch
                value={recurringAlerts}
                onValueChange={handleToggleRecurringAlerts}
                trackColor={{ false: EthosColors.outlineVariant, true: EthosColors.primary }}
              />
            </View>
          </View>
        </View>

        {/* Animated Notification Test Bench */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Animated Notification Preview</Text>
          <View style={styles.bentoCard}>
            <Pressable onPress={handleTestAnimatedSuccess} style={styles.testBtn}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#059669" />
              <Text style={styles.testBtnText}>Test Success Notification Banner</Text>
            </Pressable>

            <Pressable onPress={handleTestAnimatedWarning} style={[styles.testBtn, styles.rowBorder]}>
              <Ionicons name="warning-outline" size={20} color="#D97706" />
              <Text style={styles.testBtnText}>Test Budget Warning Banner</Text>
            </Pressable>

            <Pressable onPress={handleTestAnimatedError} style={[styles.testBtn, styles.rowBorder]}>
              <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
              <Text style={styles.testBtnText}>Test Error / Insufficient Balance Banner</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: EthosColors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical: EthosSpacing.stackSm,
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    ...EthosTypography.headlineLg,
    fontSize: 17,
    color: EthosColors.onSurface,
    fontWeight: '600',
  },
  scrollContent: {
    padding: EthosSpacing.containerPadding,
    gap: EthosSpacing.stackLg,
  },
  sectionWrap: {
    gap: EthosSpacing.stackSm,
  },
  sectionTitle: {
    ...EthosTypography.labelSm,
    fontSize: 12,
    color: EthosColors.outline,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bentoCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius: EthosRadius.lg,
    borderWidth: EthosBorder.width,
    borderColor: EthosBorder.color,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: EthosSpacing.containerPadding,
    gap: EthosSpacing.stackSm,
  },
  rowBorder: {
    borderTopWidth: EthosBorder.width,
    borderTopColor: EthosBorder.color,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabelWrap: {
    flex: 1,
  },
  rowTitle: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color: EthosColors.onSurface,
  },
  rowSub: {
    ...EthosTypography.bodyMd,
    fontSize: 12,
    color: EthosColors.outline,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: EthosSpacing.containerPadding,
  },
  testBtnText: {
    ...EthosTypography.labelMd,
    color: EthosColors.onSurface,
    fontWeight: '500',
  },
});

/**
 * AetherExpense — Premium Animated Toast Notification Component
 *
 * Renders animated, top-floating notification cards for in-app alerts,
 * bill reminders, budget warnings, and success feedback.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  SlideInUp,
  SlideOutUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToastStore, ToastType } from '@/store/toastStore';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
  EthosShadow,
} from '@/theme/ethos';

const TOAST_CONFIG: Record<
  ToastType,
  { icon: string; color: string; bg: string; border: string }
> = {
  success: {
    icon: 'checkmark-circle',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
  },
  error: {
    icon: 'alert-circle',
    color: '#EF4444',
    bg: '#FEF2F2',
    border: '#FCA5A5',
  },
  warning: {
    icon: 'warning',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  info: {
    icon: 'information-circle',
    color: '#6366F1',
    bg: '#EEF2FF',
    border: '#C7D2FE',
  },
};

export function AnimatedToast() {
  const toast = useToastStore((s) => s.toast);
  const hideToast = useToastStore((s) => s.hideToast);

  const progressWidth = useSharedValue(100);

  useEffect(() => {
    if (toast) {
      const duration = toast.duration ?? 3200;
      progressWidth.value = 100;
      progressWidth.value = withTiming(0, {
        duration,
        easing: Easing.linear,
      });

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [toast]);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  if (!toast) return null;

  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.safeContainer} edges={['top']}>
      <Animated.View
        entering={SlideInUp.springify().damping(16).stiffness(120)}
        exiting={SlideOutUp.duration(200)}
        style={[
          styles.toastCard,
          { backgroundColor: EthosColors.surfaceContainerLowest, borderColor: config.border },
        ]}
      >
        <View style={styles.contentRow}>
          {/* Icon Badge */}
          <View style={[styles.iconBadge, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon as any} size={22} color={config.color} />
          </View>

          {/* Text Container */}
          <View style={styles.textWrap}>
            <Text style={styles.titleText}>{toast.title}</Text>
            {toast.message && <Text style={styles.messageText}>{toast.message}</Text>}
          </View>

          {/* Close Button */}
          <Pressable onPress={hideToast} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={18} color={EthosColors.outline} />
          </Pressable>
        </View>

        {/* Animated Progress Bar */}
        <View style={styles.progressBg}>
          <Animated.View
            style={[styles.progressFill, { backgroundColor: config.color }, animatedProgressStyle]}
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: EthosSpacing.containerPadding,
  },
  toastCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: EthosRadius.lg,
    borderWidth: EthosBorder.width,
    marginTop: EthosSpacing.stackSm,
    overflow: 'hidden',
    ...EthosShadow.card,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: EthosSpacing.containerPadding,
    gap: EthosSpacing.stackSm,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  titleText: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color: EthosColors.onSurface,
  },
  messageText: {
    ...EthosTypography.bodyMd,
    fontSize: 12,
    color: EthosColors.outline,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
  progressBg: {
    height: 3,
    width: '100%',
    backgroundColor: EthosColors.surfaceContainerLow,
  },
  progressFill: {
    height: '100%',
  },
});

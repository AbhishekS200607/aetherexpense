/**
 * AetherExpense — Animated Confirmation Tick Component
 *
 * Micro-animation feedback component built with `react-native-reanimated`.
 * Shows an expanding spring-bounced circle and an animated pop-in checkmark tick
 * upon completing transactions, paying bills, or creating budgets.
 */

import React, { useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
} from '@/theme/ethos';

interface SuccessAnimationProps {
  visible:  boolean;
  title:    string;
  subtext?: string;
  onFinish: () => void;
}

export function SuccessAnimation({
  visible,
  title,
  subtext,
  onFinish,
}: SuccessAnimationProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // 1. Fade in background
      opacity.value = withTiming(1, { duration: 200 });

      // 2. Spring pop-in circle
      scale.value = withSequence(
        withSpring(1.2, { damping: 10, stiffness: 200 }),
        withSpring(1.0, { damping: 12, stiffness: 180 })
      );

      // 3. Tick mark pop-in
      checkScale.value = withSequence(
        withTiming(0, { duration: 150 }),
        withSpring(1.1, { damping: 8, stiffness: 250 }),
        withSpring(1.0, { damping: 12, stiffness: 200 })
      );

      // 4. Auto finish after 1.5 seconds
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 250 }, () => {
          onFinish();
        });
      }, 1500);

      return () => clearTimeout(timer);
    } else {
      scale.value = 0;
      opacity.value = 0;
      checkScale.value = 0;
    }
  }, [visible]);

  const animatedCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedCheckStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.overlay, animatedOverlayStyle]}>
        <Pressable onPress={onFinish} style={styles.card}>
          {/* Animated Circle Container */}
          <Animated.View style={[styles.circle, animatedCircleStyle]}>
            <Animated.View style={animatedCheckStyle}>
              <Ionicons name="checkmark-sharp" size={48} color="#FFFFFF" />
            </Animated.View>
          </Animated.View>

          {/* Confirmation Title & Subtext */}
          <Text style={styles.title}>{title}</Text>
          {subtext && <Text style={styles.subtext}>{subtext}</Text>}
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         EthosSpacing.containerPadding,
  },
  card: {
    backgroundColor:   EthosColors.surfaceContainerLowest,
    borderRadius:      EthosRadius.lg,
    paddingHorizontal: EthosSpacing.containerPadding * 1.5,
    paddingVertical:   EthosSpacing.containerPadding * 1.2,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               EthosSpacing.stackSm,
    minWidth:          240,
    elevation:         8,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.15,
    shadowRadius:      12,
  },
  circle: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: '#10B981', // Vibrant emerald green checkmark circle
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    EthosSpacing.stackSm,
  },
  title: {
    ...EthosTypography.headlineLg,
    fontSize:   18,
    color:      EthosColors.primary,
    fontWeight: '600',
    textAlign:  'center',
  },
  subtext: {
    ...EthosTypography.bodyMd,
    color:     EthosColors.outline,
    textAlign: 'center',
  },
});

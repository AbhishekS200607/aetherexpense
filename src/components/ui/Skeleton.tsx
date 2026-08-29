/**
 * AetherExpense — Skeleton Component
 * Animated placeholder for loading states.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

interface SkeletonProps {
  width?:   number | string;
  height?:  number;
  radius?:  number;
  style?:   StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius ?? height / 2,
          backgroundColor: colors.surfaceElevated,
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Pre-built skeleton for a transaction list item row.
 */
export function TransactionItemSkeleton() {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[4],
      }}
    >
      <Skeleton width={44} height={44} radius={22} style={{ marginRight: spacing[3] }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="60%" height={14} style={{ marginBottom: spacing[1.5] }} />
        <Skeleton width="40%" height={11} />
      </View>
      <Skeleton width={72} height={14} />
    </View>
  );
}

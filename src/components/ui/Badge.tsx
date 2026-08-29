/**
 * AetherExpense — Badge Component
 * Small status/label chip.
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export type BadgeVariant = 'income' | 'expense' | 'primary' | 'warning' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md';
}

export function Badge({ label, variant = 'neutral', style, size = 'md' }: BadgeProps) {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();

  const bgMap: Record<BadgeVariant, string> = {
    income:  colors.incomeFaint,
    expense: colors.expenseFaint,
    primary: colors.primaryFaint,
    warning: colors.warningFaint,
    neutral: colors.surfaceElevated,
  };

  const textMap: Record<BadgeVariant, string> = {
    income:  colors.income,
    expense: colors.expense,
    primary: colors.primary,
    warning: colors.warning,
    neutral: colors.textSecondary,
  };

  return (
    <View
      style={[
        {
          backgroundColor: bgMap[variant],
          borderRadius: radius.full,
          paddingHorizontal: size === 'sm' ? spacing[2] : spacing[3],
          paddingVertical: size === 'sm' ? spacing[0.5] : spacing[1],
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: textMap[variant],
          fontSize: size === 'sm' ? fontSize.xs : fontSize.sm,
          fontWeight: fontWeight.medium,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

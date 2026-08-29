/**
 * AetherExpense — Ethos MetricCard
 *
 * Displays a single financial metric (income, expense, savings) in the
 * 2-column grid on the Home/Dashboard screen.
 *
 * Design spec: white card, 1px #E5E5E5 border, 24px radius, 24px padding.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';

interface MetricCardProps {
  label:     string;
  value:     string;
  /** Ionicons icon name */
  icon:      string;
  style?:    ViewStyle;
  /** If true, amount is styled in the income accent color */
  positive?: boolean;
}

export function MetricCard({ label, value, icon, style, positive }: MetricCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Ionicons
        name={icon as any}
        size={20}
        color={EthosColors.secondary}
        style={styles.icon}
      />
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text
          style={[
            styles.value,
            positive !== undefined && {
              color: positive ? EthosColors.income : EthosColors.onSurface,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex:            1,
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.unit,
  },
  icon: {
    // The icon sits above the text block
  },
  body: {
    gap: 4,
  },
  label: {
    ...EthosTypography.labelSm,
    color:          EthosColors.outline,
    textTransform:  'uppercase',
    letterSpacing:  EthosTypography.labelSm.letterSpacing,
  },
  value: {
    ...EthosTypography.bodyLg,
    fontWeight:    '500',
    color:          EthosColors.onSurface,
    fontVariant:   ['tabular-nums'],
  },
});

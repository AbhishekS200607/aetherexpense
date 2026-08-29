/**
 * AetherExpense — Ethos SpendingProgress
 *
 * "Spending this month" card from the Stitch home_dashboard design.
 * Shows label, spent/budget amounts, and a thin progress bar.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';

interface SpendingProgressProps {
  spent:         string;
  budget:        string;
  /** Fraction 0..1 */
  fraction:      number;
  /** If spending is near/over budget, show warning state */
  isOverBudget?: boolean;
}

export function SpendingProgress({
  spent,
  budget,
  fraction,
  isOverBudget = false,
}: SpendingProgressProps) {
  const clampedFraction = Math.min(Math.max(fraction, 0), 1);
  const barColor = isOverBudget ? EthosColors.error : EthosColors.primary;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.row}>
        <Text style={styles.label}>SPENDING THIS MONTH</Text>
        <Text style={styles.amounts}>
          {spent} / {budget}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.track}>
        <View
          style={[
            styles.bar,
            {
              width:           `${clampedFraction * 100}%` as any,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.stackMd,
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
  },
  label: {
    ...EthosTypography.labelSm,
    color:         EthosColors.outline,
    textTransform: 'uppercase',
    letterSpacing: EthosTypography.labelSm.letterSpacing,
  },
  amounts: {
    ...EthosTypography.labelSm,
    color:       EthosColors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height:          4,
    backgroundColor: EthosColors.secondaryContainer,
    borderRadius:    EthosRadius.full,
    overflow:        'hidden',
  },
  bar: {
    height:       4,
    borderRadius: EthosRadius.full,
  },
});

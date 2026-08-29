/**
 * AetherExpense — Ethos TransactionRow
 *
 * Single row in the Recent Transactions list on the Home/Dashboard screen.
 * Matches the Stitch home_dashboard design:
 *   - 40dp circular icon container (secondary-container background + border)
 *   - Merchant name (body-md, medium) + category name (label-sm, outline)
 *   - Amount right-aligned; income = tertiary-container accent, expense = primary
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';

interface TransactionRowProps {
  id:           string;
  label:        string;   // merchant or note or category
  subLabel:     string;   // category name
  amount:       string;   // pre-formatted, e.g. "-₹450" or "+₹32,400"
  isIncome:     boolean;
  icon:         string;   // Ionicons name
  iconColor?:   string;   // from category color; falls back to secondary
  isLast?:      boolean;
  onPress?:     () => void;
}

export function TransactionRow({
  id,
  label,
  subLabel,
  amount,
  isIncome,
  icon,
  iconColor,
  isLast = false,
  onPress,
}: TransactionRowProps) {
  const amountColor = isIncome
    ? EthosColors.onTertiaryContainer    // indigo accent for income
    : EthosColors.onSurface;            // near-black for expenses

  return (
    <Pressable
      id={`ethos-txn-${id}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowBorder,
        pressed && styles.rowPressed,
      ]}
      accessibilityLabel={`${isIncome ? 'Income' : 'Expense'}: ${label}, ${amount}`}
    >
      {/* Icon container */}
      <View style={styles.iconWrap}>
        <Ionicons
          name={icon as any}
          size={20}
          color={iconColor ?? EthosColors.secondary}
        />
      </View>

      {/* Text block */}
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subLabel}
        </Text>
      </View>

      {/* Amount */}
      <Text style={[styles.amount, { color: amountColor }]}>
        {amount}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: EthosSpacing.stackMd,
    paddingHorizontal: EthosSpacing.containerPadding,
    backgroundColor:   EthosColors.surfaceContainerLowest,
  },
  rowBorder: {
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosColors.secondaryContainer,
  },
  rowPressed: {
    backgroundColor: EthosColors.surfaceContainerLow,
  },
  iconWrap: {
    width:           40,
    height:          40,
    borderRadius:    EthosRadius.full,
    backgroundColor: EthosColors.secondaryContainer,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     EthosSpacing.gutter,
  },
  textBlock: {
    flex: 1,
    gap:  2,
  },
  title: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color:      EthosColors.onSurface,
  },
  subtitle: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  amount: {
    ...EthosTypography.bodyMd,
    fontVariant: ['tabular-nums'],
    marginLeft:  EthosSpacing.gutter,
  },
});

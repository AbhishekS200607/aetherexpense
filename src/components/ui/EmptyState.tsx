/**
 * AetherExpense — EmptyState Component
 * Displayed when a list has no data.
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?:        string;
  title:        string;
  description?: string;
  actionLabel?: string;
  onAction?:   () => void;
  style?:       StyleProp<ViewStyle>;
}

export function EmptyState({
  icon = 'document-outline',
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.primaryFaint,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[4],
        }}
      >
        <Ionicons name={icon as any} size={36} color={colors.primary} />
      </View>

      <Text
        style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          color: colors.textPrimary,
          textAlign: 'center',
          marginBottom: spacing[2],
        }}
      >
        {title}
      </Text>

      {description ? (
        <Text
          style={{
            fontSize: fontSize.base,
            color: colors.textSecondary,
            textAlign: 'center',
            lineHeight: fontSize.base * 1.5,
            marginBottom: actionLabel ? spacing[6] : 0,
            paddingHorizontal: spacing[6],
          }}
        >
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="primary"
          size="md"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});

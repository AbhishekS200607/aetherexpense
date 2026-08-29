/**
 * AetherExpense — Card Component
 * Elevated surface container with optional press handling and gradient.
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  elevated?: boolean;
  padding?: number;
  testID?: string;
}

export function Card({
  children,
  style,
  onPress,
  onLongPress,
  elevated = false,
  padding,
  testID,
}: CardProps) {
  const { colors, spacing, radius, shadow } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
    borderRadius: radius.lg,
    padding: padding ?? spacing[4],
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...(elevated ? shadow.base : shadow.sm),
  };

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.9 : 1 }, style]}
        testID={testID}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[cardStyle, style]} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({});

/**
 * AetherExpense — Button Component
 * Supports primary, secondary, ghost, danger variants with loading state.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  style,
  leftIcon,
  rightIcon,
  disabled,
  ...rest
}: ButtonProps) {
  const { colors, spacing, radius, fontWeight, fontSize } = useTheme();

  const isDisabled = disabled || loading;

  const bgColor: Record<ButtonVariant, string> = {
    primary:   colors.primary,
    secondary: colors.surfaceElevated,
    ghost:     'transparent',
    danger:    colors.expense,
    success:   colors.income,
  };

  const textColor: Record<ButtonVariant, string> = {
    primary:   '#FFFFFF',
    secondary: colors.textPrimary,
    ghost:     colors.primary,
    danger:    '#FFFFFF',
    success:   '#FFFFFF',
  };

  const paddingV: Record<ButtonSize, number> = {
    sm: spacing[1.5],
    md: spacing[3],
    lg: spacing[4],
  };

  const paddingH: Record<ButtonSize, number> = {
    sm: spacing[3],
    md: spacing[5],
    lg: spacing[6],
  };

  const textSize: Record<ButtonSize, number> = {
    sm: fontSize.sm,
    md: fontSize.base,
    lg: fontSize.md,
  };

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bgColor[variant],
          paddingVertical: paddingV[size],
          paddingHorizontal: paddingH[size],
          borderRadius: radius.md,
          opacity: pressed ? 0.8 : isDisabled ? 0.5 : 1,
          width: fullWidth ? '100%' : undefined,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: variant === 'secondary' ? colors.surfaceBorder : undefined,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} size="small" />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              styles.label,
              {
                color: textColor[variant],
                fontSize: textSize[size],
                fontWeight: fontWeight.semibold,
                marginLeft: leftIcon ? spacing[2] : 0,
                marginRight: rightIcon ? spacing[2] : 0,
              },
            ]}
          >
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});

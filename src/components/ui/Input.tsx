/**
 * AetherExpense — Input Component
 * Styled text input with label, error, and icon support.
 */

import React, { useState } from 'react';
import {
  Text,
  TextInput,
  View,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  required?: boolean;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerStyle,
  required,
  style,
  ...rest
}: InputProps) {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: spacing[1.5],
          }}
        >
          {label}
          {required && (
            <Text style={{ color: colors.expense }}> *</Text>
          )}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.inputBackground,
            borderColor: error
              ? colors.expense
              : focused
              ? colors.inputFocusBorder
              : colors.inputBorder,
            borderRadius: radius.md,
            borderWidth: 1.5,
            paddingHorizontal: spacing[3],
          },
        ]}
      >
        {leftIcon ? (
          <View style={{ marginRight: spacing[2] }}>{leftIcon}</View>
        ) : null}

        <TextInput
          {...rest}
          style={[
            {
              flex: 1,
              color: colors.textPrimary,
              fontSize: fontSize.base,
              paddingVertical: spacing[3],
            },
            style,
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
        />

        {rightIcon ? (
          <View style={{ marginLeft: spacing[2] }}>{rightIcon}</View>
        ) : null}
      </View>

      {error ? (
        <Text
          style={{
            fontSize: fontSize.xs,
            color: colors.expense,
            marginTop: spacing[1],
          }}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text
          style={{
            fontSize: fontSize.xs,
            color: colors.textTertiary,
            marginTop: spacing[1],
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

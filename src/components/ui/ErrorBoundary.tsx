/**
 * AetherExpense — React Error Boundary Component
 *
 * Catches JavaScript rendering errors in child component trees (such as charting libraries or data visuals)
 * and displays a safe, non-crashing fallback UI card.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EthosColors, EthosTypography, EthosRadius, EthosSpacing, EthosBorder } from '@/theme/ethos';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Render error caught:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconCircle}>
            <Ionicons name="warning-outline" size={24} color={EthosColors.error} />
          </View>
          <Text style={styles.title}>{this.props.fallbackTitle || 'Component Error'}</Text>
          <Text style={styles.message}>
            {this.props.fallbackMessage || 'Unable to display this visual component due to a data rendering mismatch.'}
          </Text>
          <Pressable onPress={this.handleRetry} style={styles.retryBtn}>
            <Ionicons name="refresh-outline" size={16} color={EthosColors.primary} />
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: EthosColors.surfaceContainerLow,
    borderRadius: EthosRadius.md,
    borderWidth: EthosBorder.width,
    borderColor: EthosBorder.color,
    padding: EthosSpacing.containerPadding,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: EthosSpacing.stackSm,
    gap: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color: EthosColors.onSurface,
  },
  message: {
    ...EthosTypography.bodyMd,
    fontSize: 13,
    color: EthosColors.outline,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: EthosRadius.full,
    backgroundColor: EthosColors.surfaceContainerHigh,
    marginTop: 4,
  },
  retryText: {
    ...EthosTypography.labelSm,
    color: EthosColors.primary,
    fontWeight: '600',
  },
});

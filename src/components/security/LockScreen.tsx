/**
 * AetherExpense — Ethos App Lock Screen Overlay Component
 *
 * Full-screen security barrier rendered when App Lock is active.
 * Completely obscures Dashboard, Balances, and Financial Data.
 * Supports PIN entry keypad, Biometric unlock button, and Failed Attempt Lockout protection.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import {
  verifyPin,
  authenticateBiometric,
  checkBiometricSupport,
  LockType,
} from '@/utils/security';

interface LockScreenProps {
  visible:      boolean;
  lockType:     LockType;
  onUnlock:     () => void;
}

export function LockScreen({ visible, lockType, onUnlock }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [failedCount, setFailedCount] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    async function checkBio() {
      const bio = await checkBiometricSupport();
      setBiometricAvailable(bio.hardwareSupported && bio.enrolled);
      // Auto-trigger biometric on show if lockType === 'biometric'
      if (visible && lockType === 'biometric' && bio.hardwareSupported && bio.enrolled) {
        triggerBiometrics();
      }
    }
    if (visible) {
      setPin('');
      checkBio();
    }
  }, [visible, lockType]);

  // Lockout Timer Countdown
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  if (!visible) return null;

  const triggerBiometrics = async () => {
    const success = await authenticateBiometric('Unlock AetherExpense');
    if (success) {
      setPin('');
      setFailedCount(0);
      onUnlock();
    }
  };

  const handleKeyPress = async (val: string) => {
    if (lockoutSeconds > 0) return;
    if (pin.length >= 4) return;

    const newPin = pin + val;
    setPin(newPin);

    if (newPin.length === 4) {
      const isValid = await verifyPin(newPin);
      if (isValid) {
        setPin('');
        setFailedCount(0);
        onUnlock();
      } else {
        Vibration.vibrate(200);
        setPin('');
        const newCount = failedCount + 1;
        setFailedCount(newCount);

        if (newCount >= 5) {
          setLockoutSeconds(30); // 30 second lockout delay after 5 failed attempts
          Alert.alert('Too Many Failed Attempts', 'Please wait 30 seconds before trying again.');
        } else {
          Alert.alert('Incorrect PIN', `Invalid PIN. ${5 - newCount} attempts remaining.`);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  return (
    <View style={styles.overlay}>
      {/* Top Header */}
      <View style={styles.headerWrap}>
        <View style={styles.lockIconChip}>
          <Ionicons name="lock-closed" size={32} color={EthosColors.primary} />
        </View>
        <Text style={styles.title}>AetherExpense Locked</Text>
        <Text style={styles.subtitle}>Enter PIN to access your financial data</Text>
      </View>

      {/* PIN Dot Indicators */}
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((idx) => {
          const filled = pin.length > idx;
          return (
            <View
              key={idx}
              style={[
                styles.dot,
                filled ? styles.dotFilled : styles.dotEmpty,
              ]}
            />
          );
        })}
      </View>

      {/* Lockout Warning Banner */}
      {lockoutSeconds > 0 && (
        <View style={styles.lockoutBanner}>
          <Text style={styles.lockoutText}>
            Try again in {lockoutSeconds} seconds
          </Text>
        </View>
      )}

      {/* Keypad Grid */}
      <View style={styles.keypad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row, rIdx) => (
          <View key={rIdx} style={styles.keypadRow}>
            {row.map((digit) => (
              <Pressable
                key={digit}
                onPress={() => handleKeyPress(digit)}
                disabled={lockoutSeconds > 0}
                style={({ pressed }) => [
                  styles.keyBtn,
                  pressed && styles.keyBtnPressed,
                  lockoutSeconds > 0 && { opacity: 0.4 },
                ]}
              >
                <Text style={styles.keyText}>{digit}</Text>
              </Pressable>
            ))}
          </View>
        ))}

        {/* Bottom Keypad Row: Biometrics | 0 | Backspace */}
        <View style={styles.keypadRow}>
          <Pressable
            onPress={triggerBiometrics}
            disabled={!biometricAvailable || lockoutSeconds > 0}
            style={({ pressed }) => [
              styles.keyBtn,
              styles.iconKeyBtn,
              pressed && styles.keyBtnPressed,
              (!biometricAvailable || lockoutSeconds > 0) && { opacity: 0.3 },
            ]}
          >
            <Ionicons name="finger-print-outline" size={28} color={EthosColors.primary} />
          </Pressable>

          <Pressable
            onPress={() => handleKeyPress('0')}
            disabled={lockoutSeconds > 0}
            style={({ pressed }) => [
              styles.keyBtn,
              pressed && styles.keyBtnPressed,
              lockoutSeconds > 0 && { opacity: 0.4 },
            ]}
          >
            <Text style={styles.keyText}>0</Text>
          </Pressable>

          <Pressable
            onPress={handleBackspace}
            style={({ pressed }) => [
              styles.keyBtn,
              styles.iconKeyBtn,
              pressed && styles.keyBtnPressed,
            ]}
          >
            <Ionicons name="backspace-outline" size={24} color={EthosColors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: EthosColors.surface,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          9999,
    paddingHorizontal: EthosSpacing.containerPadding,
  },
  headerWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    gap:            EthosSpacing.stackSm,
    marginBottom:   EthosSpacing.stackLg,
  },
  lockIconChip: {
    width:           64,
    height:          64,
    borderRadius:    EthosRadius.full,
    backgroundColor: EthosColors.surfaceContainerHigh,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    EthosSpacing.stackSm,
  },
  title: {
    ...EthosTypography.headlineLg,
    color:      EthosColors.primary,
    fontWeight: '600',
  },
  subtitle: {
    ...EthosTypography.bodyMd,
    color: EthosColors.outline,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
    gap:           16,
    marginBottom:  EthosSpacing.stackLg,
  },
  dot: {
    width:        16,
    height:       16,
    borderRadius: 8,
  },
  dotEmpty: {
    borderWidth: 1.5,
    borderColor: EthosColors.outlineVariant,
  },
  dotFilled: {
    backgroundColor: EthosColors.primary,
  },
  lockoutBanner: {
    backgroundColor:   'rgba(186, 26, 26, 0.12)',
    borderRadius:      EthosRadius.full,
    paddingHorizontal: 16,
    paddingVertical:   6,
    marginBottom:      EthosSpacing.stackLg,
  },
  lockoutText: {
    ...EthosTypography.labelSm,
    color:      EthosColors.error,
    fontWeight: '600',
  },
  keypad: {
    width:     '100%',
    maxWidth:  280,
    gap:       16,
  },
  keypadRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  keyBtn: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconKeyBtn: {
    backgroundColor: EthosColors.surfaceContainerLow,
  },
  keyBtnPressed: {
    backgroundColor: EthosColors.surfaceContainerHigh,
  },
  keyText: {
    ...EthosTypography.headlineLg,
    fontSize:   24,
    color:      EthosColors.primary,
    fontWeight: '500',
  },
});

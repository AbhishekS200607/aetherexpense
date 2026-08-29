/**
 * AetherExpense — Ethos Security Settings Screen
 *
 * Configures App Lock (Off, PIN, Biometrics), Auto-Lock Delay, Change PIN, Disable Lock,
 * and Privacy Mode (hides sensitive financial numbers).
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import {
  getLockType,
  setLockType,
  getAutoLockDelay,
  setAutoLockDelay,
  getPrivacyMode,
  setPrivacyMode,
  hasPinConfigured,
  setPinHash,
  verifyPin,
  clearPinHash,
  checkBiometricSupport,
  BiometricStatus,
  LockType,
} from '@/utils/security';

export default function SecuritySettingsScreen() {
  const [lockType, setLockTypeState] = useState<LockType>('off');
  const [autoLockDelay, setAutoLockDelayState] = useState(0);
  const [privacyMode, setPrivacyModeState] = useState(false);
  const [biometricInfo, setBiometricInfo] = useState<BiometricStatus>({
    hardwareSupported: false,
    enrolled:          false,
    biometricTypes:    [],
  });

  // PIN Dialog State
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState<'enable_pin' | 'enable_bio' | 'change_pin' | 'disable_lock'>('enable_pin');
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');

  useEffect(() => {
    async function loadSettings() {
      const lType = await getLockType();
      const delay = await getAutoLockDelay();
      const pMode = await getPrivacyMode();
      const bio = await checkBiometricSupport();

      setLockTypeState(lType);
      setAutoLockDelayState(delay);
      setPrivacyModeState(pMode);
      setBiometricInfo(bio);
    }
    loadSettings();
  }, []);

  // Handle Lock Type Change
  const handleSelectLockType = async (targetType: LockType) => {
    if (targetType === lockType) return;

    if (targetType === 'off') {
      // Require current PIN to disable
      const isConfigured = await hasPinConfigured();
      if (isConfigured) {
        setPinMode('disable_lock');
        setOldPinInput('');
        setShowPinModal(true);
      } else {
        await setLockType('off');
        setLockTypeState('off');
      }
    } else if (targetType === 'pin') {
      const isConfigured = await hasPinConfigured();
      if (!isConfigured) {
        setPinMode('enable_pin');
        setNewPinInput('');
        setConfirmPinInput('');
        setShowPinModal(true);
      } else {
        await setLockType('pin');
        setLockTypeState('pin');
      }
    } else if (targetType === 'biometric') {
      if (!biometricInfo.hardwareSupported || !biometricInfo.enrolled) {
        Alert.alert(
          'Biometrics Unavailable',
          'Biometric authentication is not supported or not enrolled on this device. Gracefully falling back to PIN lock.'
        );
        handleSelectLockType('pin');
        return;
      }
      const isConfigured = await hasPinConfigured();
      if (!isConfigured) {
        setPinMode('enable_bio');
        setNewPinInput('');
        setConfirmPinInput('');
        setShowPinModal(true);
      } else {
        await setLockType('biometric');
        setLockTypeState('biometric');
      }
    }
  };

  // Auto Lock Delay Change
  const handleSelectAutoLock = async (delay: number) => {
    await setAutoLockDelay(delay);
    setAutoLockDelayState(delay);
  };

  // Privacy Mode Toggle
  const handleTogglePrivacy = async (val: boolean) => {
    await setPrivacyMode(val);
    setPrivacyModeState(val);
  };

  // PIN Modal Submission
  const handlePinSubmit = async () => {
    if (pinMode === 'enable_pin' || pinMode === 'enable_bio') {
      if (newPinInput.length !== 4) {
        Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits.');
        return;
      }
      if (newPinInput !== confirmPinInput) {
        Alert.alert('PIN Mismatch', 'New PIN and confirm PIN do not match.');
        return;
      }
      await setPinHash(newPinInput);
      const targetType = pinMode === 'enable_bio' ? 'biometric' : 'pin';
      await setLockType(targetType);
      setLockTypeState(targetType);
      setShowPinModal(false);
      Alert.alert('App Lock Enabled', 'App lock configured successfully.');
    } else if (pinMode === 'change_pin') {
      const isValid = await verifyPin(oldPinInput);
      if (!isValid) {
        Alert.alert('Incorrect PIN', 'Current PIN is incorrect.');
        return;
      }
      if (newPinInput.length !== 4) {
        Alert.alert('Invalid PIN', 'New PIN must be exactly 4 digits.');
        return;
      }
      if (newPinInput !== confirmPinInput) {
        Alert.alert('PIN Mismatch', 'New PIN and confirm PIN do not match.');
        return;
      }
      await setPinHash(newPinInput);
      setShowPinModal(false);
      Alert.alert('PIN Updated', 'Your PIN has been changed successfully.');
    } else if (pinMode === 'disable_lock') {
      const isValid = await verifyPin(oldPinInput);
      if (!isValid) {
        Alert.alert('Incorrect PIN', 'Current PIN is incorrect.');
        return;
      }
      await setLockType('off');
      await clearPinHash();
      setLockTypeState('off');
      setShowPinModal(false);
      Alert.alert('App Lock Disabled', 'App lock has been turned off.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Navbar Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>App Lock & Security</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── App Lock Selector ────────────────────────────────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>App Lock Mode</Text>
          <View style={styles.bentoCard}>
            {[
              { id: 'off',       label: 'Disabled',                      sub: 'No lock screen' },
              { id: 'pin',       label: 'PIN Code Lock',                 sub: 'Requires 4-digit PIN' },
              { id: 'biometric', label: 'Biometric + PIN Fallback',      sub: 'Face ID / Fingerprint with PIN fallback' },
            ].map((opt, idx) => {
              const active = lockType === opt.id;
              const isLast = idx === 2;
              return (
                <Pressable
                  key={opt.id}
                  id={`lock-mode-${opt.id}`}
                  onPress={() => handleSelectLockType(opt.id as LockType)}
                  style={({ pressed }) => [
                    styles.row,
                    !isLast && styles.rowBorder,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowTitle}>{opt.label}</Text>
                    <Text style={styles.rowSubtext}>{opt.sub}</Text>
                  </View>
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={active ? EthosColors.primary : EthosColors.outline}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── Auto-Lock Delay Selector ────────────────────────────────────── */}
        {lockType !== 'off' && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Auto-Lock Delay</Text>
            <View style={styles.bentoCard}>
              {[
                { delay: 0,   label: 'Immediately on Background' },
                { delay: 60,  label: 'After 1 Minute' },
                { delay: 300, label: 'After 5 Minutes' },
                { delay: 900, label: 'After 15 Minutes' },
              ].map((opt, idx) => {
                const active = autoLockDelay === opt.delay;
                const isLast = idx === 3;
                return (
                  <Pressable
                    key={opt.delay}
                    onPress={() => handleSelectAutoLock(opt.delay)}
                    style={({ pressed }) => [
                      styles.row,
                      !isLast && styles.rowBorder,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <Text style={[styles.rowTitle, { flex: 1 }]}>{opt.label}</Text>
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={active ? EthosColors.primary : EthosColors.outline}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Privacy Mode Section ────────────────────────────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Privacy Settings</Text>
          <View style={styles.bentoCard}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>Privacy Mode</Text>
                <Text style={styles.rowSubtext}>
                  Hides financial amounts in notifications and background app previews
                </Text>
              </View>
              <Switch
                value={privacyMode}
                onValueChange={handleTogglePrivacy}
                trackColor={{ false: EthosColors.outlineVariant, true: EthosColors.primary }}
              />
            </View>
          </View>
        </View>

        {/* ─── Change PIN Section ──────────────────────────────────────────── */}
        {lockType !== 'off' && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Security Actions</Text>
            <View style={styles.bentoCard}>
              <Pressable
                id="change-pin-btn"
                onPress={() => {
                  setPinMode('change_pin');
                  setOldPinInput('');
                  setNewPinInput('');
                  setConfirmPinInput('');
                  setShowPinModal(true);
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>Change PIN Code</Text>
                  <Text style={styles.rowSubtext}>Update your 4-digit security PIN</Text>
                </View>
                <Ionicons name="key-outline" size={20} color={EthosColors.primary} />
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* PIN Configuration Modal */}
      <Modal visible={showPinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pinMode === 'enable_pin' || pinMode === 'enable_bio'
                ? 'Set Security PIN'
                : pinMode === 'change_pin'
                ? 'Change Security PIN'
                : 'Enter Current PIN to Disable'}
            </Text>

            {(pinMode === 'change_pin' || pinMode === 'disable_lock') && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Current PIN</Text>
                <TextInput
                  value={oldPinInput}
                  onChangeText={setOldPinInput}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  placeholder="****"
                  placeholderTextColor={EthosColors.outline}
                  style={styles.pinInput}
                />
              </View>
            )}

            {(pinMode === 'enable_pin' || pinMode === 'enable_bio' || pinMode === 'change_pin') && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New 4-Digit PIN</Text>
                  <TextInput
                    value={newPinInput}
                    onChangeText={setNewPinInput}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    placeholder="****"
                    placeholderTextColor={EthosColors.outline}
                    style={styles.pinInput}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm New PIN</Text>
                  <TextInput
                    value={confirmPinInput}
                    onChangeText={setConfirmPinInput}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    placeholder="****"
                    placeholderTextColor={EthosColors.outline}
                    style={styles.pinInput}
                  />
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowPinModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable onPress={handlePinSubmit} style={styles.modalSubmitBtn}>
                <Text style={styles.modalSubmitText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: EthosColors.background,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
    backgroundColor:   EthosColors.surface,
  },
  navBtn: {
    padding: 4,
  },
  headerTitle: {
    ...EthosTypography.headlineLg,
    color:      EthosColors.onSurface,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingTop:        EthosSpacing.stackMd,
    paddingBottom:     96,
    gap:               EthosSpacing.stackLg,
  },
  sectionWrap: {
    gap: EthosSpacing.stackMd,
  },
  sectionTitle: {
    ...EthosTypography.labelMd,
    color:         EthosColors.outline,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bentoCard: {
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    borderWidth:     EthosBorder.width,
    borderColor:     EthosBorder.color,
    overflow:        'hidden',
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
  },
  rowBorder: {
    borderBottomWidth: EthosBorder.width,
    borderBottomColor: EthosBorder.color,
  },
  rowPressed: {
    backgroundColor: EthosColors.surfaceContainerLow,
  },
  rowTitle: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color:      EthosColors.primary,
  },
  rowSubtext: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  switchRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
  },
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         EthosSpacing.containerPadding,
  },
  modalCard: {
    width:           '100%',
    backgroundColor: EthosColors.surfaceContainerLowest,
    borderRadius:    EthosRadius.lg,
    padding:         EthosSpacing.containerPadding,
    gap:             EthosSpacing.stackMd,
  },
  modalTitle: {
    ...EthosTypography.headlineLg,
    fontSize:   18,
    fontWeight: '600',
    color:      EthosColors.primary,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  pinInput: {
    ...EthosTypography.headlineLg,
    fontSize:          20,
    letterSpacing:     4,
    color:             EthosColors.onSurface,
    backgroundColor:   EthosColors.surfaceContainerLow,
    borderRadius:      EthosRadius.md,
    borderWidth:       EthosBorder.width,
    borderColor:       EthosBorder.color,
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackSm + 2,
    textAlign:         'center',
  },
  modalActions: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
    gap:            EthosSpacing.stackMd,
    marginTop:      EthosSpacing.stackSm,
  },
  modalCancelBtn: {
    paddingHorizontal: EthosSpacing.stackMd,
    paddingVertical:   EthosSpacing.stackSm,
  },
  modalCancelText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  modalSubmitBtn: {
    backgroundColor:   EthosColors.primary,
    borderRadius:      EthosRadius.md,
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackSm + 2,
  },
  modalSubmitText: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color:      EthosColors.onPrimary,
  },
});

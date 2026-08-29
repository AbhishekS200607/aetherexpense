/**
 * AetherExpense — Data Management Screen
 *
 * Provides Export Backup, Import Backup with Foreign-Key & Money Precision Validation,
 * Restore Safety Preview, Database Statistics, and Danger Zone Reset capabilities.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { createDrizzleDB } from '@/database/client';
import {
  accounts,
  categories,
  transactions,
  budgets,
  recurringTransactions,
  bills,
} from '@/database/schema';
import { useAppStore } from '@/store/appStore';
import {
  EthosColors,
  EthosTypography,
  EthosSpacing,
  EthosRadius,
  EthosBorder,
} from '@/theme/ethos';
import {
  exportBackup,
  validateBackupJSON,
  restoreBackupData,
  resetDatabaseToDefault,
  BackupPayload,
  BackupValidationSummary,
} from '@/utils/backup';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface DBStats {
  accountsCount:     number;
  categoriesCount:   number;
  transactionsCount: number;
  budgetsCount:      number;
  recurringCount:    number;
  billsCount:        number;
}

export default function DataManagementScreen() {
  const sqliteDb = useSQLiteContext();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const invalidateData = useAppStore((s) => s.invalidateData);

  const [stats, setStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Import Preview State
  const [importPayload, setImportPayload] = useState<BackupPayload | null>(null);
  const [importSummary, setImportSummary] = useState<BackupValidationSummary | null>(null);
  const [showImportPreview, setShowImportPreview] = useState(false);

  // Reset Confirmation State
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const db = createDrizzleDB(sqliteDb);
      const accs = await db.select().from(accounts);
      const cats = await db.select().from(categories);
      const txns = await db.select().from(transactions);
      const bdgs = await db.select().from(budgets);
      const recs = await db.select().from(recurringTransactions);
      const blls = await db.select().from(bills);

      setStats({
        accountsCount:     accs.length,
        categoriesCount:   cats.length,
        transactionsCount: txns.length,
        budgetsCount:      bdgs.length,
        recurringCount:    recs.length,
        billsCount:        blls.length,
      });
    } catch (err) {
      console.error('[DataManagementScreen] Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  }, [sqliteDb]);

  useEffect(() => {
    loadStats();
  }, [dataVersion, loadStats]);

  // Export Backup Handler
  const handleExport = async () => {
    setExporting(true);
    try {
      const db = createDrizzleDB(sqliteDb);
      await exportBackup(db);
    } catch (err: any) {
      console.error('[DataManagementScreen] Export error:', err);
      Alert.alert('Export Failed', err?.message || 'Could not export backup.');
    } finally {
      setExporting(false);
    }
  };

  // Import Backup Handler
  const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const fileUri = res.assets[0].uri;
      const jsonContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Validate JSON payload
      const { payload, summary } = validateBackupJSON(jsonContent);
      setImportPayload(payload);
      setImportSummary(summary);
      setShowImportPreview(true);
    } catch (err: any) {
      console.error('[DataManagementScreen] Pick file error:', err);
      Alert.alert('Invalid Backup File', err?.message || 'Could not read backup file.');
    }
  };

  // Perform Restore
  const handleConfirmRestore = async (backupCurrentFirst: boolean = false) => {
    if (!importPayload) return;
    setRestoring(true);
    setShowImportPreview(false);

    try {
      const db = createDrizzleDB(sqliteDb);
      if (backupCurrentFirst) {
        await exportBackup(db);
      }

      await restoreBackupData(db, importPayload);
      invalidateData();
      loadStats();
      Alert.alert('Restore Complete', 'Financial data restored successfully from backup.');
    } catch (err: any) {
      console.error('[DataManagementScreen] Restore error:', err);
      Alert.alert('Restore Failed', err?.message || 'An error occurred during restore.');
    } finally {
      setRestoring(false);
      setImportPayload(null);
      setImportSummary(null);
    }
  };

  // Danger Zone Reset Handler
  const handleConfirmReset = async () => {
    setShowResetConfirm(false);
    setLoading(true);
    try {
      const db = createDrizzleDB(sqliteDb);
      await resetDatabaseToDefault(db);
      invalidateData();
      loadStats();
      Alert.alert('Database Reset', 'All financial data has been reset to default state.');
    } catch (err: any) {
      console.error('[DataManagementScreen] Reset error:', err);
      Alert.alert('Reset Failed', err?.message || 'Could not reset database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Navbar Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={EthosColors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Data Management</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── Database Statistics Section ─────────────────────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Database Statistics</Text>

          <View style={styles.bentoCard}>
            {loading ? (
              <ActivityIndicator color={EthosColors.primary} style={{ padding: 16 }} />
            ) : (
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{stats?.transactionsCount || 0}</Text>
                  <Text style={styles.statLbl}>Transactions</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{stats?.accountsCount || 0}</Text>
                  <Text style={styles.statLbl}>Accounts</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{stats?.categoriesCount || 0}</Text>
                  <Text style={styles.statLbl}>Categories</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{stats?.budgetsCount || 0}</Text>
                  <Text style={styles.statLbl}>Budgets</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{stats?.recurringCount || 0}</Text>
                  <Text style={styles.statLbl}>Recurring Rules</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{stats?.billsCount || 0}</Text>
                  <Text style={styles.statLbl}>Bills</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ─── Offline Backup & Restore Section ────────────────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Backup & Restore</Text>

          <View style={styles.bentoCard}>
            {/* Export Backup Row */}
            <Pressable
              id="export-backup-btn"
              onPress={handleExport}
              disabled={exporting}
              style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
            >
              <View style={[styles.iconChip, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                <Ionicons name="cloud-upload-outline" size={20} color="#6366F1" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.actionTitle}>Export Offline Backup</Text>
                <Text style={styles.actionSubtext}>Create a portable JSON backup of all financial data</Text>
              </View>
              {exporting ? (
                <ActivityIndicator size="small" color={EthosColors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={EthosColors.outline} />
              )}
            </Pressable>

            <View style={styles.divider} />

            {/* Import Backup Row */}
            <Pressable
              id="import-backup-btn"
              onPress={handlePickFile}
              disabled={restoring}
              style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
            >
              <View style={[styles.iconChip, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Ionicons name="cloud-download-outline" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.actionTitle}>Import Backup File</Text>
                <Text style={styles.actionSubtext}>Restore financial data from a JSON backup file</Text>
              </View>
              {restoring ? (
                <ActivityIndicator size="small" color={EthosColors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={EthosColors.outline} />
              )}
            </Pressable>
          </View>
        </View>

        {/* ─── Danger Zone Section ────────────────────────────────────────── */}
        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionTitle, { color: EthosColors.error }]}>Danger Zone</Text>

          <View style={[styles.bentoCard, { borderColor: 'rgba(186, 26, 26, 0.2)' }]}>
            <Pressable
              id="reset-database-btn"
              onPress={() => setShowResetConfirm(true)}
              style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
            >
              <View style={[styles.iconChip, { backgroundColor: 'rgba(186, 26, 26, 0.12)' }]}>
                <Ionicons name="trash-outline" size={20} color={EthosColors.error} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.actionTitle, { color: EthosColors.error }]}>Reset All Data</Text>
                <Text style={styles.actionSubtext}>Permanently delete all transactions, accounts & bills</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={EthosColors.error} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Import Restore Safety Preview Dialog */}
      {showImportPreview && importSummary && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Import Backup Preview</Text>
            <Text style={styles.modalSubtext}>
              Backup Created: {importSummary.createdAt.split('T')[0]}
            </Text>

            <View style={styles.previewGrid}>
              <Text style={styles.previewRow}>Accounts: {importSummary.accountsCount}</Text>
              <Text style={styles.previewRow}>Transactions: {importSummary.transactionsCount}</Text>
              <Text style={styles.previewRow}>Categories: {importSummary.categoriesCount}</Text>
              <Text style={styles.previewRow}>Budgets: {importSummary.budgetsCount}</Text>
              <Text style={styles.previewRow}>Bills: {importSummary.billsCount}</Text>
              <Text style={styles.previewRow}>Recurring: {importSummary.recurringCount}</Text>
            </View>

            <Text style={styles.warningText}>
              Restoring will replace your current financial data. We recommend creating a backup first.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowImportPreview(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => handleConfirmRestore(true)}
                style={styles.modalBackupBtn}
              >
                <Text style={styles.modalBackupText}>Back Up & Restore</Text>
              </Pressable>

              <Pressable
                onPress={() => handleConfirmRestore(false)}
                style={styles.modalRestoreBtn}
              >
                <Text style={styles.modalRestoreText}>Restore</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Danger Zone Reset Confirmation Dialog */}
      <ConfirmDialog
        visible={showResetConfirm}
        title="Delete All Financial Data?"
        message="This permanently removes transactions, accounts, budgets, bills, and recurring rules. This cannot be undone."
        confirmLabel="DELETE EVERYTHING"
        danger
        onConfirm={handleConfirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    padding:       EthosSpacing.stackMd,
  },
  statBox: {
    width:          '33.33%',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        EthosSpacing.unit,
    gap:            2,
  },
  statVal: {
    ...EthosTypography.headlineLg,
    fontSize:    20,
    fontWeight:  '600',
    color:       EthosColors.primary,
    fontVariant: ['tabular-nums'],
  },
  statLbl: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  actionRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: EthosSpacing.containerPadding,
    paddingVertical:   EthosSpacing.stackMd,
    gap:               EthosSpacing.stackMd,
  },
  rowPressed: {
    backgroundColor: EthosColors.surfaceContainerLow,
  },
  iconChip: {
    width:           40,
    height:          40,
    borderRadius:    EthosRadius.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  actionTitle: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color:      EthosColors.primary,
  },
  actionSubtext: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  divider: {
    height:          EthosBorder.width,
    backgroundColor: EthosBorder.color,
  },
  modalOverlay: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         EthosSpacing.containerPadding,
    zIndex:          1000,
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
    fontSize:   20,
    fontWeight: '600',
    color:      EthosColors.primary,
  },
  modalSubtext: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  previewGrid: {
    backgroundColor: EthosColors.surfaceContainerLow,
    borderRadius:    EthosRadius.md,
    padding:         EthosSpacing.stackMd,
    gap:             6,
  },
  previewRow: {
    ...EthosTypography.bodyMd,
    fontWeight: '500',
    color:      EthosColors.onSurface,
  },
  warningText: {
    ...EthosTypography.labelSm,
    color: EthosColors.outline,
  },
  modalActions: {
    gap: EthosSpacing.unit,
    marginTop: EthosSpacing.stackSm,
  },
  modalCancelBtn: {
    paddingVertical: EthosSpacing.stackSm + 2,
    alignItems:      'center',
  },
  modalCancelText: {
    ...EthosTypography.labelMd,
    color: EthosColors.outline,
  },
  modalBackupBtn: {
    backgroundColor: EthosColors.surfaceContainerHigh,
    borderRadius:    EthosRadius.md,
    paddingVertical: EthosSpacing.stackMd,
    alignItems:      'center',
  },
  modalBackupText: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color:      EthosColors.primary,
  },
  modalRestoreBtn: {
    backgroundColor: EthosColors.primary,
    borderRadius:    EthosRadius.md,
    paddingVertical: EthosSpacing.stackMd,
    alignItems:      'center',
  },
  modalRestoreText: {
    ...EthosTypography.labelMd,
    fontWeight: '600',
    color:      EthosColors.onPrimary,
  },
});

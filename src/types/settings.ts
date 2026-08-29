/**
 * AetherExpense — Settings Types
 */

export type ThemeMode = 'dark' | 'light' | 'system';
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type WeekStart = 'monday' | 'sunday';
export type CurrencyCode = string; // ISO 4217

export interface AppSettings {
  currency:                  CurrencyCode;
  date_format:               DateFormat;
  week_start:                WeekStart;
  theme:                     ThemeMode;
  language:                  string;
  app_lock_enabled:          boolean;
  biometrics_enabled:        boolean;
  auto_lock_seconds:         number;
  daily_reminder_enabled:    boolean;
  daily_reminder_time:       string;  // HH:MM
  budget_warning_enabled:    boolean;
  recurring_reminder_enabled: boolean;
  ai_online_enabled:         boolean;
  db_schema_version:         number;
  onboarding_complete:       boolean;
}

export type SettingsKey = keyof AppSettings;

export const DEFAULT_SETTINGS: AppSettings = {
  currency:                  'INR',
  date_format:               'DD/MM/YYYY',
  week_start:                'monday',
  theme:                     'system',
  language:                  'en',
  app_lock_enabled:          false,
  biometrics_enabled:        false,
  auto_lock_seconds:         30,
  daily_reminder_enabled:    false,
  daily_reminder_time:       '21:00',
  budget_warning_enabled:    true,
  recurring_reminder_enabled: true,
  ai_online_enabled:         false,
  db_schema_version:         1,
  onboarding_complete:       false,
};

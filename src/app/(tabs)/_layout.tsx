/**
 * AetherExpense — Tab Navigator Layout
 * Bottom tab bar matching Stitch ethos finance specs:
 * 5 tabs: Dashboard, Transactions, Reports, Budgets, Settings.
 * Uses safe area insets to prevent collision with Android system navigation bars.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EthosColors, EthosSpacing } from '@/theme/ethos';

type TabRoute = 'index' | 'transactions' | 'reports' | 'budgets' | 'settings';

const TAB_CONFIG: Array<{
  name: TabRoute;
  title: string;
  icon: string;
  iconActive: string;
}> = [
  { name: 'index',        title: 'Home',         icon: 'home-outline',       iconActive: 'home' },
  { name: 'transactions', title: 'Wallet',       icon: 'wallet-outline',     iconActive: 'wallet' },
  { name: 'reports',      title: 'Analytics',    icon: 'stats-chart-outline',iconActive: 'stats-chart' },
  { name: 'budgets',      title: 'Budgets',      icon: 'pie-chart-outline',  iconActive: 'pie-chart' },
  { name: 'settings',     title: 'Settings',     icon: 'settings-outline',   iconActive: 'settings' },
];

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 6);
  const tabBarHeight = (Platform.OS === 'ios' ? 54 : 56) + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: EthosColors.surfaceContainerLowest,
          borderTopColor:  EthosColors.outlineVariant,
          borderTopWidth:  1,
          height:          tabBarHeight,
          paddingBottom:   bottomInset,
          paddingTop:      6,
          elevation:       8,
        },
        tabBarActiveTintColor:   EthosColors.primary,
        tabBarInactiveTintColor: EthosColors.outline,
        tabBarLabelStyle: {
          fontSize:      10,
          fontWeight:    '500',
          marginTop:     2,
        },
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={(focused ? tab.iconActive : tab.icon) as any}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}


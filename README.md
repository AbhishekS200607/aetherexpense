# ✦ AetherExpense — Next-Generation Local Financial Engine

> **100% Offline, Privacy-First Personal Finance & Cashflow Tracking Application**  
> Built with **React Native (Expo 52)**, **Expo Router v4**, **Drizzle ORM**, **Expo SQLite (WAL mode)**, **Zustand**, and **React Native Reanimated**.

---

## 🌟 Key Highlights & Philosophy

- **🔒 100% Local & Privacy-Preserving:** All financial records, transactions, account balances, and security settings are stored locally on your device in an encrypted/isolated SQLite database. Zero cloud tracking, zero external telemetry.
- **⚡ Integer-Based Minor Units Financial Engine:** All monetary values are strictly processed as integer minor units (e.g. Paise for INR) to prevent floating-point rounding errors (`0.1 + 0.2 !== 0.3`).
- **🤖 Aether AI (Offline Local Financial Intelligence):** An integrated offline intelligence engine powered by Drizzle ORM aggregations. Analyzes spending habits, calculates debt positions, recommends 50/30/20 salary budget allocations, and detects overspending without cloud API calls.
- **🛡️ Gatekeeper Security & App Switcher Privacy Shield:**
  - **Cold Start Defense:** Holds Expo's Splash Screen hostage until secure lock status is verified.
  - **App Switcher Defense:** Instantly renders a full-screen `StyleSheet.absoluteFill` Privacy Shield (`zIndex: 99999`) when switching apps or minimizing to block OS task-switcher screenshots.
  - **Reactive RAM-to-Store Gatekeeper:** Globally synchronized Zustand lock state for instant lockout triggers.

---

## 🚀 Core Features Overview

### 1. 💼 Multi-Account & Wallet Management
- Track balances across **Cash Wallets**, **Bank Accounts**, **UPI Wallets**, **Debit Cards**, **Credit Cards**, and **Savings Accounts**.
- Real-time current balance computation:
  $$\text{Current Balance} = \text{Opening Balance} + \text{Income} - \text{Expenses} + \text{Transfers In} - \text{Transfers Out}$$
- Dedicated **"+ Add New Wallet or Account"** action banner and account archivism support.

### 2. 🤝 Dedicated Debt & Loan Tracking (Pending Cashflow IOUs)
Distinct from standard income/expense budgets, this module tracks pending cash flow (receivables vs liabilities):
- **Owed to You (Receivables):** Client invoices, money lent out.
- **You Owe (Liabilities):** Borrowed funds, personal loans.
- **Partial Repayments:** Log partial payments with automatic status transitions (`PENDING` $\rightarrow$ `PARTIAL` $\rightarrow$ `SETTLED`).
- **1-Tap "Mark Paid in Full":** Instantly settle remaining balances with zero friction.
- **Account Synchronization:** Optionally deduct or deposit cash directly into chosen wallet balances upon debt creation or repayment.

### 3. 📸 Smart Receipt Scanning (100% Offline OCR)
- Scan physical paper receipts using device camera or gallery.
- Local OCR engine extracts total merchant amount, date, and line-item notes automatically.

### 4. 🤖 Aether AI — Offline Financial Intelligence
Ask natural language queries locally inside the app:
- *"How much do I owe?"* / *"Who owes me money?"* $\rightarrow$ Computes net debt position & lists active receivables/liabilities.
- *"How should I divide my ₹75,000 salary?"* $\rightarrow$ Generates tailored 50/30/20 & historical spending budget recommendations.
- *"Am I overspending?"* $\rightarrow$ Scans active category budgets against current monthly transactions.

### 5. 🛡️ Security & Privacy
- **Salted SHA-256 PIN Hashing:** Stored securely in `expo-secure-store`.
- **Biometric Authentication:** Native Face ID / Fingerprint with PIN fallback via `expo-local-authentication`.
- **Privacy Mode:** 1-tap toggle to mask sensitive currency numbers across all dashboards (`••••••`).
- **App Switcher Defense:** Blocks system recent-app menu screenshots.

### 6. 📊 Analytics, Reports & Data Export
- Visual category breakdowns, monthly spending trends, and budget progress bars.
- 1-click **SQLite Database JSON Export & Restore** for offline backups.

---

## 📂 Project Architecture & Directory Structure

```
aetherexpense/
├── assets/
│   └── images/                # Brand Assets (Splash screen, full-bleed 1024x1024 launcher icons)
├── src/
│   ├── app/                   # Expo Router v4 File-Based Route Hierarchy
│   │   ├── (tabs)/            # Main Bottom Navigation Tabs (Home, Transactions, Budgets, Reports, Settings)
│   │   ├── accounts/          # Account List, Add Account, Edit Account
│   │   ├── assistant/         # Aether AI Chat Interface
│   │   ├── debts/             # Debts & Loans Dashboard, Add Record, Record Details & Repayments
│   │   ├── scan/              # Smart Receipt Scanner Modal
│   │   ├── settings/          # Security, Data Management, Notifications
│   │   └── _layout.tsx        # Root Navigation Stack & Gatekeeper Security Barrier
│   ├── components/
│   │   ├── ethos/             # Ethos Design System UI Components (MetricCards, TransactionRows)
│   │   ├── security/          # LockScreen Overlay Barrier
│   │   └── ui/                # Base Reusable UI Components (Button, Card, EmptyState, Skeleton)
│   ├── database/
│   │   ├── client.ts          # Drizzle ORM SQLite Database Provider
│   │   ├── schema.ts          # Database Tables (accounts, transactions, categories, debts, budgets, bills)
│   │   └── migrations/        # Automated SQL Schema Migrations (0000..0004)
│   ├── store/
│   │   ├── appStore.ts        # Zustand Global Transient State (isLocked, lockType, dataVersion, dbReady)
│   │   └── settingsStore.ts   # Zustand Settings State (currency, theme, privacyMode)
│   ├── theme/                 # Ethos Design Tokens (Colors, Typography, Spacing, Radius)
│   ├── types/                 # TypeScript Type Definitions
│   └── utils/                 # Utilities (currency.ts, debts.ts, security.ts, financialIntelligence.ts)
├── app.json                   # Expo Native Configuration (Icons, Splash, Android Permissions)
├── eas.json                   # EAS Build Profiles (preview, production-apk)
└── package.json               # Dependencies & Scripts
```

---

## 🛠️ Developer Setup & Commands

### Prerequisites
- **Node.js**: `v18.x` or `v20.x`
- **Expo CLI**: Included via `npx expo`
- **EAS CLI**: Installed globally or executed via `npx eas-cli`

### Installation
```bash
# Clone the repository
git clone https://github.com/AbhishekS200607/aetherexpense.git
cd aetherexpense

# Install dependencies
npm install
```

### Development Server
```bash
# Start Metro bundler with Expo Go or Development Build
npm start
```

### TypeScript Build Check
```bash
# Verify 100% type safety across workspace
npm run type-check
```

---

## 📦 Building & Publishing Releases

### 1. Over-The-Air (OTA) Updates
Publish instant JavaScript bundle updates directly to installed apps:
```bash
eas update --environment production --channel production --message "Production feature update"
```

### 2. Building Final Standalone Android APK
Build a release `.apk` file for direct installation on Android devices:
```bash
eas build --profile production-apk --platform android
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.  
Crafted with precision by **Abhishek** & **AetherStack**.

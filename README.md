# 🌌 AetherExpense — Track. Manage. Grow.

> **100% Offline, Privacy-First Personal Finance & Expense Tracker built for Mobile.**

![AetherExpense Banner](./assets/images/icon.png)

AetherExpense is a modern, high-performance expense manager designed around privacy, financial precision, and effortless UX. Built with **React Native (Expo SDK 57)** and powered by an **offline local SQLite engine**, your financial data stays 100% on your device.

---

## ✨ Features

- 🔒 **100% Offline & Private**: Zero cloud dependencies, zero remote APIs for app logic. All database transactions execute locally in SQLite.
- 💰 **Paise-Level Financial Precision**: All monetary amounts are calculated and stored as Minor Unit Integers (e.g. ₹100.50 is stored as `10050` paise) to prevent floating-point rounding errors.
- 🤖 **AI Assistant**: Smart financial assistant for transaction insights, spending summaries, and budgeting advice.
- 🔔 **Bills & Reminders**: Track upcoming utility bills, subscriptions, EMIs, and rent. Automated local device push notifications remind you before due dates.
- 🔁 **Recurring Rules Engine**: Automated management of daily, weekly, monthly, and yearly recurring expenses and income.
- 📊 **Interactive Analytics**: Visual charts, category breakdowns, monthly trends, and budget progress meters.
- 📷 **Receipt OCR & Attachment**: Capture or upload receipt photos directly linked to transactions.
- 💳 **Multi-Account & Wallet Support**: Manage Cash, Savings Accounts, Credit Cards, and UPI Wallets seamlessly.

---

## 🛠️ Tech Stack

- **Framework**: [Expo SDK 57](https://docs.expo.dev/) (React Native, React 18, React Compiler)
- **Navigation**: [Expo Router v4](https://docs.expo.dev/router/introduction/) (File-based routing)
- **Database & ORM**: `expo-sqlite` + [Drizzle ORM](https://orm.drizzle.team/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **UI & Animations**: React Native Reanimated, Expo Vector Icons, Safe Area Context
- **Notifications**: `expo-notifications` (Android Channels & iOS Triggered Reminders)
- **Build System**: EAS Build & EAS Update (Over-the-Air OTA updates)

---

## 🚀 Getting Started

### Prerequisites

- Node.js `v18+` or `v20+`
- npm or yarn
- Expo Go app on mobile or Android Studio / Xcode emulator

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AbhishekS200607/aetherexpense.git
   cd aetherexpense
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npx expo start
   ```

---

## 📱 Building & Deploying

### OTA Updates (Over-The-Air)
Deploy instant updates to installed Android devices:
```bash
eas update --platform android --branch preview --message "Fixed bills and UI enhancements"
```

### Standalone Android APK Build
Build a standalone `.apk` for direct installation on Android devices:
```bash
eas build --platform android --profile preview
```

---

## 📁 Architecture Overview

```
aetherexpense/
├── assets/images/       # App logo, adaptive icons, and splash screens
├── src/
│   ├── app/             # Expo Router screens (Tabs, Bills, Assistant, Recurring)
│   ├── components/      # UI components (Cards, Animations, Dialogs)
│   ├── database/        # Drizzle ORM schema, migrations, and SQLite client
│   ├── store/           # Zustand global state management
│   ├── theme/           # Ethos design system, tokens, and typography
│   └── utils/           # Currency, date, UUID, and notification helpers
├── app.json             # Expo configuration & native permissions
└── eas.json             # EAS Build & Update profiles
```

---

## 📄 License

This project is open-source under the MIT License.

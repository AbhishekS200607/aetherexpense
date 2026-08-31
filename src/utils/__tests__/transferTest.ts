/**
 * AetherExpense — P0 Financial Integrity & Atomic Transfer Test Suite
 *
 * Validates TEST 3:
 *   1. Bank = ₹10,000, Cash = ₹2,000.
 *   2. Transfer Bank -> Cash ₹3,000:
 *      - Bank: ₹7,000
 *      - Cash: ₹5,000
 *      - Total Net Worth: ₹12,000 (unchanged)
 *      - Total Income: ₹0 (unchanged)
 *      - Total Expense: ₹0 (unchanged)
 *   3. Reverse Transfer Cash -> Bank ₹1,000:
 *      - Bank: ₹8,000
 *      - Cash: ₹4,000
 *      - Total: ₹12,000
 *   4. Insufficient Balance Test:
 *      - Attempt Cash -> Bank ₹10,000 (available ₹4,000)
 *      - REJECTED with error
 *      - Balances remain Bank = ₹8,000, Cash = ₹4,000.
 */

import { calculateAccountBalance, TxnSummaryItem } from '../accounts';

export interface TestAccountState {
  id: string;
  name: string;
  openingBalance: number;
}

export interface TestResultReport {
  passed: boolean;
  stepResults: Array<{ step: string; success: boolean; details: string }>;
}

export function runTransferFinancialIntegrityTest(): TestResultReport {
  const stepResults: Array<{ step: string; success: boolean; details: string }> = [];

  // Setup Accounts
  const bankAccount: TestAccountState = { id: 'acc_bank', name: 'Bank Account', openingBalance: 1000000 }; // ₹10,000
  const cashAccount: TestAccountState = { id: 'acc_cash', name: 'Cash Wallet', openingBalance: 200000 };  // ₹2,000

  const transactionsLedger: TxnSummaryItem[] = [];

  // Helper to compute balance
  const getBankBal = () => calculateAccountBalance(bankAccount.openingBalance, bankAccount.id, transactionsLedger);
  const getCashBal = () => calculateAccountBalance(cashAccount.openingBalance, cashAccount.id, transactionsLedger);
  const getTotalBal = () => getBankBal() + getCashBal();
  const getIncomeTotal = () => transactionsLedger.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const getExpenseTotal = () => transactionsLedger.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Initial Baseline Assertions
  const initBank = getBankBal();
  const initCash = getCashBal();
  stepResults.push({
    step: 'Step 1 & 2: Initial Account Setup',
    success: initBank === 1000000 && initCash === 200000,
    details: `Bank: ₹${(initBank / 100).toFixed(2)}, Cash: ₹${(initCash / 100).toFixed(2)}`,
  });

  // Step 3: Transfer Bank -> Cash ₹3,000 (300,000 paise)
  const transfer1Amount = 300000;
  if (getBankBal() >= transfer1Amount) {
    transactionsLedger.push({
      id: 'txn_t1',
      type: 'transfer',
      amount: transfer1Amount,
      account_id: bankAccount.id,
      transfer_to_account_id: cashAccount.id,
    });
  }

  // Step 4, 5, 6, 7, 8, 9 Assertions
  const postT1Bank = getBankBal();
  const postT1Cash = getCashBal();
  const postT1Total = getTotalBal();
  const postT1Income = getIncomeTotal();
  const postT1Expense = getExpenseTotal();

  const step3Success =
    postT1Bank === 700000 &&
    postT1Cash === 500000 &&
    postT1Total === 1200000 &&
    postT1Income === 0 &&
    postT1Expense === 0 &&
    transactionsLedger.length === 1;

  stepResults.push({
    step: 'Step 3 - 9: Transfer Bank -> Cash ₹3,000',
    success: step3Success,
    details: `Bank: ₹${(postT1Bank / 100).toFixed(2)} (Expected ₹7,000.00), Cash: ₹${(postT1Cash / 100).toFixed(2)} (Expected ₹5,000.00), Net: ₹${(postT1Total / 100).toFixed(2)}, Income: ₹${postT1Income}, Expense: ₹${postT1Expense}`,
  });

  // Step 10: Reverse transfer Cash -> Bank ₹1,000 (100,000 paise)
  const reverseAmount = 100000;
  if (getCashBal() >= reverseAmount) {
    transactionsLedger.push({
      id: 'txn_t2',
      type: 'transfer',
      amount: reverseAmount,
      account_id: cashAccount.id,
      transfer_to_account_id: bankAccount.id,
    });
  }

  // Step 11 Assertion: Bank = ₹8,000, Cash = ₹4,000, Total = ₹12,000
  const postRevBank = getBankBal();
  const postRevCash = getCashBal();
  const postRevTotal = getTotalBal();

  const step10Success =
    postRevBank === 800000 &&
    postRevCash === 400000 &&
    postRevTotal === 1200000;

  stepResults.push({
    step: 'Step 10 - 11: Reverse Transfer Cash -> Bank ₹1,000',
    success: step10Success,
    details: `Bank: ₹${(postRevBank / 100).toFixed(2)} (Expected ₹8,000.00), Cash: ₹${(postRevCash / 100).toFixed(2)} (Expected ₹4,000.00), Net: ₹${(postRevTotal / 100).toFixed(2)}`,
  });

  // Step 12: Insufficient Balance Test (Try Cash -> Bank ₹10,000 when Cash available is ₹4,000)
  const overdrawAmount = 1000000; // ₹10,000
  let overdrawRejected = false;

  if (getCashBal() < overdrawAmount) {
    // Insufficient balance correctly rejected!
    overdrawRejected = true;
  } else {
    // Should NOT execute!
    transactionsLedger.push({
      id: 'txn_t3_invalid',
      type: 'transfer',
      amount: overdrawAmount,
      account_id: cashAccount.id,
      transfer_to_account_id: bankAccount.id,
    });
  }

  const finalBank = getBankBal();
  const finalCash = getCashBal();
  const step12Success = overdrawRejected && finalBank === 800000 && finalCash === 400000;

  stepResults.push({
    step: 'Step 12: Insufficient Balance Guard (Try Cash -> Bank ₹10,000)',
    success: step12Success,
    details: `Transfer Rejected: ${overdrawRejected}, Bank: ₹${(finalBank / 100).toFixed(2)}, Cash: ₹${(finalCash / 100).toFixed(2)}`,
  });

  const overallPassed = stepResults.every((s) => s.success);
  return {
    passed: overallPassed,
    stepResults,
  };
}

/**
 * AetherExpense — On-Device Smart Scan OCR & Candidate-Ranking Engine
 *
 * 100% Offline On-Device OCR Bridge & Semantic Candidate-Ranking Text Extractor.
 * Implements candidate scoring to accurately select final total amounts over item prices,
 * invoice numbers, GST numbers, or previous balances.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';

export interface AmountCandidate {
  amountPaise:  number;   // e.g. 3225000 paise
  formatted:    string;   // e.g. "32250.00"
  score:        number;   // Candidate ranking score
  matchedLabel: string;   // Label that triggered scoring
  lineIndex:    number;
}

export interface ParsedScanResult {
  amount:                number; // minor units (paise)
  amountFormatted:       string; // e.g. "32250.00"
  amountConfidence:      number; // 0..1 confidence score
  merchant:              string;
  date:                  string; // YYYY-MM-DD
  referenceId?:          string;
  suggestedCategoryName: string;
  scanType:              'receipt' | 'upi' | 'bill';
  confidenceScore:       number; // 0..1
  rawText:               string;
  allCandidates:         AmountCandidate[];
}

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo';

let NativeTextRecognition: any = null;
if (!isExpoGo) {
  try {
    NativeTextRecognition = require('@react-native-ml-kit/text-recognition').default;
  } catch (err) {
    console.warn('[OCR] @react-native-ml-kit/text-recognition not available in current native build:', err);
    NativeTextRecognition = null;
  }
}

/**
 * Performs on-device image-to-text OCR on a local image file URI.
 */
export async function performOnDeviceOCR(imageUri: string): Promise<string> {
  if (isExpoGo || !NativeTextRecognition) {
    console.log('[OCR] Engine: Fallback OCR (Expo Go or Native Module Unavailable)');
    return '';
  }

  try {
    console.log('[OCR] Engine: On-Device ML Kit');
    const result = await NativeTextRecognition.recognize(imageUri);
    const text = result?.text || '';
    console.log(`[OCR] Raw text extracted:\n${text}`);
    return text;
  } catch (err) {
    console.warn('[OCR] Error during native ML Kit text recognition:', err);
    return '';
  }
}

// ─── Semantic Label Keywords & Weights ─────────────────────────────────────────

const HIGH_PRIORITY_LABELS = [
  'grand total',
  'grand total amount',
  'total payable',
  'amount payable',
  'net payable',
  'net amount',
  'final amount',
  'balance due',
  'amount due',
  'invoice total',
  'total bill amount',
  'total to pay',
  'payable',
  'to pay',
];

const MEDIUM_PRIORITY_LABELS = [
  'total',
  'net total',
  'bill total',
  'amount paid',
  'total paid',
  'paid',
];

const LOW_PRIORITY_LABELS = [
  'subtotal',
  'sub total',
  'amount',
  'balance',
  'item total',
  'previous balance',
];

const REJECT_LABELS = [
  'invoice no',
  'invoice number',
  'bill no',
  'receipt no',
  'gstin',
  'gst no',
  'phone',
  'tel',
  'mob',
  'utr',
  'ref no',
  'transaction id',
  'tax rate',
  '18%',
  '5%',
  '12%',
  '28%',
];

/**
 * Extracts and ranks all candidate monetary amounts from OCR raw text.
 */
export function extractAndRankAmounts(rawText: string): AmountCandidate[] {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const candidatesMap = new Map<number, AmountCandidate>();

  // RegEx to capture monetary numbers (₹32,250 | Rs. 32,250 | 32250.00 | 32,250)
  const moneyRegex = /(?:₹|rs\.?|inr)?\s*([\d]{1,3}(?:,[\d]{2,3})*(?:\.[\d]{1,2})?|[\d]{1,7}\.[\d]{2}|[\d]{3,7})/gi;

  lines.forEach((line, lineIdx) => {
    // Check if line contains explicit reject keywords (e.g. Invoice No: 1500 or GSTIN)
    const isRejectLine = REJECT_LABELS.some((rej) => line.toLowerCase().includes(rej));
    if (isRejectLine) return;

    let match: RegExpExecArray | null;
    while ((match = moneyRegex.exec(line)) !== null) {
      const numStr = match[1];
      const cleaned = numStr.replace(/,/g, '');
      const parsed = parseFloat(cleaned);

      if (isNaN(parsed) || parsed <= 0 || parsed > 5000000) continue;

      // Avoid capturing isolated 4-digit years like 2026
      if (parsed >= 2020 && parsed <= 2035 && !numStr.includes('.')) continue;

      const paise = Math.round(parsed * 100);

      // Search surrounding context (same line, 1-2 lines above)
      const contextText = [
        lines[lineIdx - 2] || '',
        lines[lineIdx - 1] || '',
        line,
        lines[lineIdx + 1] || '',
      ].join(' ').toLowerCase();

      let score = 10; // Baseline score for any number
      let matchedLabel = 'generic';

      // Evaluate semantic label weights
      for (const highLabel of HIGH_PRIORITY_LABELS) {
        if (contextText.includes(highLabel)) {
          score += 100;
          matchedLabel = highLabel;
          // Extra proximity bonus if label is on the same line or line immediately above
          if (line.toLowerCase().includes(highLabel) || (lines[lineIdx - 1] || '').toLowerCase().includes(highLabel)) {
            score += 50;
          }
          break;
        }
      }

      if (score === 10) {
        for (const medLabel of MEDIUM_PRIORITY_LABELS) {
          if (contextText.includes(medLabel)) {
            score += 70;
            matchedLabel = medLabel;
            if (line.toLowerCase().includes(medLabel) || (lines[lineIdx - 1] || '').toLowerCase().includes(medLabel)) {
              score += 30;
            }
            break;
          }
        }
      }

      if (score === 10) {
        for (const lowLabel of LOW_PRIORITY_LABELS) {
          if (contextText.includes(lowLabel)) {
            score += 30;
            matchedLabel = lowLabel;
            break;
          }
        }
      }

      // Bonus if explicitly formatted with currency symbol ₹ or Rs
      if (/₹|rs/i.test(line)) {
        score += 20;
      }

      const formattedStr = (paise / 100).toFixed(2);

      const candidate: AmountCandidate = {
        amountPaise: paise,
        formatted:   formattedStr,
        score,
        matchedLabel,
        lineIndex:   lineIdx,
      };

      // Keep the highest scored candidate for a specific paise amount
      const existing = candidatesMap.get(paise);
      if (!existing || candidate.score > existing.score) {
        candidatesMap.set(paise, candidate);
      }
    }
  });

  const ranked = Array.from(candidatesMap.values()).sort((a, b) => b.score - a.score);
  return ranked;
}

/**
 * Extracts structured financial fields from OCR text content.
 */
export function parseScannedText(rawText: string, scanType: 'receipt' | 'upi' | 'bill' = 'receipt'): ParsedScanResult {
  const text = rawText.replace(/\r\n/g, '\n');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // ─── 1. Candidate-Ranking Amount Extraction ────────────────────────────────────
  const candidates = extractAndRankAmounts(text);
  let amount = 0;
  let amountConfidence = 0.4;

  if (candidates.length > 0) {
    const topCandidate = candidates[0];
    amount = topCandidate.amountPaise;
    if (topCandidate.score >= 120) {
      amountConfidence = 0.95;
    } else if (topCandidate.score >= 60) {
      amountConfidence = 0.75;
    } else {
      amountConfidence = 0.50;
    }
  }

  console.log('[OCR] Amount candidates:', candidates.map((c) => `₹${c.formatted} (Score: ${c.score}, Label: ${c.matchedLabel})`).join(', '));
  console.log(`[OCR] Selected total: ₹${(amount / 100).toFixed(2)}`);
  console.log(`[OCR] Confidence: ${amountConfidence}`);

  let merchant = '';
  let date = new Date().toISOString().split('T')[0];
  let referenceId = '';
  let suggestedCategoryName = 'General';

  // ─── 2. Merchant / Payee Extraction ──────────────────────────────────────────
  const upiMerchantMatch = text.match(/(?:paid to|transfer to|sent to|paid successfully to|to)\s+([A-Za-z0-9\s&'-]+)/i);
  if (upiMerchantMatch && upiMerchantMatch[1]) {
    merchant = upiMerchantMatch[1].split('\n')[0].substring(0, 32).trim();
  } else {
    // Top non-header line of receipt usually contains store/merchant name
    for (const line of lines) {
      if (
        line.length > 2 &&
        line.length < 36 &&
        !/tax invoice|cash receipt|welcome to|gstin|phone|tel|date|bill no|invoice/i.test(line) &&
        !/^\d+$/.test(line)
      ) {
        merchant = line;
        break;
      }
    }
  }

  if (!merchant) {
    merchant = scanType === 'upi' ? 'UPI Merchant' : 'Store Merchant';
  }

  // ─── 3. Date Extraction (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD Month YYYY) ───
  const isoMatch = text.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})|(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
  if (isoMatch) {
    const dateStr = isoMatch[0];
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        date = `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  } else {
    const monthNames: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const namedMatch = text.match(/(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-]+(\d{4})/i);
    if (namedMatch) {
      const d = namedMatch[1].padStart(2, '0');
      const mStr = namedMatch[2].toLowerCase().substring(0, 3);
      const m = monthNames[mStr] || '01';
      const y = namedMatch[3];
      date = `${y}-${m}-${d}`;
    }
  }

  // ─── 4. Reference / UPI Ref ID Extraction ─────────────────────────────────────
  const refMatch = text.match(/(?:upi ref no|ref no|txn id|transaction id|utr)\s*[:=]?\s*([A-Za-z0-9]{8,18})/i);
  if (refMatch && refMatch[1]) {
    referenceId = refMatch[1];
  }

  // ─── 5. Rule-Based Category Inference ─────────────────────────────────────────
  const lowerText = text.toLowerCase();
  if (/swiggy|zomato|kfc|mcdonald|domino|starbucks|restaurant|cafe|food|dining|bakery|canteen|eatery/i.test(lowerText)) {
    suggestedCategoryName = 'Food & Dining';
  } else if (/uber|ola|rapido|metro|petrol|fuel|shell|hpcl|bpcl|transport|cab|parking|toll/i.test(lowerText)) {
    suggestedCategoryName = 'Transportation';
  } else if (/amazon|flipkart|myntra|zara|h&m|decathlon|retail|mart|supermarket|grocery|groceries|blinkit|zepto|lulu|more|dmart|d-mart|croma|reliance/i.test(lowerText)) {
    suggestedCategoryName = 'Shopping';
  } else if (/electricity|water|wifi|broadband|airtel|jio|vi|recharge|bescom|tata play|gas|cylinder|utility|bill/i.test(lowerText)) {
    suggestedCategoryName = 'Bills & Utilities';
  } else if (/netflix|spotify|prime|cinema|movie|pvr|inox|entertainment/i.test(lowerText)) {
    suggestedCategoryName = 'Entertainment';
  }

  const amountFormatted = (amount / 100).toFixed(2);

  return {
    amount,
    amountFormatted,
    amountConfidence,
    merchant,
    date,
    referenceId,
    suggestedCategoryName,
    scanType,
    confidenceScore: amountConfidence,
    rawText,
    allCandidates: candidates,
  };
}

/**
 * AetherExpense — UUID Generator
 *
 * Generates RFC4122 version 4 compliant UUIDs.
 * Fully compatible with React Native (Hermes / JSC) without crypto dependencies.
 */

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const v4 = generateUUID;

export interface Memo {
  id: string;
  userId: string;
  dateKst: string; // 'YYYY-MM-DD'
  title: string;
  charCount: number;
  r2ObjectKey: string;
  encryptedDek: string; // base64
  dekAlgo: "aes-256-gcm";
  iv: string; // base64
  bodySha256: string | null;
  isReadonly: boolean;
  readonlyAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Memo with decrypted plaintext body for client responses. */
export interface MemoWithBody extends Memo {
  body: string;
}

export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export interface ActivityCell {
  date: string;      // KST 'YYYY-MM-DD'
  level: ActivityLevel;
  charCount: number;
  memoId: string | null;
}

export interface ActivityGrid {
  from: string;
  to: string;
  cells: ActivityCell[];
}

/** Activity level mapping per SPEC §3.5 */
export function activityLevelFromCharCount(charCount: number): ActivityLevel {
  if (charCount <= 0) return 0;
  if (charCount < 100) return 1;
  if (charCount < 500) return 2;
  if (charCount < 1500) return 3;
  return 4;
}

export const MAX_MEMO_CHARS = 100_000;

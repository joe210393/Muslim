/** 立約方甲方欄位內大小章預設位置（百分比）。 */
export const DEFAULT_SEAL_LAYOUT = {
  companySealX: 8,
  companySealY: 4,
  personSealX: 42,
  personSealY: 14,
} as const;

export type SealLayout = {
  companySealX: number;
  companySealY: number;
  personSealX: number;
  personSealY: number;
};

export function normalizeSealLayout(input?: Partial<SealLayout> | null): SealLayout {
  const clamp = (value: unknown, fallback: number) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(100, Math.max(0, n));
  };
  return {
    companySealX: clamp(input?.companySealX, DEFAULT_SEAL_LAYOUT.companySealX),
    companySealY: clamp(input?.companySealY, DEFAULT_SEAL_LAYOUT.companySealY),
    personSealX: clamp(input?.personSealX, DEFAULT_SEAL_LAYOUT.personSealX),
    personSealY: clamp(input?.personSealY, DEFAULT_SEAL_LAYOUT.personSealY),
  };
}

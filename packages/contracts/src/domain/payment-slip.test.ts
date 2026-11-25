import { describe, expect, it } from "vitest";
import { paymentReviewSchema } from "../schemas/payments";
import { isPaymentOverdue, paymentDueAt, remittanceSlipNo } from "./payments";

describe("匯款單期限", () => {
  it("核准當天起算，截止於台北第 N 天 23:59:59", () => {
    const approvedAt = new Date("2026-11-25T02:00:00Z");
    expect(paymentDueAt(14, approvedAt).toISOString()).toBe("2026-12-09T15:59:59.000Z");
  });

  it("台北已跨日時以台北日期起算", () => {
    const approvedAt = new Date("2026-11-25T17:30:00Z");
    expect(paymentDueAt(1, approvedAt).toISOString()).toBe("2026-11-27T15:59:59.000Z");
  });

  it("只有未付款且超過期限才算逾期", () => {
    const due = "2026-12-09T15:59:59.000Z";
    expect(isPaymentOverdue("PENDING", due, new Date("2026-12-09T15:59:58Z"))).toBe(false);
    expect(isPaymentOverdue("PENDING", due, new Date("2026-12-09T16:00:00Z"))).toBe(true);
    expect(isPaymentOverdue("PAID_PENDING", due, new Date("2027-01-01T00:00:00Z"))).toBe(false);
    expect(isPaymentOverdue("PENDING", null)).toBe(false);
  });

  it("匯款單號不超過 20 碼", () => {
    const no = remittanceSlipNo(new Date("2026-11-25T02:00:00Z"), "abc123def");
    expect(no).toBe("MF20261125ABC123");
    expect(no.length).toBeLessThanOrEqual(20);
  });
});

describe("付款處理輸入", () => {
  const paymentId = "11111111-1111-4111-8111-111111111111";

  it("核准不必填原因", () => {
    expect(paymentReviewSchema.safeParse({ paymentId, expectedStatus: "QUOTED", decision: "APPROVE_QUOTE" }).success).toBe(true);
  });

  it("不核准、退回、未成立都要填原因", () => {
    for (const decision of ["REJECT_QUOTE", "RETURN_RECEIPT", "VOID"] as const) {
      expect(paymentReviewSchema.safeParse({ paymentId, expectedStatus: "QUOTED", decision, note: " " }).success).toBe(false);
    }
  });
});

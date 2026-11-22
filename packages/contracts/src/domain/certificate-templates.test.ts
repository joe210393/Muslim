import { describe, expect, it } from "vitest";
import { matchCertificateTemplates } from "./certificate-templates";

describe("matchCertificateTemplates", () => {
  it("maps restaurant apply types", () => {
    expect(matchCertificateTemplates({ categoryCode: "CAT_01", applyType: "halal_kitchen" }).map((item) => item.key)).toEqual([
      "HALAL_KITCHEN",
    ]);
    expect(matchCertificateTemplates({ categoryCode: "CAT_01", applyType: "halal_restaurant" }).map((item) => item.key)).toEqual([
      "HALAL_RESTAURANT",
    ]);
  });

  it("can issue both MFR meal and drink snack certificates", () => {
    const keys = matchCertificateTemplates({
      categoryCode: "CAT_01",
      applyType: "friendly_restaurant",
      mealLunch: true,
      mealDrink: true,
    }).map((item) => item.key);
    expect(keys).toEqual(["MFR_MEAL", "MFR_DRINK_SNACK"]);
  });

  it("maps lodging and single-category templates", () => {
    expect(matchCertificateTemplates({ categoryCode: "CAT_03", applyType: "with_breakfast" })[0]?.key).toBe("MFA_WITH_BREAKFAST");
    expect(matchCertificateTemplates({ categoryCode: "CAT_04" })[0]?.key).toBe("MFS_STORE");
    expect(matchCertificateTemplates({ categoryCode: "CAT_02" })[0]?.key).toBe("HALAL_PRODUCT");
  });
});

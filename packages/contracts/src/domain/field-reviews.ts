import { z } from "zod";
import { ApplicationAction } from "@mf/db/enums";
import type { CategoryDefinition, CategoryField } from "./category-definition";

export const fieldReviewSchema = z.object({
  key: z.string().trim().min(1).max(80),
  needsSupplement: z.boolean(),
  publicComment: z.string().trim().max(500).default(""),
  internalNote: z.string().trim().max(500).default(""),
});

export type FieldReview = z.infer<typeof fieldReviewSchema>;

export const fieldReviewsSchema = z.array(fieldReviewSchema).max(80);

const CONTACT_FIELDS = [
  { key: "organizationName", label: "業者名稱" },
  { key: "taxId", label: "統一編號" },
  { key: "contactName", label: "聯絡人" },
  { key: "contactPhone", label: "電話" },
  { key: "contactEmail", label: "Email" },
  { key: "organizationAddress", label: "地址" },
] as const;

const CERTIFICATE_NAME_EN = "certificateNameEn";
const CERTIFICATE_ADDRESS_EN = "certificateAddressEn";

export function splitCertificateFields(fields: CategoryField[]) {
  return {
    nameEn: fields.find((field) => field.key === CERTIFICATE_NAME_EN),
    addressEn: fields.find((field) => field.key === CERTIFICATE_ADDRESS_EN),
    rest: fields.filter((field) => field.key !== CERTIFICATE_NAME_EN && field.key !== CERTIFICATE_ADDRESS_EN),
  };
}

export function attachmentReviewKey(requirementKey: string) {
  return `attachment:${requirementKey}`;
}

export type ReviewTarget = { key: string; label: string; section: string };

export function reviewTargets(definition: CategoryDefinition): ReviewTarget[] {
  const certificate = splitCertificateFields(definition.fields);
  return [
    { key: "category", label: "申請類別", section: "申請類別" },
    ...CONTACT_FIELDS.map((field) => ({ ...field, section: "業者與聯絡資料" })),
    { key: "siteName", label: "單位名稱（中文）", section: "申請內容" },
    ...(certificate.nameEn ? [{ key: certificate.nameEn.key, label: certificate.nameEn.label, section: "申請內容" }] : []),
    { key: "siteAddress", label: "單位地址（中文）", section: "申請內容" },
    ...(certificate.addressEn ? [{ key: certificate.addressEn.key, label: certificate.addressEn.label, section: "申請內容" }] : []),
    { key: "applicationDescription", label: "申請說明", section: "申請內容" },
    ...certificate.rest.map((field) => ({ key: field.key, label: field.label, section: "申請內容" })),
    ...definition.attachmentRequirements
      .filter((item) => item.group !== "checklist")
      .map((item) => ({ key: attachmentReviewKey(item.key), label: item.label, section: "附件資料" })),
    { key: "declarationAccepted", label: "資料聲明", section: "確認送件" },
  ];
}

export function supplementPublicComment(targets: ReviewTarget[], reviews: FieldReview[]) {
  const labels = new Map(targets.map((item) => [item.key, item.label]));
  return reviews
    .filter((item) => item.needsSupplement)
    .map((item) => `${labels.get(item.key) ?? item.key}：${item.publicComment}`)
    .join("\n")
    .slice(0, 2000);
}

export function checkFieldReviews(action: ApplicationAction, targets: ReviewTarget[], reviews: FieldReview[]): { ok: true; publicComment: string | null } | { ok: false; message: string } {
  const allowed = new Set(targets.map((item) => item.key));
  if (reviews.some((item) => !allowed.has(item.key))) return { ok: false, message: "有不屬於這份表單的審查項目" };
  if (action !== ApplicationAction.REQUEST_SUPPLEMENT) return { ok: true, publicComment: null };
  const picked = reviews.filter((item) => item.needsSupplement);
  if (picked.length === 0) return { ok: false, message: "請勾選要補件的項目" };
  if (picked.some((item) => !item.publicComment)) return { ok: false, message: "勾選補件的項目都要填公開意見" };
  return { ok: true, publicComment: supplementPublicComment(targets, reviews) };
}

import { z } from "zod";
import { parseReportFieldId, REPORT_SOURCES, unknownReportFields, type ReportSource } from "../domain/report-fields";

const sourceKeys = REPORT_SOURCES.map((item) => item.key) as [ReportSource, ...ReportSource[]];

export const reportSourceSchema = z.enum(sourceKeys);
export const reportChartKindSchema = z.enum(["table", "bar", "pie"]);

export const reportSelectionSchema = z.object({
  source: reportSourceSchema,
  fieldKeys: z.array(z.string().trim().min(1).max(64)).min(1).max(40),
});

export const reportSelectionsSchema = z.array(reportSelectionSchema).min(1).max(4).superRefine((selections, ctx) => {
  if (new Set(selections.map((item) => item.source)).size !== selections.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "同一個資料來源只能選一次" });
  }
  selections.forEach((selection, index) => {
    if (unknownReportFields(selection.source, selection.fieldKeys).length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "fieldKeys"], message: "有欄位不在這個資料來源裡" });
    }
    if (new Set(selection.fieldKeys).size !== selection.fieldKeys.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "fieldKeys"], message: "欄位不可重複" });
    }
  });
});

export const savedReportSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  selections: reportSelectionsSchema,
  chartKind: reportChartKindSchema,
  chartField: z.string(),
  version: z.number().int(),
  updatedAt: z.string().datetime(),
});

export const savedReportWriteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  selections: reportSelectionsSchema,
  chartKind: reportChartKindSchema.default("table"),
  chartField: z.string().trim().max(80).default(""),
  expectedVersion: z.number().int().positive().optional(),
}).superRefine((value, ctx) => {
  if (!value.chartField) return;
  const parsed = parseReportFieldId(value.chartField);
  const selection = parsed ? value.selections.find((item) => item.source === parsed.source) : undefined;
  if (!parsed || !selection?.fieldKeys.includes(parsed.key)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["chartField"], message: "統計欄位必須是已勾選的欄位" });
  }
});

export const reportPreviewRequestSchema = z.object({
  selections: reportSelectionsSchema,
});

export const reportPreviewSchema = z.object({
  sections: z.array(z.object({
    source: reportSourceSchema,
    label: z.string(),
    columns: z.array(z.object({ key: z.string(), label: z.string() })),
    rows: z.array(z.record(z.string())),
    total: z.number().int(),
    groups: z.array(z.object({
      fieldKey: z.string(),
      label: z.string(),
      points: z.array(z.object({ label: z.string(), count: z.number().int() })),
    })),
  })),
});

export type SavedReport = z.infer<typeof savedReportSchema>;
export type SavedReportWrite = z.infer<typeof savedReportWriteSchema>;
export type ReportPreview = z.infer<typeof reportPreviewSchema>;

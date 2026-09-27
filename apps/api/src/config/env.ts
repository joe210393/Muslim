import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
dotenv.config({ path: path.join(root, ".env") });

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(16),
    APP_BASE_URL: z.string().url(),
    STORAGE_DRIVER: z.string().default("local"),
    UPLOAD_ROOT: z.string().min(1).default("./uploads"),
    MAIL_DRIVER: z.enum(["console", "smtp"]).default("console"),
    SMTP_HOST: z.string().optional().default(""),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional().default(""),
    SMTP_PASSWORD: z.string().optional().default(""),
    MAIL_FROM: z.string().min(3).default("noreply@example.test"),
    DEMO_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    WEB_DEV_ORIGIN: z.string().optional().default("http://127.0.0.1:5173"),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER !== "local") {
      ctx.addIssue({ code: "custom", message: "目前只實作 local 儲存驅動，其他驅動會拒絕啟動" });
    }
    if (value.APP_ENV === "production" && value.DEMO_MODE) {
      ctx.addIssue({ code: "custom", message: "production 不可啟用 DEMO_MODE" });
    }
    if (value.APP_ENV === "production" && value.MAIL_DRIVER === "console") {
      ctx.addIssue({ code: "custom", message: "production 不可使用 console 郵件驅動" });
    }
    if (value.APP_ENV === "production" && value.SESSION_SECRET.length < 32) {
      ctx.addIssue({ code: "custom", message: "production 的 SESSION_SECRET 至少 32 字元" });
    }
    if (value.MAIL_DRIVER === "smtp" && !value.SMTP_HOST) {
      ctx.addIssue({ code: "custom", message: "SMTP 模式需要 SMTP_HOST" });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function repoRoot(): string {
  return root;
}

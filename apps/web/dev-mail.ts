import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

type MailMessage = { to?: string; subject?: string; text?: string };
type Mailer = {
  createTransport: (options: { host: string; port: number; secure: boolean; auth?: { user: string; pass: string } }) => {
    sendMail: (message: { from: string; to: string; subject: string; text: string }) => Promise<unknown>;
  };
};

const require = createRequire(import.meta.url);
const nodemailer = require("../api/node_modules/nodemailer") as Mailer;
const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env");

function mailConfig() {
  const values: Record<string, string> = {};
  try {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      values[trimmed.slice(0, index)] = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* 沒有 .env 時沿用環境變數 */
  }
  const host = values.SMTP_HOST || process.env.SMTP_HOST || "127.0.0.1";
  const port = Number(values.SMTP_PORT || process.env.SMTP_PORT || 1025);
  const user = values.SMTP_USER || process.env.SMTP_USER || "";
  const pass = (values.SMTP_PASSWORD || process.env.SMTP_PASSWORD || "").replace(/\s+/g, "");
  const from = values.MAIL_FROM || process.env.MAIL_FROM || "noreply@localhost";
  const local = host === "127.0.0.1" || host === "localhost";
  return { host, port, user, pass, from, local };
}

async function sendOne(message: { to: string; subject: string; text: string }, config: ReturnType<typeof mailConfig>) {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  await transport.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}

export function devMailPlugin(): Plugin {
  return {
    name: "dev-mail",
    configureServer(server) {
      server.middlewares.use("/dev-mail", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => {
          void (async () => {
            try {
              const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { messages?: MailMessage[] };
              const messages = (payload.messages ?? []).filter((item): item is { to: string; subject: string; text: string } => Boolean(item.to && item.subject && item.text && !/[\r\n]/.test(item.to)));
              if (!messages.length) throw new Error("empty");
              const config = mailConfig();
              for (const message of messages) await sendOne(message, config);
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ ok: true, local: config.local }));
            } catch {
              res.statusCode = 502;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ ok: false }));
            }
          })();
        });
      });
    },
  };
}

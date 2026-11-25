import path from "node:path";
import express from "express";
import { getEnv } from "./config/env";
import { createApp } from "./app";
import { repoRoot } from "./config/env";
import { expireOverduePayments } from "./modules/payments/service";

const env = getEnv();
const app = createApp();
const webDist = path.resolve(repoRoot(), "apps/web/dist");

if (env.NODE_ENV === "production") {
  app.use(express.static(webDist, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/") || req.path.startsWith("/health/")) return next();
    res.sendFile(path.join(webDist, "index.html"), (error) => {
      if (error) next();
    });
  });
}

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.info(`API listening on 0.0.0.0:${env.PORT} (${env.APP_ENV}, demo=${env.DEMO_MODE})`);
});

const sweepOverdue = () => {
  expireOverduePayments().catch((error: unknown) => {
    console.error("逾期匯款單檢查失敗", error instanceof Error ? error.message : "unknown");
  });
};
sweepOverdue();
const overdueTimer = setInterval(sweepOverdue, 10 * 60 * 1000);
overdueTimer.unref();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    clearInterval(overdueTimer);
    server.close(() => process.exit(0));
  });
}

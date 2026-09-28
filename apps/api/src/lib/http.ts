import { ErrorCodes, type ErrorCode } from "@mf/contracts";
import { Prisma } from "@mf/db/server";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "./errors";

export type RequestIdCarrier = { requestId: string };

export function requestIdOf(req: Request): string {
  return (req as Request & RequestIdCarrier).requestId ?? "missing-request-id";
}

export function ok<T>(res: Response, req: Request, data: T, meta?: { page: number; pageSize: number; total: number; totalPages: number }) {
  res.json({ success: true, data, ...(meta ? { meta } : {}), requestId: requestIdOf(req) });
}

export function route(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export function errorMiddleware(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = requestIdOf(req);
  if (error instanceof ApiError) {
    res.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message, ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) },
      requestId,
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: "輸入資料不正確",
        fieldErrors: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      requestId,
    });
    return;
  }
  const databaseMessage = databaseErrorMessage(error);
  console.error(safeErrorText(error));
  res.status(databaseMessage ? 503 : 500).json({
    success: false,
    error: { code: "INTERNAL" as ErrorCode, message: databaseMessage ?? "系統發生錯誤" },
    requestId,
  });
}

function databaseErrorMessage(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientInitializationError) return "資料庫無法連線";
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") return "資料庫資料表尚未建立";
    if (error.code.startsWith("P1")) return "資料庫無法連線";
  }
  return null;
}

function safeErrorText(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://***");
}

export function fieldFailure(issues: { path: string; message: string }[]): never {
  throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "資料尚未通過驗證", issues);
}

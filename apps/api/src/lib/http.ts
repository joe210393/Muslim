import { ErrorCodes, type ErrorCode } from "@mf/contracts";
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
  console.error(error);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL" as ErrorCode, message: "系統發生錯誤" },
    requestId,
  });
}

export function fieldFailure(issues: { path: string; message: string }[]): never {
  throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "資料尚未通過驗證", issues);
}

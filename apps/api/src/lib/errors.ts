import type { ErrorCode } from "@mf/contracts";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public fieldErrors?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

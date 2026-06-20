import type { Context } from "hono";
import { DomainError } from "./errors";

export function errorBody(code: string, message: string, details?: unknown) {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

/** Hono onError handler: converts DomainError -> JSON envelope. */
export async function onError(err: Error, c: Context): Promise<Response> {
  if (err instanceof DomainError) {
    return c.json(errorBody(err.code, err.message, err.details), err.status as any);
  }
  // Validation errors thrown from zod adapters / others
  if ((err as any)?.name === "ZodError" || (err as any)?.issues) {
    return c.json(
      errorBody("VALIDATION_FAILED", "Validation failed", (err as any).issues ?? null),
      400,
    );
  }
  console.error("Unhandled error", err);
  return c.json(errorBody("INTERNAL", "Internal server error"), 500);
}

/**
 * Domain error classes. Carry an HTTP status + machine-readable code.
 * Route handlers convert these into the response shape
 *   { error: { code, message, details? } }
 */

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_FAILED"
  | "PAYLOAD_TOO_LARGE"
  | "INSUFFICIENT_CREDIT"
  | "READ_ONLY_MEMO"
  | "ACCOUNT_SUSPENDED"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "NOT_IMPLEMENTED";

export class DomainError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Unauthorized") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource = "Resource") {
    super("NOT_FOUND", `${resource} not found`, 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message = "Conflict", details?: unknown) {
    super("CONFLICT", message, 409, details);
  }
}

export class ValidationError extends DomainError {
  constructor(message = "Validation failed", details?: unknown) {
    super("VALIDATION_FAILED", message, 400, details);
  }
}

export class PayloadTooLargeError extends DomainError {
  constructor(message = "Payload too large") {
    super("PAYLOAD_TOO_LARGE", message, 413);
  }
}

export class InsufficientCreditsError extends DomainError {
  constructor(message = "Insufficient credit") {
    super("INSUFFICIENT_CREDIT", message, 403);
  }
}

export class ReadOnlyMemoError extends DomainError {
  constructor(message = "Memo is read-only") {
    super("READ_ONLY_MEMO", message, 403);
  }
}

export class AccountSuspendedError extends DomainError {
  constructor(message = "Account suspended") {
    super("ACCOUNT_SUSPENDED", message, 401);
  }
}

export class RateLimitedError extends DomainError {
  constructor(message = "Rate limited", details?: unknown) {
    super("RATE_LIMITED", message, 429, details);
  }
}

export class NotImplementedError extends DomainError {
  constructor(message = "Not implemented") {
    super("NOT_IMPLEMENTED", message, 501);
  }
}

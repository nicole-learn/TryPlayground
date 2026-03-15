import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class StudioRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "StudioRouteError";
    this.status = status;
  }
}

export function createStudioRouteError(status: number, message: string): never {
  throw new StudioRouteError(status, message);
}

function formatZodError(error: ZodError) {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return "The request payload was invalid.";
  }

  const path = firstIssue.path.length > 0 ? `${firstIssue.path.join(".")}: ` : "";
  return `${path}${firstIssue.message}`;
}

function inferStudioErrorStatus(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("session is invalid or expired") ||
    normalized.includes("missing hosted session") ||
    normalized.includes("sign in with google")
  ) {
    return 401;
  }

  if (
    normalized.includes("could not be found") ||
    normalized.includes("unknown generation run") ||
    normalized.includes("not found")
  ) {
    return 404;
  }

  if (
    normalized.includes("not enough credits") ||
    normalized.includes("concurrent queues/ generations reached")
  ) {
    return 409;
  }

  if (
    normalized.includes("unsupported") ||
    normalized.includes("missing required") ||
    normalized.includes("missing input") ||
    normalized.includes("payload was incomplete") ||
    normalized.includes("invalid") ||
    normalized.includes("disabled for this workspace") ||
    normalized.includes("does not support") ||
    normalized.includes("at most") ||
    normalized.includes("requires at least")
  ) {
    return 400;
  }

  return null;
}

export function toStudioErrorResponse(
  error: unknown,
  fallbackMessage: string,
  defaultStatus = 500
) {
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: "The request body was not valid JSON.",
      },
      { status: 400 }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: formatZodError(error),
      },
      { status: 422 }
    );
  }

  if (error instanceof StudioRouteError) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: error.status }
    );
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const inferredStatus = inferStudioErrorStatus(message);
  const status =
    inferredStatus ?? (defaultStatus >= 400 ? defaultStatus : 500);

  return NextResponse.json(
    {
      error: status >= 500 ? fallbackMessage : message,
    },
    { status }
  );
}

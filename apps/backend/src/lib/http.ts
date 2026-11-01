import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";

/** An error with an HTTP status and a stable code the clients can switch on. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }
  static unauthorized(message = "Log in to continue.") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "You can't do that.") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found.") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(code: string, message: string) {
    return new ApiError(409, code, message);
  }
}

export type ErrorBody = { error: { code: string; message: string; details?: unknown } };

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  const body: ErrorBody = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  return NextResponse.json(body, { status });
}

type Params = Record<string, string | string[] | undefined>;

/**
 * Wraps a route handler: awaits params, turns the return value into JSON and
 * maps ApiError, zod and Prisma errors to proper responses.
 */
export function handler<P extends Params = Params>(
  fn: (req: NextRequest, ctx: { params: P }) => Promise<unknown>,
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const result = await fn(req, { params: await ctx.params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err.status, err.code, err.message, err.details);
      if (err instanceof ZodError) {
        return errorResponse(400, "VALIDATION", "Some fields are not valid.", z.flattenError(err));
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") return errorResponse(409, "CONFLICT", "That already exists.");
        if (err.code === "P2025") return errorResponse(404, "NOT_FOUND", "Not found.");
      }
      console.error(err);
      return errorResponse(500, "INTERNAL", "Something went wrong on the server. Try again.");
    }
  };
}

/** Parses and validates a JSON body. */
export async function readJson<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw ApiError.badRequest("The request body must be JSON.");
  }
  return schema.parse(raw);
}

import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireLecturer } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { getOwnedModule } from "@/server/modules";

/** The lecturer and their module for a module page, or a 404 page. Cached per request. */
export const loadModule = cache(async (moduleId: string) => {
  const lecturer = await requireLecturer();
  try {
    const { regSecret: _secret, ...mod } = await getOwnedModule(lecturer.id, moduleId);
    return { lecturer, mod };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
});

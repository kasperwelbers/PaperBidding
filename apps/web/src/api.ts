import { hc, type ClientResponse } from "hono/client";
import type { AppType } from "@cp/api";

/** Typed API client. The API is served from the same origin */
export const api = hc<AppType>("/").api;

type Success<R> =
  R extends ClientResponse<infer T, infer S, infer _F> ? (S extends 200 | 201 ? T : never) : never;

/** Awaits an API call, throws an Error with the API's message if it failed,
 *  and returns the (typed) JSON of a successful response */
export async function unwrap<R extends ClientResponse<unknown, number, string>>(
  call: Promise<R>,
): Promise<Success<R>> {
  const res = await call;
  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
      else if (res.status === 400) message = "Invalid input";
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
  return (await res.json()) as Success<R>;
}

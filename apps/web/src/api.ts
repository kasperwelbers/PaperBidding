import { hc } from "hono/client";
import type { AppType } from "@cp/api";

/** Typed API client. The API is served from the same origin */
export const api = hc<AppType>("/").api;

import { serverGet } from "../http/client";

/** `GET /health` answers with plain JSON, outside the `/api/v1` prefix and the response envelope. */
export interface HealthStatus {
  status: "ok" | "degraded" | string;
  database: "up" | "down" | string;
}

export const getHealth = () => serverGet<HealthStatus>("/health");

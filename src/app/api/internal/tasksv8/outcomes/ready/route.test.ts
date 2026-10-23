import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/internal/tasksv8/outcomes/ready", () => {
  it("returns ready status and migration 011_tasksv8_links", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: "ready",
      tasksv8: {
        enabled: true,
        migration: "011_tasksv8_links",
        database: "ready",
      },
    });
  });
});

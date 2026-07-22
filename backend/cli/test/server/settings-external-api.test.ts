import { describe, expect, test } from "bun:test"
import { ExternalAPIRoutes } from "../../src/server/routes/settings/external-api"

describe("external API registration", () => {
  test("rejects a short password before contacting the account service", async () => {
    const response = await ExternalAPIRoutes().request("/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "researcher", password: "short", confirmation: "short" }),
    })

    expect(response.status).toBe(400)
  })

  test("rejects mismatched passwords before contacting the account service", async () => {
    const response = await ExternalAPIRoutes().request("/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "researcher", password: "password123", confirmation: "password456" }),
    })

    expect(response.status).toBe(400)
  })

  test("rejects account names longer than the upstream limit", async () => {
    const response = await ExternalAPIRoutes().request("/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "researcher-name-over-20",
        password: "password123",
        confirmation: "password123",
      }),
    })

    expect(response.status).toBe(400)
  })
})

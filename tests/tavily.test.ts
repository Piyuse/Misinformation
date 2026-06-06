import { describe, expect, it, vi } from "vitest";
import { searchTavily } from "@/lib/tavily";

describe("searchTavily", () => {
  it("maps Tavily results into evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [
            {
              title: "Official update",
              url: "https://example.com/update",
              content: "The claim is addressed by an official update.",
              published_date: "2026-05-01"
            }
          ]
        })
      }))
    );

    const results = await searchTavily("official update", "test-key");

    expect(results).toEqual([
      {
        title: "Official update",
        url: "https://example.com/update",
        snippet: "The claim is addressed by an official update.",
        publishedDate: "2026-05-01"
      }
    ]);
  });

  it("throws when the API key is missing", async () => {
    await expect(searchTavily("query", "")).rejects.toThrow("Missing TAVILY_API_KEY");
  });
});

import { describe, expect, it } from "vitest";
import { claimExtractionSchema, createUnverifiedResult, verifyResultSchema } from "@/lib/schema";

describe("schemas", () => {
  it("accepts a valid text claim extraction", () => {
    const parsed = claimExtractionSchema.parse({
      claims: [
        {
          text: "A city banned mobile phones in schools.",
          searchQuery: "city banned mobile phones in schools"
        }
      ]
    });

    expect(parsed.claims).toHaveLength(1);
  });

  it("creates a valid unverified result", () => {
    const result = createUnverifiedResult("No checkable claim found.");

    expect(verifyResultSchema.parse(result).verdict).toBe("Unverified");
  });
});

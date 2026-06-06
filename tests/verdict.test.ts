import { describe, expect, it } from "vitest";
import { verifyResultSchema } from "@/lib/schema";

describe("verification result", () => {
  it.each(["Supported", "False", "Misleading", "Unverified"] as const)(
    "accepts %s verdicts",
    (verdict) => {
      const parsed = verifyResultSchema.parse({
        verdict,
        confidence: "medium",
        safetyStatus: "Suspicious",
        agentDecision: "Digital Safety Agent decision: Suspicious.",
        seenCount: 3,
        similarSeenCount: 7,
        firstSeenAt: "2026-06-06T00:00:00.000Z",
        lastSeenAt: "2026-06-06T00:00:00.000Z",
        seenCountLabel: "This exact message has been checked 3 times in this app.",
        viralRiskLevel: "low",
        summary: "Evidence was reviewed.",
        simpleSummary: "The evidence was checked in simple language.",
        detectedLanguage: "English",
        transcript: null,
        claims: ["A checkable claim."],
        evidence: [
          {
            title: "Source",
            url: "https://example.com",
            source: null,
            snippet: "Relevant evidence.",
            publishedDate: null,
            stance: "context"
          }
        ],
        agentChecks: {
          claimVerification: "Claim verification result was reviewed.",
          scamDetection: "No scam wording was found.",
          linkAnalysis: "No link was found.",
          misinformationCheck: "The claim was checked.",
          simpleExplanation: "The message was explained simply."
        },
        scamSignals: [],
        linkFindings: [],
        whatToCheckNext: "Review the cited source.",
        safetyAdvice: "Do not forward until you trust the source.",
        shareableExplanation: "This was checked against public evidence."
      });

      expect(parsed.verdict).toBe(verdict);
    }
  );
});

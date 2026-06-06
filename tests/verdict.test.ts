import { describe, expect, it } from "vitest";
import { runDigitalSafetyAgent } from "@/lib/digital-safety-agent";
import { createUnverifiedResult, verifyResultSchema } from "@/lib/schema";

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

  it("accepts reel/video analysis fields", () => {
    const parsed = verifyResultSchema.parse({
      ...createUnverifiedResult("The reel could not be fully verified."),
      mediaType: "video",
      transcript: "A spoken claim from the reel.",
      videoTranscript: "A spoken claim from the reel.",
      reelAnalysis: "The frames show a public event, but no source is visible.",
      instagramPreview: {
        providerName: "Instagram",
        authorName: "sample_creator",
        thumbnailUrl: "https://example.com/thumb.jpg",
        source: "instagram_oembed"
      },
      mediaConfidence: "low",
      manipulationSignals: ["the reel makes a strong claim without showing a source"],
      frameFindings: [
        {
          frameNumber: 1,
          visibleText: "Breaking news",
          sceneSummary: "A crowd is shown outdoors.",
          suspiciousSignals: ["sensational text appears without source details"]
        }
      ]
    });

    expect(parsed.mediaType).toBe("video");
    expect(parsed.frameFindings).toHaveLength(1);
    expect(parsed.instagramPreview?.providerName).toBe("Instagram");
  });

  it("treats reel manipulation signals as caution, not proof by themselves", () => {
    const result = runDigitalSafetyAgent({
      originalText: "Instagram reel caption with no source",
      mediaType: "video",
      result: createUnverifiedResult("The reel needs more evidence."),
      videoFrameAnalysis: {
        reelAnalysis: "No visible source is shown in the sampled frames.",
        mediaConfidence: "low",
        manipulationSignals: ["no original source is visible in the reel"],
        frameFindings: [
          {
            frameNumber: 1,
            visibleText: null,
            sceneSummary: "A person is speaking to camera.",
            suspiciousSignals: []
          }
        ]
      }
    });

    expect(result.safetyStatus).toBe("Suspicious");
    expect(result.verdict).toBe("Unverified");
    expect(result.shareableExplanation).toContain("Reel/video check");
  });
});

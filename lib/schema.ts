import { z } from "zod";

export const verdictSchema = z.enum([
  "Supported",
  "False",
  "Misleading",
  "Unverified"
]);

export const confidenceSchema = z.enum(["low", "medium", "high"]);
export const safetyStatusSchema = z.enum(["Safe", "Suspicious", "Likely Scam"]);
export const viralRiskLevelSchema = z.enum(["low", "medium", "high"]);
export const mediaTypeSchema = z.enum(["text", "url", "image", "audio", "video"]);

export const evidenceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  source: z.string().nullable().optional(),
  snippet: z.string().min(1),
  publishedDate: z.string().nullable().optional(),
  stance: z.enum(["supports", "contradicts", "context", "unclear"])
});

export const supportedLanguageSchema = z.enum([
  "auto",
  "english",
  "hindi",
  "tamil",
  "telugu",
  "malayalam",
  "kannada",
  "bengali",
  "marathi",
  "gujarati",
  "punjabi",
  "urdu"
]);

export const claimSchema = z.object({
  text: z.string().min(1),
  searchQuery: z.string().min(1)
});

export const claimExtractionSchema = z.object({
  extractedText: z.string().nullable().optional(),
  claims: z.array(claimSchema).max(3),
  noClaimReason: z.string().nullable().optional()
});

export const verifyResultSchema = z.object({
  verdict: verdictSchema,
  confidence: confidenceSchema,
  mediaType: mediaTypeSchema.optional(),
  safetyStatus: safetyStatusSchema.optional(),
  agentDecision: z.string().optional(),
  seenCount: z.number().int().nonnegative().optional(),
  similarSeenCount: z.number().int().nonnegative().optional(),
  firstSeenAt: z.string().optional(),
  lastSeenAt: z.string().optional(),
  seenCountLabel: z.string().optional(),
  viralRiskLevel: viralRiskLevelSchema.optional(),
  summary: z.string().min(1),
  simpleSummary: z.string().min(1),
  detectedLanguage: z.string().min(1),
  transcript: z.string().nullable().optional(),
  videoTranscript: z.string().nullable().optional(),
  frameFindings: z
    .array(
      z.object({
        frameNumber: z.number().int().positive(),
        visibleText: z.string().nullable().optional(),
        sceneSummary: z.string().min(1),
        suspiciousSignals: z.array(z.string()).optional()
      })
    )
    .optional(),
  reelAnalysis: z.string().optional(),
  instagramPreview: z
    .object({
      providerName: z.string().min(1),
      authorName: z.string().optional(),
      title: z.string().optional(),
      thumbnailUrl: z.string().url().optional(),
      html: z.string().optional(),
      source: z.literal("instagram_oembed"),
      unavailableReason: z.string().optional()
    })
    .optional(),
  manipulationSignals: z.array(z.string()).optional(),
  mediaConfidence: confidenceSchema.optional(),
  claims: z.array(z.string()).max(3),
  evidence: z.array(evidenceSchema).max(10),
  agentChecks: z
    .object({
      claimVerification: z.string().min(1),
      scamDetection: z.string().min(1),
      linkAnalysis: z.string().min(1),
      misinformationCheck: z.string().min(1),
      simpleExplanation: z.string().min(1)
    })
    .optional(),
  scamSignals: z.array(z.string()).optional(),
  linkFindings: z
    .array(
      z.object({
        url: z.string().min(1),
        risk: z.enum(["low", "medium", "high"]),
        reason: z.string().min(1)
      })
    )
    .optional(),
  whatToCheckNext: z.string().min(1),
  safetyAdvice: z.string().min(1),
  shareableExplanation: z.string().min(1)
});

export type Verdict = z.infer<typeof verdictSchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type SafetyStatus = z.infer<typeof safetyStatusSchema>;
export type ViralRiskLevel = z.infer<typeof viralRiskLevelSchema>;
export type MediaType = z.infer<typeof mediaTypeSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type ClaimExtraction = z.infer<typeof claimExtractionSchema>;
export type VerifyResult = z.infer<typeof verifyResultSchema>;
export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/mpga",
  "audio/m4a",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/webm",
  "application/octet-stream",
  "video/mp4"
];
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];

export function createUnverifiedResult(
  summary: string,
  whatToCheckNext = "Try adding more context, a source link, or a clearer screenshot of the claim."
): VerifyResult {
  return {
    verdict: "Unverified",
    confidence: "low",
    safetyStatus: "Suspicious",
    agentDecision: "The agent could not verify this message with enough evidence.",
    seenCount: 0,
    similarSeenCount: 0,
    firstSeenAt: undefined,
    lastSeenAt: undefined,
    seenCountLabel: "This message has not been counted yet.",
    viralRiskLevel: "low",
    summary,
    simpleSummary: summary,
    detectedLanguage: "English",
    transcript: null,
    claims: [],
    evidence: [],
    agentChecks: {
      claimVerification: "No checkable claim was found.",
      scamDetection: "No clear scam pattern was confirmed, but the message is not verified.",
      linkAnalysis: "No trusted source link was confirmed.",
      misinformationCheck: "The message remains unverified.",
      simpleExplanation: summary
    },
    scamSignals: [],
    linkFindings: [],
    whatToCheckNext,
    safetyAdvice: "Do not forward this message until you can confirm it from a trusted source.",
    shareableExplanation: summary
  };
}

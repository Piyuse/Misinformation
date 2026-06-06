export type Verdict = "Supported" | "False" | "Misleading" | "Unverified";
export type Confidence = "low" | "medium" | "high";
export type SafetyStatus = "Safe" | "Suspicious" | "Likely Scam";
export type ViralRiskLevel = "low" | "medium" | "high";
export type MediaType = "text" | "url" | "image" | "audio" | "video";
export type SupportedLanguage =
  | "auto"
  | "english"
  | "hindi"
  | "tamil"
  | "telugu"
  | "malayalam"
  | "kannada"
  | "bengali"
  | "marathi"
  | "gujarati"
  | "punjabi"
  | "urdu";

export type Evidence = {
  title: string;
  url: string;
  source?: string | null;
  snippet: string;
  publishedDate?: string | null;
  stance: "supports" | "contradicts" | "context" | "unclear";
};

export type VerifyResult = {
  verdict: Verdict;
  confidence: Confidence;
  mediaType?: MediaType;
  safetyStatus?: SafetyStatus;
  agentDecision?: string;
  seenCount?: number;
  similarSeenCount?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  seenCountLabel?: string;
  viralRiskLevel?: ViralRiskLevel;
  summary: string;
  simpleSummary: string;
  detectedLanguage: string;
  transcript?: string | null;
  videoTranscript?: string | null;
  frameFindings?: Array<{
    frameNumber: number;
    visibleText?: string | null;
    sceneSummary: string;
    suspiciousSignals?: string[];
  }>;
  reelAnalysis?: string;
  instagramPreview?: {
    providerName: string;
    authorName?: string;
    title?: string;
    thumbnailUrl?: string;
    html?: string;
    source: "instagram_oembed";
    unavailableReason?: string;
  };
  manipulationSignals?: string[];
  mediaConfidence?: Confidence;
  claims: string[];
  evidence: Evidence[];
  agentChecks?: {
    claimVerification: string;
    scamDetection: string;
    linkAnalysis: string;
    misinformationCheck: string;
    simpleExplanation: string;
  };
  scamSignals?: string[];
  linkFindings?: Array<{
    url: string;
    risk: "low" | "medium" | "high";
    reason: string;
  }>;
  whatToCheckNext: string;
  safetyAdvice: string;
  shareableExplanation: string;
};

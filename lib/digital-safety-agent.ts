import type { VerifyResult } from "@/lib/schema";
import type { SeenCountStats } from "@/lib/seen-count";
import type { VideoFrameAnalysis } from "@/lib/openai";

type DigitalSafetyAgentInput = {
  originalText: string;
  sourceUrl?: string;
  seenStats?: SeenCountStats;
  mediaType?: VerifyResult["mediaType"];
  videoFrameAnalysis?: VideoFrameAnalysis;
  result: VerifyResult;
};

const urgencyPatterns = [
  /\bforward\b/i,
  /\bshare (this|it|now|quickly|immediately)\b/i,
  /\burgent\b/i,
  /\btoday only\b/i,
  /\blast chance\b/i,
  /\bdo not ignore\b/i,
  /\bsend to (everyone|all|10|ten)\b/i
];

const scamPatterns = [
  /\botp\b/i,
  /\bpin\b/i,
  /\bkyc\b/i,
  /\bbank account\b/i,
  /\bpassword\b/i,
  /\bclick (here|this link|the link)\b/i,
  /\bfree (recharge|money|gift|coupon|prize)\b/i,
  /\blottery\b/i,
  /\bclaim (now|your prize|reward)\b/i,
  /\bgovernment (free|giving|scheme|benefit)\b/i,
  /\bwhatsapp lottery\b/i,
  /\baccount (blocked|suspended|will be closed)\b/i
];

const misinformationPatterns = [
  /\bmiracle cure\b/i,
  /\bdoctors (are hiding|don't want you to know)\b/i,
  /\bbreaking news\b/i,
  /\bold video\b/i,
  /\bsecret information\b/i,
  /\bmedia will not show\b/i,
  /\bconfirmed by nasa\b/i,
  /\bconfirmed by who\b/i
];

const trustedHostPatterns = [
  /\.gov(\.|$)/i,
  /\.edu(\.|$)/i,
  /\.org(\.|$)/i,
  /who\.int$/i,
  /rbi\.org\.in$/i,
  /pib\.gov\.in$/i,
  /mygov\.in$/i
];

const shortenerHosts = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "is.gd",
  "cutt.ly",
  "shorturl.at",
  "rebrand.ly"
]);

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s)]+/gi) ?? [];
  return unique(matches.map((url) => url.replace(/[.,!?]+$/, "")));
}

function hostnameFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function analyzeLinks(urls: string[]) {
  return urls.map((url) => {
    const host = hostnameFor(url);

    if (!host) {
      return {
        url,
        risk: "high" as const,
        reason: "The link format looks invalid."
      };
    }

    if (shortenerHosts.has(host)) {
      return {
        url,
        risk: "medium" as const,
        reason: "This is a shortened link, so the final website is hidden."
      };
    }

    if (trustedHostPatterns.some((pattern) => pattern.test(host))) {
      return {
        url,
        risk: "low" as const,
        reason: "The link appears to use a known official or institutional domain."
      };
    }

    if (/\d+\.\d+\.\d+\.\d+/.test(host) || host.includes("whatsapp") || host.includes("free")) {
      return {
        url,
        risk: "high" as const,
        reason: "The link has suspicious wording or an unusual host."
      };
    }

    return {
      url,
      risk: "medium" as const,
      reason: "The link is not clearly official. Check it before opening."
    };
  });
}

function detectSignals(text: string) {
  const signals: string[] = [];

  if (urgencyPatterns.some((pattern) => pattern.test(text))) {
    signals.push("pressures the user to forward or act quickly");
  }

  if (scamPatterns.some((pattern) => pattern.test(text))) {
    signals.push("contains common scam words such as OTP, KYC, free reward, or account warning");
  }

  if (misinformationPatterns.some((pattern) => pattern.test(text))) {
    signals.push("resembles a viral misinformation pattern");
  }

  if (/\b(no source|without source|forwarded many times)\b/i.test(text)) {
    signals.push("does not provide a clear trustworthy source");
  }

  if (/\bdeepfake|edited video|fake reel|ai video|morphed\b/i.test(text)) {
    signals.push("asks the user to trust or forward a possibly manipulated video claim");
  }

  return unique(signals);
}

function decideSafetyStatus({
  result,
  scamSignals,
  highRiskLinks,
  seenStats
}: {
  result: VerifyResult;
  scamSignals: string[];
  highRiskLinks: number;
  seenStats?: SeenCountStats;
}) {
  const highRepetitionWithRisk =
    (seenStats?.similarSeenCount ?? 0) >= 200 &&
    (scamSignals.length > 0 || result.verdict === "False" || result.verdict === "Misleading");

  if (
    highRiskLinks > 0 ||
    scamSignals.length >= 2 ||
    result.verdict === "False" ||
    (result.verdict === "Misleading" && scamSignals.length > 0) ||
    highRepetitionWithRisk
  ) {
    return "Likely Scam" as const;
  }

  if (
    scamSignals.length > 0 ||
    result.verdict === "Misleading" ||
    result.verdict === "Unverified" ||
    result.confidence === "low" ||
    (seenStats?.similarSeenCount ?? 0) >= 100 ||
    (seenStats?.seenCount ?? 0) >= 20
  ) {
    return "Suspicious" as const;
  }

  return "Safe" as const;
}

function adviceFor(status: "Safe" | "Suspicious" | "Likely Scam") {
  if (status === "Safe") {
    return "This looks reasonably safe based on the available evidence, but still avoid sharing personal information.";
  }

  if (status === "Likely Scam") {
    return "Do not forward this message. Do not click links, share OTPs, or send money.";
  }

  return "Be careful. Do not forward this until it is confirmed by an official or trusted source.";
}

export function runDigitalSafetyAgent({
  originalText,
  sourceUrl,
  seenStats,
  mediaType,
  videoFrameAnalysis,
  result
}: DigitalSafetyAgentInput): VerifyResult {
  const urls = unique([...extractUrls(originalText), ...(sourceUrl ? [sourceUrl] : [])]);
  const linkFindings = analyzeLinks(urls);
  const scamSignals = detectSignals(originalText);
  const highRiskLinks = linkFindings.filter((link) => link.risk === "high").length;
  const mediaSignals = videoFrameAnalysis?.manipulationSignals ?? [];
  const allSignals = unique([...scamSignals, ...mediaSignals]);
  const baseSafetyStatus = decideSafetyStatus({
    result,
    scamSignals,
    highRiskLinks,
    seenStats
  });
  const safetyStatus =
    baseSafetyStatus === "Safe" && mediaSignals.length > 0 ? "Suspicious" : baseSafetyStatus;
  const safetyAdvice = adviceFor(safetyStatus);
  const viralMessage =
    seenStats && seenStats.similarSeenCount >= 20
      ? "Many people have checked similar messages. This can be a sign of a viral forward, so be careful."
      : "";
  const linkSummary =
    linkFindings.length === 0
      ? "No link was found in the message."
      : linkFindings
          .map((link) => `${link.risk.toUpperCase()}: ${link.reason}`)
          .join(" ");

  const agentChecks = {
    claimVerification: `Claim verification result: ${result.verdict} with ${result.confidence} confidence.`,
    scamDetection:
      allSignals.length > 0
        ? `Warning signs found: ${allSignals.join("; ")}.`
        : "No strong scam wording was found in the message text.",
    linkAnalysis: linkSummary,
    misinformationCheck:
      result.verdict === "Supported"
        ? "The main claim is supported by available evidence."
        : `The main claim is ${result.verdict.toLowerCase()} or not fully reliable based on available evidence.`,
    simpleExplanation: [result.simpleSummary || result.summary, viralMessage].filter(Boolean).join(" ")
  };

  const reelAdvice =
    mediaType === "video"
      ? videoFrameAnalysis
        ? `Reel/video check: ${videoFrameAnalysis.reelAnalysis}`
        : "Reel/video check: The reel link was noted, but the actual video could not be inspected unless it was uploaded."
      : "";

  const agentDecision = [
    `Digital Safety Agent decision: ${safetyStatus}.`,
    safetyAdvice,
    viralMessage
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ...result,
    mediaType,
    safetyStatus,
    agentDecision: [agentDecision, reelAdvice].filter(Boolean).join(" "),
    seenCount: seenStats?.seenCount ?? result.seenCount,
    similarSeenCount: seenStats?.similarSeenCount ?? result.similarSeenCount,
    firstSeenAt: seenStats?.firstSeenAt ?? result.firstSeenAt,
    lastSeenAt: seenStats?.lastSeenAt ?? result.lastSeenAt,
    seenCountLabel: seenStats?.seenCountLabel ?? result.seenCountLabel,
    viralRiskLevel: seenStats?.viralRiskLevel ?? result.viralRiskLevel,
    agentChecks,
    scamSignals: allSignals,
    linkFindings,
    videoTranscript: mediaType === "video" ? result.transcript ?? null : result.videoTranscript,
    frameFindings: videoFrameAnalysis?.frameFindings ?? result.frameFindings,
    reelAnalysis: videoFrameAnalysis?.reelAnalysis ?? result.reelAnalysis ?? (reelAdvice || undefined),
    manipulationSignals: mediaSignals.length > 0 ? mediaSignals : result.manipulationSignals,
    mediaConfidence: videoFrameAnalysis?.mediaConfidence ?? result.mediaConfidence,
    safetyAdvice: [safetyAdvice, viralMessage].filter(Boolean).join(" "),
    shareableExplanation: [
      `${safetyStatus}: ${result.shareableExplanation || result.simpleSummary}.`,
      reelAdvice,
      safetyAdvice,
      seenStats?.seenCountLabel
    ]
      .filter(Boolean)
      .join(" ")
  };
}

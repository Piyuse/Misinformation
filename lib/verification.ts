import { analyzeVideoFrames, extractClaims, generateVerdict, type VideoFrameAnalysis } from "@/lib/openai";
import { runDigitalSafetyAgent } from "@/lib/digital-safety-agent";
import { fetchInstagramPreview, isInstagramReelUrl } from "@/lib/instagram";
import {
  createUnverifiedResult,
  type MediaType,
  type SupportedLanguage,
  verifyResultSchema
} from "@/lib/schema";
import { getSeenCountStore, type SeenCountStats } from "@/lib/seen-count";
import { searchClaims } from "@/lib/tavily";

export type VerifyContentInput = {
  messageText?: string;
  sourceUrl?: string;
  imageDataUrl?: string;
  transcript?: string;
  videoFrameDataUrls?: string[];
  mediaType?: MediaType;
  language?: SupportedLanguage;
};

function hasLink(text: string, sourceUrl?: string) {
  return Boolean(sourceUrl || /https?:\/\/[^\s)]+/i.test(text));
}

function recordSeenCount({
  originalText,
  sourceUrl,
  imageDataUrl,
  transcript,
  mediaType,
  language
}: {
  originalText: string;
  sourceUrl?: string;
  imageDataUrl?: string;
  transcript?: string;
  mediaType?: MediaType;
  language?: SupportedLanguage;
}): SeenCountStats | undefined {
  if (!originalText.trim()) {
    return undefined;
  }

  return getSeenCountStore().recordSeen(originalText, {
    hasLink: hasLink(originalText, sourceUrl),
    hasAudio: Boolean(transcript),
    hasImage: Boolean(imageDataUrl),
    hasVideo: mediaType === "video",
    detectedLanguage: language === "auto" ? undefined : language
  });
}

export async function verifyContent({
  messageText,
  sourceUrl,
  imageDataUrl,
  transcript,
  videoFrameDataUrls,
  mediaType,
  language = "auto"
}: VerifyContentInput) {
  const initialMediaType =
    mediaType ??
    (videoFrameDataUrls && videoFrameDataUrls.length > 0
      ? "video"
      : transcript
        ? "audio"
        : imageDataUrl
          ? "image"
          : sourceUrl
            ? "url"
            : "text");
  const resolvedMediaType =
    initialMediaType === "url" && isInstagramReelUrl(sourceUrl) ? "video" : initialMediaType;

  if (
    resolvedMediaType === "video" &&
    sourceUrl &&
    isInstagramReelUrl(sourceUrl) &&
    !messageText?.trim() &&
    !imageDataUrl &&
    !transcript &&
    !videoFrameDataUrls?.length
  ) {
    const reelUrl = sourceUrl;
    const instagramPreview = await fetchInstagramPreview(reelUrl);
    const previewText = summarizeInstagramPreview(instagramPreview);
    const originalText = reelUrl;
    const seenStats = recordSeenCount({
      originalText,
      sourceUrl: reelUrl,
      mediaType: resolvedMediaType,
      language
    });
    const result = verifyResultSchema.parse(
      runDigitalSafetyAgent({
        originalText,
        sourceUrl: reelUrl,
        seenStats,
        mediaType: resolvedMediaType,
        result: createUnverifiedResult(
          [
            "I can inspect that this is an Instagram Reel link, but I cannot verify the actual reel content unless you share the video, caption, audio, or a screenshot.",
            previewText
          ]
            .filter(Boolean)
            .join(" "),
          "Share the reel video, paste the caption, or upload a screenshot so the agent can check the actual claim."
        )
      })
    );
    const resultWithPreview = verifyResultSchema.parse({
      ...result,
      instagramPreview,
      reelAnalysis: [result.reelAnalysis, previewText].filter(Boolean).join(" ") || result.reelAnalysis
    });

    if (seenStats) {
      getSeenCountStore().updateOutcome({
        exactMessageHash: seenStats.exactMessageHash,
        safetyStatus: resultWithPreview.safetyStatus,
        verdict: resultWithPreview.verdict,
        detectedLanguage: resultWithPreview.detectedLanguage
      });
    }

    return resultWithPreview;
  }

  const videoFrameAnalysis = await analyzeVideoFrames({
    frameDataUrls: videoFrameDataUrls ?? [],
    transcript,
    messageText,
    sourceUrl,
    language
  });
  const videoFrameText = summarizeVideoFrameAnalysis(videoFrameAnalysis);
  const extraction = await extractClaims({
    messageText,
    sourceUrl,
    imageDataUrl,
    transcript,
    videoFrameDataUrls,
    videoFrameSummary: videoFrameText,
    language
  });
  const originalText = [messageText, sourceUrl, extraction.extractedText, transcript, videoFrameText]
    .filter(Boolean)
    .join("\n\n");
  const seenStats = recordSeenCount({
    originalText,
    sourceUrl,
    imageDataUrl,
    transcript,
    mediaType: resolvedMediaType,
    language
  });

  if (extraction.claims.length === 0) {
    const result = verifyResultSchema.parse(
      runDigitalSafetyAgent({
        originalText,
        sourceUrl,
        seenStats,
        mediaType: resolvedMediaType,
        videoFrameAnalysis,
        result: createUnverifiedResult(
          extraction.noClaimReason || "No checkable factual claim was found in the submitted message."
        )
      })
    );
    if (seenStats) {
      getSeenCountStore().updateOutcome({
        exactMessageHash: seenStats.exactMessageHash,
        safetyStatus: result.safetyStatus,
        verdict: result.verdict,
        detectedLanguage: result.detectedLanguage
      });
    }
    return result;
  }

  const evidence = await searchClaims(extraction.claims);

  const result = verifyResultSchema.parse(
    runDigitalSafetyAgent({
      originalText,
      sourceUrl,
      seenStats,
      mediaType: resolvedMediaType,
      videoFrameAnalysis,
      result: await generateVerdict({
        originalMessage: originalText,
        sourceUrl,
        claims: extraction.claims.map((claim) => claim.text),
        evidence,
        transcript,
        language
      })
    })
  );
  if (seenStats) {
    getSeenCountStore().updateOutcome({
      exactMessageHash: seenStats.exactMessageHash,
      safetyStatus: result.safetyStatus,
      verdict: result.verdict,
      detectedLanguage: result.detectedLanguage
    });
  }
  return result;
}

function summarizeInstagramPreview(preview?: Awaited<ReturnType<typeof fetchInstagramPreview>>) {
  if (!preview) {
    return undefined;
  }

  if (preview.unavailableReason) {
    return preview.unavailableReason;
  }

  return [
    "Instagram preview metadata was available.",
    preview.authorName ? `Author shown by Instagram: ${preview.authorName}.` : undefined,
    preview.title ? `Preview title: ${preview.title}.` : undefined,
    preview.thumbnailUrl ? "A public preview thumbnail was available." : undefined
  ]
    .filter(Boolean)
    .join(" ");
}

function summarizeVideoFrameAnalysis(analysis?: VideoFrameAnalysis) {
  if (!analysis) {
    return undefined;
  }

  const frameText = analysis.frameFindings
    .flatMap((finding) => [
      finding.visibleText ? `Visible text: ${finding.visibleText}` : undefined,
      `Scene: ${finding.sceneSummary}`,
      ...(finding.suspiciousSignals ?? []).map((signal) => `Frame caution: ${signal}`)
    ])
    .filter(Boolean)
    .join("\n");

  return [
    `Reel analysis: ${analysis.reelAnalysis}`,
    analysis.manipulationSignals.length > 0
      ? `Possible media caution signals: ${analysis.manipulationSignals.join("; ")}`
      : undefined,
    frameText
  ]
    .filter(Boolean)
    .join("\n");
}

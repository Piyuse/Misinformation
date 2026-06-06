import { extractClaims, generateVerdict } from "@/lib/openai";
import { runDigitalSafetyAgent } from "@/lib/digital-safety-agent";
import { createUnverifiedResult, type SupportedLanguage, verifyResultSchema } from "@/lib/schema";
import { getSeenCountStore, type SeenCountStats } from "@/lib/seen-count";
import { searchClaims } from "@/lib/tavily";

export type VerifyContentInput = {
  messageText?: string;
  sourceUrl?: string;
  imageDataUrl?: string;
  transcript?: string;
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
  language
}: {
  originalText: string;
  sourceUrl?: string;
  imageDataUrl?: string;
  transcript?: string;
  language?: SupportedLanguage;
}): SeenCountStats | undefined {
  if (!originalText.trim()) {
    return undefined;
  }

  return getSeenCountStore().recordSeen(originalText, {
    hasLink: hasLink(originalText, sourceUrl),
    hasAudio: Boolean(transcript),
    hasImage: Boolean(imageDataUrl),
    detectedLanguage: language === "auto" ? undefined : language
  });
}

export async function verifyContent({
  messageText,
  sourceUrl,
  imageDataUrl,
  transcript,
  language = "auto"
}: VerifyContentInput) {
  const extraction = await extractClaims({
    messageText,
    sourceUrl,
    imageDataUrl,
    transcript,
    language
  });
  const originalText = [messageText, extraction.extractedText, transcript].filter(Boolean).join("\n\n");
  const seenStats = recordSeenCount({
    originalText,
    sourceUrl,
    imageDataUrl,
    transcript,
    language
  });

  if (extraction.claims.length === 0) {
    const result = verifyResultSchema.parse(
      runDigitalSafetyAgent({
        originalText,
        sourceUrl,
        seenStats,
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

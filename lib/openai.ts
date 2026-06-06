import {
  claimExtractionSchema,
  createUnverifiedResult,
  verifyResultSchema,
  type ClaimExtraction,
  type SupportedLanguage,
  type VerifyResult
} from "@/lib/schema";
import { convertAudioToWav } from "@/lib/audio";
import type { SearchEvidence } from "@/lib/tavily";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_MODEL = "gpt-5.4";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

type OpenAITextResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type VerifyEvidenceBundle = {
  claim: string;
  query: string;
  results: SearchEvidence[];
};

function getModel() {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function getApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  return process.env.OPENAI_API_KEY;
}

function getTranscriptionModel() {
  return process.env.OPENAI_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL;
}

function extractOutputText(payload: OpenAITextResponse) {
  if (payload.output_text) {
    return payload.output_text;
  }

  const content = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text" || item.text);

  return content?.text;
}

async function createStructuredResponse<T>({
  instructions,
  input,
  schemaName,
  schema
}: {
  instructions: string;
  input: unknown[];
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: getModel(),
      instructions,
      input,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed with status ${response.status}: ${detail}`);
  }

  const payload = (await response.json()) as OpenAITextResponse;
  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("OpenAI response did not include structured output text");
  }

  return JSON.parse(outputText) as T;
}

async function sendTranscriptionRequest(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", getTranscriptionModel());
  formData.append("response_format", "json");

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`
    },
    body: formData
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI transcription failed with status ${response.status}: ${detail}`);
  }

  const payload = (await response.json()) as { text?: string };
  const text = payload.text?.trim();

  if (!text) {
    throw new Error("Audio transcription did not return text.");
  }

  return text;
}

function shouldRetryWithConvertedAudio(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("unsupported") ||
    message.includes("corrupted") ||
    message.includes("invalid file format") ||
    message.includes("audio file")
  );
}

export async function transcribeAudio(file: File): Promise<string> {
  try {
    return await sendTranscriptionRequest(file);
  } catch (error) {
    if (!shouldRetryWithConvertedAudio(error)) {
      throw error;
    }

    const convertedFile = await convertAudioToWav(file);
    return sendTranscriptionRequest(convertedFile);
  }
}

export async function extractClaims({
  messageText,
  sourceUrl,
  imageDataUrl,
  transcript,
  language = "auto"
}: {
  messageText?: string;
  sourceUrl?: string;
  imageDataUrl?: string;
  transcript?: string;
  language?: SupportedLanguage;
}): Promise<ClaimExtraction> {
  const content: Array<Record<string, string>> = [
    {
      type: "input_text",
      text: [
        "Extract up to three specific factual claims from this forwarded message.",
        "Only include claims that can be checked against public sources.",
        "Write concise web-search queries for each claim.",
        "The user may submit WhatsApp, Instagram, screenshot, or voice-note content.",
        `Preferred output language: ${language}.`,
        `Message text: ${messageText || "(none)"}`,
        `Source URL: ${sourceUrl || "(none)"}`,
        `Voice transcript: ${transcript || "(none)"}`
      ].join("\n")
    }
  ];

  if (imageDataUrl) {
    content.push({
      type: "input_image",
      image_url: imageDataUrl
    });
  }

  const result = await createStructuredResponse<ClaimExtraction>({
    instructions: [
      "You extract checkable factual claims from forwarded messages, screenshots, and voice transcripts.",
      "The content may be in a local Indian language or English.",
      "Preserve the meaning of the original claim, but write search queries in English when that helps public web search.",
      "If there is no factual claim, return an empty claims array and explain why."
    ].join(" "),
    input: [
      {
        role: "user",
        content
      }
    ],
    schemaName: "claim_extraction",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["extractedText", "claims", "noClaimReason"],
      properties: {
        extractedText: { type: ["string", "null"] },
        noClaimReason: { type: ["string", "null"] },
        claims: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["text", "searchQuery"],
            properties: {
              text: { type: "string" },
              searchQuery: { type: "string" }
            }
          }
        }
      }
    }
  });

  return claimExtractionSchema.parse(result);
}

export async function generateVerdict({
  originalMessage,
  sourceUrl,
  claims,
  evidence,
  transcript,
  language = "auto"
}: {
  originalMessage: string;
  sourceUrl?: string;
  claims: string[];
  evidence: VerifyEvidenceBundle[];
  transcript?: string;
  language?: SupportedLanguage;
}): Promise<VerifyResult> {
  if (claims.length === 0) {
    return createUnverifiedResult("No checkable factual claim was found in the submitted message.");
  }

  const result = await createStructuredResponse<VerifyResult>({
    instructions: [
      "You are an evidence-based news verification assistant.",
      "Your audience is senior citizens, so explain the result in simple, calm, non-technical language.",
      "If the preferred language is not auto, write simpleSummary, safetyAdvice, shareableExplanation, and whatToCheckNext in that language.",
      "If preferred language is auto, use the dominant language from the submitted message or transcript when possible.",
      "Use only the supplied search evidence. Do not invent sources.",
      "Return Supported only when strong cited evidence confirms the central claim.",
      "Return False when strong cited evidence contradicts it.",
      "Return Misleading when the claim has true elements but omits important context.",
      "Return Unverified when evidence is weak, conflicting, missing, or too new.",
      "Use safetyAdvice to tell the user whether they should avoid forwarding, ask a trusted person, or verify with an official source.",
      "Make shareableExplanation short enough to send back in WhatsApp.",
      "Always include citations in the evidence array and avoid absolute legal/journalistic certification language."
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                originalMessage,
                sourceUrl,
                transcript,
                preferredLanguage: language,
                claims,
                evidence
              },
              null,
              2
            )
          }
        ]
      }
    ],
    schemaName: "verification_result",
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "verdict",
        "confidence",
        "summary",
        "simpleSummary",
        "detectedLanguage",
        "transcript",
        "claims",
        "evidence",
        "whatToCheckNext",
        "safetyAdvice",
        "shareableExplanation"
      ],
      properties: {
        verdict: {
          type: "string",
          enum: ["Supported", "False", "Misleading", "Unverified"]
        },
        confidence: {
          type: "string",
          enum: ["low", "medium", "high"]
        },
        summary: { type: "string" },
        simpleSummary: { type: "string" },
        detectedLanguage: { type: "string" },
        transcript: { type: ["string", "null"] },
        claims: {
          type: "array",
          maxItems: 3,
          items: { type: "string" }
        },
        evidence: {
          type: "array",
          maxItems: 10,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "url", "source", "snippet", "publishedDate", "stance"],
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              source: { type: ["string", "null"] },
              snippet: { type: "string" },
              publishedDate: { type: ["string", "null"] },
              stance: {
                type: "string",
                enum: ["supports", "contradicts", "context", "unclear"]
              }
            }
          }
        },
        whatToCheckNext: { type: "string" },
        safetyAdvice: { type: "string" },
        shareableExplanation: { type: "string" }
      }
    }
  });

  return verifyResultSchema.parse(result);
}

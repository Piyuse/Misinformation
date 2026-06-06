import type { VerifyResult } from "@/lib/schema";

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v24.0";
const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

type WhatsAppMediaMetadata = {
  url?: string;
  mime_type?: string;
};

export type WhatsAppInboundMessage = {
  from: string;
  id?: string;
  type?: string;
  text?: {
    body?: string;
  };
  image?: {
    id?: string;
    mime_type?: string;
  };
  audio?: {
    id?: string;
    mime_type?: string;
  };
  video?: {
    id?: string;
    mime_type?: string;
  };
  document?: {
    id?: string;
    mime_type?: string;
    filename?: string;
  };
};

type WhatsAppWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppInboundMessage[];
      };
    }>;
  }>;
};

function getAccessToken() {
  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    throw new Error("Missing WHATSAPP_ACCESS_TOKEN");
  }

  return process.env.WHATSAPP_ACCESS_TOKEN;
}

function getPhoneNumberId() {
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID");
  }

  return process.env.WHATSAPP_PHONE_NUMBER_ID;
}

export function extractWhatsAppMessages(body: WhatsAppWebhookBody) {
  return (
    body.entry?.flatMap((entry) =>
      entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? []
    ) ?? []
  );
}

export function getMediaId(message: WhatsAppInboundMessage) {
  return message.image?.id || message.audio?.id || message.video?.id || message.document?.id;
}

export function isAudioLikeMessage(message: WhatsAppInboundMessage) {
  return (
    message.type === "audio" ||
    message.audio?.mime_type?.startsWith("audio/") ||
    message.document?.mime_type?.startsWith("audio/")
  );
}

export function isImageLikeMessage(message: WhatsAppInboundMessage) {
  return (
    message.type === "image" ||
    message.image?.mime_type?.startsWith("image/") ||
    message.document?.mime_type?.startsWith("image/")
  );
}

export async function downloadWhatsAppMedia(mediaId: string) {
  const metadataResponse = await fetch(`${GRAPH_API_BASE_URL}/${mediaId}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`
    }
  });

  if (!metadataResponse.ok) {
    throw new Error(`WhatsApp media metadata failed with status ${metadataResponse.status}`);
  }

  const metadata = (await metadataResponse.json()) as WhatsAppMediaMetadata;

  if (!metadata.url) {
    throw new Error("WhatsApp media metadata did not include a download URL.");
  }

  const mediaResponse = await fetch(metadata.url, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`
    }
  });

  if (!mediaResponse.ok) {
    throw new Error(`WhatsApp media download failed with status ${mediaResponse.status}`);
  }

  const bytes = Buffer.from(await mediaResponse.arrayBuffer());

  return {
    bytes,
    mimeType: mediaResponse.headers.get("content-type") || metadata.mime_type || "application/octet-stream"
  };
}

export async function sendWhatsAppText(to: string, body: string) {
  const response = await fetch(`${GRAPH_API_BASE_URL}/${getPhoneNumberId()}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        preview_url: true,
        body
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp reply failed with status ${response.status}: ${detail}`);
  }
}

export function formatWhatsAppResult(result: VerifyResult) {
  const sources = result.evidence
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${item.title}\n${item.url}`)
    .join("\n\n");

  return [
    `Falsify result: ${result.verdict} (${result.confidence} confidence)`,
    result.simpleSummary || result.summary,
    result.safetyAdvice,
    result.whatToCheckNext,
    sources ? `Sources:\n${sources}` : "No strong public evidence was found.",
    `Short reply:\n${result.shareableExplanation}`
  ].join("\n\n");
}

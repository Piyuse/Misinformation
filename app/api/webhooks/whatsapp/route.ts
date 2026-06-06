import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/openai";
import { verifyContent } from "@/lib/verification";
import {
  downloadWhatsAppMedia,
  extractWhatsAppMessages,
  formatWhatsAppResult,
  getMediaId,
  isAudioLikeMessage,
  isImageLikeMessage,
  sendWhatsAppText,
  type WhatsAppInboundMessage
} from "@/lib/whatsapp";

export const runtime = "nodejs";

function getVerifyToken() {
  if (!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    throw new Error("Missing WHATSAPP_WEBHOOK_VERIFY_TOKEN");
  }

  return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
}

function mediaToDataUrl(bytes: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

function mediaToFile(bytes: Buffer, mimeType: string, name: string) {
  const copy = new Uint8Array(bytes);
  return new File([copy], name, { type: mimeType });
}

async function buildVerificationInput(message: WhatsAppInboundMessage) {
  const messageText = message.text?.body;
  const mediaId = getMediaId(message);

  if (!mediaId) {
    return {
      messageText,
      language: "auto" as const
    };
  }

  const media = await downloadWhatsAppMedia(mediaId);

  if (isAudioLikeMessage(message)) {
    const transcript = await transcribeAudio(mediaToFile(media.bytes, media.mimeType, "whatsapp-voice"));

    return {
      messageText,
      transcript,
      language: "auto" as const
    };
  }

  if (isImageLikeMessage(message)) {
    return {
      messageText,
      imageDataUrl: mediaToDataUrl(media.bytes, media.mimeType),
      language: "auto" as const
    };
  }

  return {
    messageText:
      messageText ||
      "The user sent a WhatsApp media message that is not supported yet. Ask for text, image, or voice.",
    language: "auto" as const
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === getVerifyToken() && challenge) {
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook verification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = extractWhatsAppMessages(body);

    await Promise.all(
      messages.map(async (message) => {
        if (!message.from) {
          return;
        }

        const input = await buildVerificationInput(message);
        const result = await verifyContent(input);
        await sendWhatsAppText(message.from, formatWhatsAppResult(result));
      })
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

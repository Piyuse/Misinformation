import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/openai";
import {
  ACCEPTED_AUDIO_TYPES,
  ACCEPTED_IMAGE_TYPES,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  supportedLanguageSchema,
  verifyResultSchema
} from "@/lib/schema";
import { verifyContent } from "@/lib/verification";

export const runtime = "nodejs";

function cleanField(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

async function fileToDataUrl(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Only JPG, PNG, and WebP screenshots are supported.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be smaller than 4 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

function validateAudioFile(file: File) {
  const isAcceptedType = ACCEPTED_AUDIO_TYPES.includes(file.type) || file.type.startsWith("audio/");

  if (!isAcceptedType) {
    throw new Error("Only audio files or MP4 voice clips are supported for voice verification.");
  }

  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error("Voice message must be smaller than 25 MB.");
  }
}

function parseLanguage(languageInput?: string) {
  const languageParse = supportedLanguageSchema.safeParse(languageInput || "auto");
  return languageParse.success ? languageParse.data : "auto";
}

function fileFromBase64({
  base64,
  mimeType,
  name
}: {
  base64: string;
  mimeType: string;
  name: string;
}) {
  const bytes = Buffer.from(base64, "base64");
  return new File([new Uint8Array(bytes)], name, { type: mimeType });
}

function imageDataUrlFromBase64({
  base64,
  mimeType
}: {
  base64: string;
  mimeType: string;
}) {
  if (!ACCEPTED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error("Only JPG, PNG, and WebP screenshots are supported.");
  }

  const bytes = Buffer.from(base64, "base64");

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image must be smaller than 4 MB.");
  }

  return `data:${mimeType};base64,${base64}`;
}

async function handleJsonRequest(request: Request) {
  const body = (await request.json()) as {
    messageText?: string;
    sourceUrl?: string;
    language?: string;
    imageBase64?: string;
    imageMimeType?: string;
    audioBase64?: string;
    audioMimeType?: string;
    audioName?: string;
  };

  const messageText = typeof body.messageText === "string" ? body.messageText.trim() : undefined;
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : undefined;
  const language = parseLanguage(body.language);
  const imageDataUrl =
    body.imageBase64 && body.imageMimeType
      ? imageDataUrlFromBase64({ base64: body.imageBase64, mimeType: body.imageMimeType })
      : undefined;

  let transcript: string | undefined;

  if (body.audioBase64) {
    const audioFile = fileFromBase64({
      base64: body.audioBase64,
      mimeType: body.audioMimeType || "audio/ogg",
      name: body.audioName || "voice-message.ogg"
    });
    validateAudioFile(audioFile);
    transcript = await transcribeAudio(audioFile);
  }

  if (!messageText && !sourceUrl && !imageDataUrl && !transcript) {
    return NextResponse.json(
      {
        error: "Add forwarded text, a source URL, a screenshot, or a voice message to verify."
      },
      { status: 400 }
    );
  }

  const result = await verifyContent({
    messageText,
    sourceUrl,
    imageDataUrl,
    transcript,
    language
  });

  return NextResponse.json(verifyResultSchema.parse(result));
}

async function handleMultipartRequest(request: Request) {
  const formData = await request.formData();
  const messageText = cleanField(formData.get("messageText"));
  const sourceUrl = cleanField(formData.get("sourceUrl"));
  const language = parseLanguage(cleanField(formData.get("language")));
  const image = formData.get("image");
  const audio = formData.get("audio");

  const imageFile = image instanceof File && image.size > 0 ? image : undefined;
  const audioFile = audio instanceof File && audio.size > 0 ? audio : undefined;

  if (!messageText && !sourceUrl && !imageFile && !audioFile) {
    return NextResponse.json(
      {
        error: "Add forwarded text, a source URL, a screenshot, or a voice message to verify."
      },
      { status: 400 }
    );
  }

  const imageDataUrl = imageFile ? await fileToDataUrl(imageFile) : undefined;
  let transcript: string | undefined;

  if (audioFile) {
    validateAudioFile(audioFile);
    transcript = await transcribeAudio(audioFile);
  }

  const result = await verifyContent({
    messageText,
    sourceUrl,
    imageDataUrl,
    transcript,
    language
  });

  return NextResponse.json(verifyResultSchema.parse(result));
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    return contentType.includes("application/json")
      ? await handleJsonRequest(request)
      : await handleMultipartRequest(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    const status =
      message.includes("Missing OPENAI_API_KEY") || message.includes("Missing TAVILY_API_KEY")
        ? 500
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/openai";
import { extractVideoFrameDataUrls } from "@/lib/audio";
import {
  ACCEPTED_AUDIO_TYPES,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
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

function validateVideoFile(file: File) {
  if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    throw new Error("Only MP4 or MOV reels/videos are supported.");
  }

  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Reel/video must be smaller than 25 MB.");
  }
}

async function transcribeVideoIfPossible(file: File) {
  try {
    return await transcribeAudio(file);
  } catch {
    return undefined;
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
    videoBase64?: string;
    videoMimeType?: string;
    videoName?: string;
  };

  const messageText = typeof body.messageText === "string" ? body.messageText.trim() : undefined;
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : undefined;
  const language = parseLanguage(body.language);
  const imageDataUrl =
    body.imageBase64 && body.imageMimeType
      ? imageDataUrlFromBase64({ base64: body.imageBase64, mimeType: body.imageMimeType })
      : undefined;

  let transcript: string | undefined;
  let videoFrameDataUrls: string[] | undefined;
  let mediaType: "text" | "url" | "image" | "audio" | "video" | undefined;

  if (body.audioBase64) {
    const audioFile = fileFromBase64({
      base64: body.audioBase64,
      mimeType: body.audioMimeType || "audio/ogg",
      name: body.audioName || "voice-message.ogg"
    });
    validateAudioFile(audioFile);
    transcript = await transcribeAudio(audioFile);
    mediaType = "audio";
  }

  if (body.videoBase64) {
    const videoFile = fileFromBase64({
      base64: body.videoBase64,
      mimeType: body.videoMimeType || "video/mp4",
      name: body.videoName || "instagram-reel.mp4"
    });
    validateVideoFile(videoFile);
    transcript = (await transcribeVideoIfPossible(videoFile)) ?? transcript;
    videoFrameDataUrls = await extractVideoFrameDataUrls(videoFile);
    mediaType = "video";
  }

  if (!mediaType) {
    mediaType = imageDataUrl ? "image" : sourceUrl ? "url" : "text";
  }

  if (!messageText && !sourceUrl && !imageDataUrl && !transcript && !videoFrameDataUrls?.length) {
    return NextResponse.json(
      {
        error: "Add forwarded text, a source URL, a screenshot, a voice message, or a reel/video to verify."
      },
      { status: 400 }
    );
  }

  const result = await verifyContent({
    messageText,
    sourceUrl,
    imageDataUrl,
    transcript,
    videoFrameDataUrls,
    mediaType,
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
  const video = formData.get("video");

  const imageFile = image instanceof File && image.size > 0 ? image : undefined;
  const audioFile = audio instanceof File && audio.size > 0 ? audio : undefined;
  const videoFile = video instanceof File && video.size > 0 ? video : undefined;

  if (!messageText && !sourceUrl && !imageFile && !audioFile && !videoFile) {
    return NextResponse.json(
      {
        error: "Add forwarded text, a source URL, a screenshot, a voice message, or a reel/video to verify."
      },
      { status: 400 }
    );
  }

  const imageDataUrl = imageFile ? await fileToDataUrl(imageFile) : undefined;
  let transcript: string | undefined;
  let videoFrameDataUrls: string[] | undefined;
  let mediaType: "text" | "url" | "image" | "audio" | "video" =
    imageFile ? "image" : sourceUrl ? "url" : "text";

  if (audioFile) {
    validateAudioFile(audioFile);
    transcript = await transcribeAudio(audioFile);
    mediaType = "audio";
  }

  if (videoFile) {
    validateVideoFile(videoFile);
    transcript = (await transcribeVideoIfPossible(videoFile)) ?? transcript;
    videoFrameDataUrls = await extractVideoFrameDataUrls(videoFile);
    mediaType = "video";
  }

  const result = await verifyContent({
    messageText,
    sourceUrl,
    imageDataUrl,
    transcript,
    videoFrameDataUrls,
    mediaType,
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

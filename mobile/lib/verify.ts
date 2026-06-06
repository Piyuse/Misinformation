import type { SupportedLanguage, VerifyResult } from "@/types/verification";
import * as FileSystem from "expo-file-system/legacy";
import { getVerifyApiUrl } from "./config";

type ReactNativeFile = {
  uri: string;
  name: string;
  type: string;
};

type VerifyInput = {
  messageText?: string;
  sourceUrl?: string;
  language?: SupportedLanguage;
  image?: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
  } | null;
  audio?: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
  } | null;
  video?: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
  } | null;
};

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("quicktime") || mimeType.includes("mov")) {
    return "mov";
  }

  if (mimeType.includes("ogg") || mimeType.includes("opus")) {
    return "ogg";
  }

  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return "mp3";
  }

  if (mimeType.includes("wav")) {
    return "wav";
  }

  if (mimeType.includes("webm")) {
    return "webm";
  }

  if (mimeType.includes("mp4")) {
    return "mp4";
  }

  return "m4a";
}

function normalizeAudioMimeType(mimeType?: string | null) {
  if (!mimeType || mimeType === "application/octet-stream") {
    return "audio/ogg";
  }

  return mimeType;
}

function normalizeVideoMimeType(mimeType?: string | null) {
  if (!mimeType || mimeType === "application/octet-stream") {
    return "video/mp4";
  }

  return mimeType;
}

function makeReactNativeFile({
  uri,
  name,
  type
}: {
  uri: string;
  name?: string | null;
  type?: string | null;
}): ReactNativeFile {
  const fileType = type || "application/octet-stream";
  const safeName = name?.trim() || `shared-file.${extensionForMimeType(fileType)}`;

  return {
    uri,
    name: safeName,
    type: fileType
  };
}

async function readBase64(uri: string) {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64
  });
}

async function readVerifyResponse(response: Response): Promise<VerifyResult> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  let payload: unknown;

  if (contentType.includes("application/json")) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Verification server returned invalid JSON with status ${response.status}.`);
    }
  } else {
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 160);
    throw new Error(
      `Verification server returned ${contentType || "non-JSON"} with status ${response.status}. Check that ${getVerifyApiUrl()} points to /api/verify. ${preview}`
    );
  }

  if (!response.ok) {
    const error = typeof payload === "object" && payload && "error" in payload ? payload.error : null;
    throw new Error(typeof error === "string" ? error : "Verification failed.");
  }

  return payload as VerifyResult;
}

async function verifyWithJson(input: VerifyInput): Promise<VerifyResult> {
  const audioMimeType = normalizeAudioMimeType(input.audio?.mimeType);
  const videoMimeType = normalizeVideoMimeType(input.video?.mimeType);
  const imageMimeType = input.image?.mimeType || "image/jpeg";
  const response = await fetch(getVerifyApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messageText: input.messageText?.trim() || undefined,
      sourceUrl: input.sourceUrl?.trim() || undefined,
      language: input.language || "auto",
      imageBase64: input.image?.uri ? await readBase64(input.image.uri) : undefined,
      imageMimeType: input.image?.uri ? imageMimeType : undefined,
      audioBase64: input.audio?.uri ? await readBase64(input.audio.uri) : undefined,
      audioMimeType: input.audio?.uri ? audioMimeType : undefined,
      audioName: input.audio?.name || `voice-message.${extensionForMimeType(audioMimeType)}`,
      videoBase64: input.video?.uri ? await readBase64(input.video.uri) : undefined,
      videoMimeType: input.video?.uri ? videoMimeType : undefined,
      videoName: input.video?.name || `instagram-reel.${extensionForMimeType(videoMimeType)}`
    })
  });

  return readVerifyResponse(response);
}

export async function verifyMessage(input: VerifyInput): Promise<VerifyResult> {
  if (input.audio?.uri || input.video?.uri) {
    return verifyWithJson(input);
  }

  const formData = new FormData();

  if (input.messageText?.trim()) {
    formData.append("messageText", input.messageText.trim());
  }

  if (input.sourceUrl?.trim()) {
    formData.append("sourceUrl", input.sourceUrl.trim());
  }

  formData.append("language", input.language || "auto");

  if (input.image?.uri) {
    formData.append(
      "image",
      makeReactNativeFile({
        uri: input.image.uri,
        name: input.image.name || "shared-screenshot.jpg",
        type: input.image.mimeType || "image/jpeg"
      }) as never
    );
  }

  if (input.audio?.uri) {
    const mimeType = normalizeAudioMimeType(input.audio.mimeType);

    formData.append(
      "audio",
      makeReactNativeFile({
        uri: input.audio.uri,
        name: input.audio.name || `voice-message.${extensionForMimeType(mimeType)}`,
        type: mimeType
      }) as never
    );
  }

  const response = await fetch(getVerifyApiUrl(), {
    method: "POST",
    body: formData
  });

  return readVerifyResponse(response);
}

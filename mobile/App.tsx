import { useIncomingShare } from "expo-sharing";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { VerifierScreen, type SharedDraft } from "@/components/VerifierScreen";

type SharePayloadLike = {
  contentType?: string;
  contentUri?: string;
  contentMimeType?: string;
  text?: string;
};

function isLikelyAudioShare(contentMimeType?: string, contentUri?: string) {
  const lowerUri = contentUri?.toLowerCase() || "";

  return (
    contentMimeType?.startsWith("audio/") ||
    contentMimeType === "application/octet-stream" ||
    lowerUri.endsWith(".opus") ||
    lowerUri.endsWith(".ogg") ||
    lowerUri.endsWith(".m4a") ||
    lowerUri.endsWith(".mp3") ||
    lowerUri.endsWith(".wav")
  );
}

function isLikelyVideoShare(contentMimeType?: string, contentUri?: string) {
  const lowerUri = contentUri?.toLowerCase() || "";

  return (
    contentMimeType?.startsWith("video/") ||
    lowerUri.endsWith(".mp4") ||
    lowerUri.endsWith(".mov")
  );
}

function firstUrl(text: string) {
  return text.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[.,!?]+$/, "");
}

function isSharePayloadLike(value: unknown): value is SharePayloadLike {
  return typeof value === "object" && value !== null;
}

function draftFromPayloads(payloads: unknown) {
  const draft: SharedDraft = {};

  if (!Array.isArray(payloads)) {
    return draft;
  }

  for (const payload of payloads) {
    if (!isSharePayloadLike(payload)) {
      continue;
    }

    const contentMimeType =
      typeof payload.contentMimeType === "string" ? payload.contentMimeType : undefined;
    const contentUri = typeof payload.contentUri === "string" ? payload.contentUri : undefined;
    const contentType = typeof payload.contentType === "string" ? payload.contentType : undefined;

    if (contentType === "text" && typeof payload.text === "string") {
      draft.messageText = payload.text;

      const url = firstUrl(payload.text);
      if (url?.includes("instagram.com")) {
        draft.sourceUrl = url;
      }
    }

    if (contentType === "website" && contentUri) {
      draft.sourceUrl = contentUri;
    }

    if (contentType === "image" && contentUri) {
      draft.image = {
        uri: contentUri,
        name: "whatsapp-screenshot.jpg",
        mimeType: contentMimeType || "image/jpeg"
      };
    }

    if (contentUri && (contentType === "video" || isLikelyVideoShare(contentMimeType, contentUri))) {
      draft.video = {
        uri: contentUri,
        name: "shared-instagram-reel.mp4",
        mimeType: contentMimeType || "video/mp4"
      };
      continue;
    }

    if (contentUri && (contentType === "file" || isLikelyAudioShare(contentMimeType, contentUri))) {
      draft.audio = {
        uri: contentUri,
        name: "shared-voice-message.m4a",
        mimeType: contentMimeType || "audio/m4a"
      };
    }
  }

  return draft;
}

export default function App() {
  const { resolvedSharedPayloads, isResolving, error } = useIncomingShare();

  if (isResolving) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f6f52" />
        <Text style={styles.text}>Reading shared message</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error.message}</Text>
      </View>
    );
  }

  return <VerifierScreen initialDraft={draftFromPayloads(resolvedSharedPayloads)} />;
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    backgroundColor: "#f7f7f2",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24
  },
  text: {
    color: "#526071",
    fontSize: 15
  },
  error: {
    color: "#b91c1c",
    fontSize: 15,
    textAlign: "center"
  }
});

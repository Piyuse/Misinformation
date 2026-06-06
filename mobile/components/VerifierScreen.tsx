import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ResultCard } from "@/components/ResultCard";
import { verifyMessage } from "@/lib/verify";
import type { SupportedLanguage, VerifyResult } from "@/types/verification";

const languageOptions: Array<{ label: string; value: SupportedLanguage }> = [
  { label: "Auto", value: "auto" },
  { label: "English", value: "english" },
  { label: "Hindi", value: "hindi" },
  { label: "Tamil", value: "tamil" },
  { label: "Telugu", value: "telugu" },
  { label: "Malayalam", value: "malayalam" },
  { label: "Kannada", value: "kannada" },
  { label: "Bengali", value: "bengali" },
  { label: "Marathi", value: "marathi" },
  { label: "Gujarati", value: "gujarati" },
  { label: "Punjabi", value: "punjabi" },
  { label: "Urdu", value: "urdu" }
];

function extensionForMimeType(mimeType?: string | null) {
  if (mimeType?.includes("ogg") || mimeType?.includes("opus")) {
    return "ogg";
  }

  if (mimeType?.includes("mpeg") || mimeType?.includes("mp3")) {
    return "mp3";
  }

  if (mimeType?.includes("wav")) {
    return "wav";
  }

  if (mimeType?.includes("webm")) {
    return "webm";
  }

  if (mimeType?.includes("mp4")) {
    return "mp4";
  }

  return "m4a";
}

async function cacheSharedAudioFile(file: NonNullable<SharedDraft["audio"]>) {
  if (file.uri.startsWith("file://")) {
    return file;
  }

  const mimeType =
    !file.mimeType || file.mimeType === "application/octet-stream" ? "audio/ogg" : file.mimeType;
  const extension = extensionForMimeType(mimeType);
  const targetUri = `${FileSystem.cacheDirectory}falsify-voice-${Date.now()}.${extension}`;

  await FileSystem.copyAsync({
    from: file.uri,
    to: targetUri
  });

  return {
    uri: targetUri,
    name: file.name || `voice-message.${extension}`,
    mimeType
  };
}

export type SharedDraft = {
  messageText?: string;
  sourceUrl?: string;
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
};

export function VerifierScreen({ initialDraft }: { initialDraft?: SharedDraft }) {
  const [messageText, setMessageText] = useState(initialDraft?.messageText ?? "");
  const [sourceUrl, setSourceUrl] = useState(initialDraft?.sourceUrl ?? "");
  const [image, setImage] = useState<SharedDraft["image"]>(initialDraft?.image ?? null);
  const [audio, setAudio] = useState<SharedDraft["audio"]>(initialDraft?.audio ?? null);
  const [language, setLanguage] = useState<SupportedLanguage>("auto");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function pasteClipboard() {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setMessageText(text);
    }
  }

  async function pickImage() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85
    });

    if (!picked.canceled && picked.assets[0]) {
      setImage({
        uri: picked.assets[0].uri,
        name: picked.assets[0].fileName ?? "screenshot.jpg",
        mimeType: picked.assets[0].mimeType ?? "image/jpeg"
      });
    }
  }

  async function pickFileImage() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "image/webp"],
      multiple: false,
      copyToCacheDirectory: true
    });

    if (!picked.canceled && picked.assets[0]) {
      setImage({
        uri: picked.assets[0].uri,
        name: picked.assets[0].name,
        mimeType: picked.assets[0].mimeType
      });
    }
  }

  async function pickAudio() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["audio/*", "video/mp4"],
      multiple: false,
      copyToCacheDirectory: true
    });

    if (!picked.canceled && picked.assets[0]) {
      setAudio({
        uri: picked.assets[0].uri,
        name: picked.assets[0].name,
        mimeType: picked.assets[0].mimeType
      });
    }
  }

  async function submit() {
    setError("");
    setResult(null);
    setIsLoading(true);

    try {
      const cachedAudio = audio ? await cacheSharedAudioFile(audio) : null;
      const response = await verifyMessage({
        messageText,
        sourceUrl,
        image,
        audio: cachedAudio,
        language
      });
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Verification failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <View style={styles.logo}>
                <MaterialCommunityIcons name="shield-search" color="#ffffff" size={28} />
              </View>
              <View>
                <Text style={styles.brand}>FALSIFY</Text>
                <Text style={styles.title}>Check forwarded news before sharing.</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              Share WhatsApp, Instagram, screenshots, or voice messages to Falsify and get a
              simple explanation in your language.
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.label}>Explanation language</Text>
            <ScrollView
              contentContainerStyle={styles.languageRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {languageOptions.map((option) => {
                const isSelected = option.value === language;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setLanguage(option.value)}
                    style={[styles.languageChip, isSelected ? styles.languageChipActive : null]}
                  >
                    <Text
                      style={[
                        styles.languageText,
                        isSelected ? styles.languageTextActive : null
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Forwarded message</Text>
            <TextInput
              multiline
              onChangeText={setMessageText}
              placeholder="Paste or forward the claim, caption, or message text."
              placeholderTextColor="#94a3b8"
              style={styles.textArea}
              value={messageText}
            />

            <View style={styles.actionGrid}>
              <Pressable onPress={pasteClipboard} style={styles.secondaryButton}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={19} color="#14213d" />
                <Text style={styles.secondaryText}>Paste</Text>
              </Pressable>
              <Pressable onPress={pickImage} style={styles.secondaryButton}>
                <MaterialCommunityIcons name="image-plus" size={19} color="#14213d" />
                <Text style={styles.secondaryText}>Gallery</Text>
              </Pressable>
              <Pressable onPress={pickFileImage} style={styles.secondaryButton}>
                <MaterialCommunityIcons name="file-image" size={19} color="#14213d" />
                <Text style={styles.secondaryText}>Files</Text>
              </Pressable>
              <Pressable onPress={pickAudio} style={styles.secondaryButton}>
                <MaterialCommunityIcons name="microphone-plus" size={19} color="#14213d" />
                <Text style={styles.secondaryText}>Voice</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Source link</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="url"
              onChangeText={setSourceUrl}
              placeholder="https://example.com/post-or-article"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={sourceUrl}
            />

            {image ? (
              <View style={styles.imagePreview}>
                <Image source={{ uri: image.uri }} style={styles.previewThumb} />
                <View style={styles.imageMeta}>
                  <Text numberOfLines={1} style={styles.imageName}>
                    {image.name || "Shared screenshot"}
                  </Text>
                  <Text style={styles.imageType}>{image.mimeType || "image"}</Text>
                </View>
                <Pressable onPress={() => setImage(null)} style={styles.iconButton}>
                  <MaterialCommunityIcons name="close" size={20} color="#14213d" />
                </Pressable>
              </View>
            ) : null}

            {audio ? (
              <View style={styles.filePreview}>
                <View style={styles.fileIcon}>
                  <MaterialCommunityIcons name="waveform" size={24} color="#4f6f52" />
                </View>
                <View style={styles.imageMeta}>
                  <Text numberOfLines={1} style={styles.imageName}>
                    {audio.name || "Shared voice message"}
                  </Text>
                  <Text style={styles.imageType}>{audio.mimeType || "audio"}</Text>
                </View>
                <Pressable onPress={() => setAudio(null)} style={styles.iconButton}>
                  <MaterialCommunityIcons name="close" size={20} color="#14213d" />
                </Pressable>
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable disabled={isLoading} onPress={submit} style={styles.primaryButton}>
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <MaterialCommunityIcons name="magnify-scan" color="#ffffff" size={21} />
              )}
              <Text style={styles.primaryText}>
                {isLoading ? "Checking evidence" : "Verify credibility"}
              </Text>
            </Pressable>
          </View>

          {result ? <ResultCard result={result} /> : null}

          <Text style={styles.disclaimer}>
            Falsify gives an evidence-based reading of public sources. It is not an absolute
            certification of truth, legal advice, or a substitute for editorial review.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: "#f7f7f2",
    flex: 1
  },
  keyboard: {
    flex: 1
  },
  scroll: {
    gap: 16,
    padding: 16,
    paddingBottom: 32
  },
  hero: {
    gap: 14,
    paddingTop: 8
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  logo: {
    alignItems: "center",
    backgroundColor: "#14213d",
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  brand: {
    color: "#4f6f52",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2
  },
  title: {
    color: "#14213d",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31,
    maxWidth: 310
  },
  subtitle: {
    color: "#526071",
    fontSize: 15,
    lineHeight: 22
  },
  panel: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "rgba(20,33,61,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  label: {
    color: "#14213d",
    fontSize: 13,
    fontWeight: "800"
  },
  languageRow: {
    gap: 8,
    paddingBottom: 2
  },
  languageChip: {
    alignItems: "center",
    backgroundColor: "#f7f7f2",
    borderColor: "rgba(20,33,61,0.12)",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  languageChipActive: {
    backgroundColor: "#14213d",
    borderColor: "#14213d"
  },
  languageText: {
    color: "#14213d",
    fontSize: 13,
    fontWeight: "800"
  },
  languageTextActive: {
    color: "#ffffff"
  },
  textArea: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(20,33,61,0.15)",
    borderRadius: 8,
    borderWidth: 1,
    color: "#14213d",
    minHeight: 142,
    padding: 13,
    textAlignVertical: "top"
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(20,33,61,0.15)",
    borderRadius: 8,
    borderWidth: 1,
    color: "#14213d",
    height: 48,
    paddingHorizontal: 13
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#f7f7f2",
    borderColor: "rgba(20,33,61,0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
    minWidth: "47%"
  },
  secondaryText: {
    color: "#14213d",
    fontSize: 13,
    fontWeight: "800"
  },
  imagePreview: {
    alignItems: "center",
    backgroundColor: "#f7f7f2",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    padding: 10
  },
  filePreview: {
    alignItems: "center",
    backgroundColor: "#eef2e8",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    padding: 10
  },
  fileIcon: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    height: 54,
    justifyContent: "center",
    width: 54
  },
  previewThumb: {
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    height: 54,
    width: 54
  },
  imageMeta: {
    flex: 1
  },
  imageName: {
    color: "#14213d",
    fontWeight: "800"
  },
  imageType: {
    color: "#64748b",
    fontSize: 12
  },
  iconButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#4f6f52",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    height: 50,
    justifyContent: "center"
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 8,
    borderWidth: 1,
    color: "#b91c1c",
    lineHeight: 20,
    padding: 12
  },
  disclaimer: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderRadius: 8,
    borderWidth: 1,
    color: "#526071",
    fontSize: 13,
    lineHeight: 20,
    padding: 14
  }
});

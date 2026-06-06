import Constants from "expo-constants";

const fallbackUrl =
  Constants.expoConfig?.extra?.verifyApiUrl ?? "http://localhost:3000/api/verify";

export function getVerifyApiUrl() {
  return process.env.EXPO_PUBLIC_VERIFY_API_URL || fallbackUrl;
}

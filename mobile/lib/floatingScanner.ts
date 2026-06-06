import { NativeModules, Platform } from "react-native";

type FloatingScannerModule = {
  hasOverlayPermission: () => Promise<boolean>;
  openOverlaySettings: () => void;
  startFloatingScanner: () => Promise<boolean>;
  stopFloatingScanner: () => Promise<boolean>;
};

const nativeModule = NativeModules.FloatingScanner as FloatingScannerModule | undefined;

export const isFloatingScannerAvailable = Platform.OS === "android" && Boolean(nativeModule);

export async function hasOverlayPermission() {
  return nativeModule ? nativeModule.hasOverlayPermission() : false;
}

export function openOverlaySettings() {
  nativeModule?.openOverlaySettings();
}

export async function startFloatingScanner() {
  if (!nativeModule) {
    throw new Error("Floating scanner is available only in the Android dev build.");
  }

  return nativeModule.startFloatingScanner();
}

export async function stopFloatingScanner() {
  return nativeModule?.stopFloatingScanner() ?? false;
}

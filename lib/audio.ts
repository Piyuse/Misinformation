import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

function getFfmpegPath() {
  return process.env.FFMPEG_PATH || ffmpegPath;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("ogg") || mimeType.includes("opus")) {
    return "ogg";
  }

  if (mimeType.includes("webm")) {
    return "webm";
  }

  if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
    return "m4a";
  }

  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return "mp3";
  }

  if (mimeType.includes("wav")) {
    return "wav";
  }

  return "ogg";
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const binaryPath = getFfmpegPath();

    if (!binaryPath) {
      reject(new Error("FFmpeg binary is not available."));
      return;
    }

    const child = spawn(binaryPath, args, {
      windowsHide: true
    });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`FFmpeg conversion failed with code ${code}: ${stderr}`));
    });
  });
}

export async function convertAudioToWav(file: File) {
  const workDir = path.join(tmpdir(), `falsify-audio-${randomUUID()}`);
  const inputPath = path.join(workDir, `input.${extensionForMimeType(file.type)}`);
  const outputPath = path.join(workDir, "output.wav");

  await mkdir(workDir, { recursive: true });

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, bytes);
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      outputPath
    ]);

    const output = await readFile(outputPath);
    return new File([new Uint8Array(output)], "converted-voice.wav", {
      type: "audio/wav"
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

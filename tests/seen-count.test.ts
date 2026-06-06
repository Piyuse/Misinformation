import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SeenCountStore,
  buildSimilarityKey,
  fingerprintMessage,
  normalizeMessageForExactHash,
  viralRiskFor
} from "@/lib/seen-count";

const metadata = {
  hasLink: false,
  hasAudio: false,
  hasImage: false,
  detectedLanguage: "English"
};

describe("seen count fingerprints", () => {
  it("normalizes spacing and casing for exact hashes", () => {
    const first = fingerprintMessage("  FREE Recharge   For Everyone ");
    const second = fingerprintMessage("free recharge for everyone");

    expect(normalizeMessageForExactHash("  FREE Recharge   For Everyone ")).toBe(
      "free recharge for everyone"
    );
    expect(first.exactMessageHash).toBe(second.exactMessageHash);
  });

  it("keeps small wording changes in the same similarity group", () => {
    const first = buildSimilarityKey("Government is giving free recharge today. Share quickly.");
    const second = buildSimilarityKey("Govt giving free recharge today, please forward quickly.");

    expect(first).toBe(second);
  });

  it("keeps unrelated messages out of common similarity groups", () => {
    const first = buildSimilarityKey("Government is giving free recharge today.");
    const second = buildSimilarityKey("School holiday announced due to heavy rain.");

    expect(first).not.toBe(second);
  });
});

describe("seen count store", () => {
  function withStore(test: (store: SeenCountStore) => void) {
    const dir = mkdtempSync(path.join(tmpdir(), "falsify-seen-test-"));
    const store = new SeenCountStore(path.join(dir, "seen.sqlite"));

    try {
      test(store);
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("creates count 1 on first submission", () => {
    withStore((store) => {
      const seen = store.recordSeen("Free recharge for everyone", metadata);

      expect(seen.seenCount).toBe(1);
      expect(seen.similarSeenCount).toBe(1);
      expect(seen.viralRiskLevel).toBe("low");
    });
  });

  it("increments exact count for repeated submissions", () => {
    withStore((store) => {
      store.recordSeen("Free recharge for everyone", metadata);
      const seen = store.recordSeen("free recharge for everyone", metadata);

      expect(seen.seenCount).toBe(2);
      expect(seen.similarSeenCount).toBe(2);
    });
  });

  it("increments similar group count for small edits", () => {
    withStore((store) => {
      store.recordSeen("Government is giving free recharge today. Share quickly.", metadata);
      const seen = store.recordSeen(
        "Govt giving free recharge today, please forward quickly.",
        metadata
      );

      expect(seen.seenCount).toBe(1);
      expect(seen.similarSeenCount).toBe(2);
    });
  });

  it("maps repetition thresholds to viral risk", () => {
    expect(viralRiskFor(4, 4)).toBe("low");
    expect(viralRiskFor(20, 20)).toBe("medium");
    expect(viralRiskFor(1, 100)).toBe("medium");
    expect(viralRiskFor(1, 200)).toBe("high");
  });
});

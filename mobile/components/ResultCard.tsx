import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import type { SafetyStatus, VerifyResult, Verdict } from "@/types/verification";

const verdictColors: Record<Verdict, { bg: string; border: string; text: string; icon: string }> = {
  Supported: { bg: "#ecfdf5", border: "#a7f3d0", text: "#047857", icon: "check-circle" },
  False: { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c", icon: "close-circle" },
  Misleading: { bg: "#fffbeb", border: "#fde68a", text: "#b45309", icon: "alert-circle" },
  Unverified: { bg: "#f8fafc", border: "#cbd5e1", text: "#334155", icon: "help-circle" }
};

const safetyColors: Record<SafetyStatus, { bg: string; border: string; text: string; icon: string }> = {
  Safe: { bg: "#ecfdf5", border: "#a7f3d0", text: "#047857", icon: "shield-check" },
  Suspicious: { bg: "#fffbeb", border: "#fde68a", text: "#b45309", icon: "shield-alert" },
  "Likely Scam": { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c", icon: "shield-off" }
};

export function ResultCard({ result }: { result: VerifyResult }) {
  const tone = verdictColors[result.verdict];
  const safetyStatus = result.safetyStatus || "Suspicious";
  const safetyTone = safetyColors[safetyStatus];
  const shareText = [
    `Digital Safety Agent: ${safetyStatus}`,
    `Verification: ${result.verdict} (${result.confidence} confidence)`,
    result.reelAnalysis ? `Reel/video: ${result.reelAnalysis}` : undefined,
    result.seenCountLabel,
    result.shareableExplanation || result.simpleSummary || result.summary,
    result.safetyAdvice
  ]
    .filter(Boolean)
    .join("\n\n");

  async function shareResult() {
    await Share.share({
      message: shareText
    });
  }

  return (
    <View style={styles.card}>
      <View style={[styles.agentBanner, { backgroundColor: safetyTone.bg, borderColor: safetyTone.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: "#ffffff", borderColor: safetyTone.border }]}>
          <MaterialCommunityIcons name={safetyTone.icon as never} size={30} color={safetyTone.text} />
        </View>
        <View style={styles.agentMeta}>
          <Text style={[styles.label, { color: safetyTone.text }]}>Digital Safety Agent</Text>
          <Text style={[styles.agentDecision, { color: safetyTone.text }]}>{safetyStatus}</Text>
        </View>
      </View>

      <Text style={styles.summary}>{result.agentDecision || result.simpleSummary || result.summary}</Text>

      {typeof result.seenCount === "number" || typeof result.similarSeenCount === "number" ? (
        <View
          style={[
            styles.seenBox,
            result.viralRiskLevel === "high"
              ? styles.seenBoxHigh
              : result.viralRiskLevel === "medium"
                ? styles.seenBoxMedium
                : null
          ]}
        >
          <Text style={styles.sectionTitle}>How often this was seen</Text>
          <Text style={styles.evidenceSnippet}>
            Exact message checked: {result.seenCount ?? 0} time{result.seenCount === 1 ? "" : "s"}
          </Text>
          <Text style={styles.evidenceSnippet}>
            Similar messages checked: {result.similarSeenCount ?? result.seenCount ?? 0} time
            {(result.similarSeenCount ?? result.seenCount) === 1 ? "" : "s"}
          </Text>
          {result.seenCountLabel ? (
            <Text style={styles.seenLabel}>{result.seenCountLabel}</Text>
          ) : null}
          {result.viralRiskLevel === "high" || result.viralRiskLevel === "medium" ? (
            <Text style={styles.seenWarning}>This appears to be a widely forwarded message.</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.header}>
        <View style={[styles.smallIconWrap, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <MaterialCommunityIcons name={tone.icon as never} size={22} color={tone.text} />
        </View>
        <View>
          <Text style={styles.label}>Claim verification</Text>
          <Text style={[styles.verdict, { color: tone.text }]}>{result.verdict}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.confidence}>{result.confidence.toUpperCase()} confidence</Text>
        <Text style={styles.language}>{result.detectedLanguage}</Text>
      </View>
      <Text style={styles.safety}>{result.safetyAdvice}</Text>

      {result.mediaType === "video" || result.reelAnalysis ? (
        <View style={styles.reelBox}>
          <Text style={styles.sectionTitle}>Reel / video analysis</Text>
          <Text style={styles.evidenceSnippet}>
            {result.reelAnalysis ||
              "The reel link was checked, but the video itself was not available for inspection."}
          </Text>
          {result.mediaConfidence ? (
            <Text style={styles.stance}>{result.mediaConfidence} media confidence</Text>
          ) : null}
        </View>
      ) : null}

      {result.instagramPreview ? (
        <View style={styles.instagramBox}>
          <Text style={styles.sectionTitle}>Instagram preview</Text>
          <Text style={styles.evidenceSnippet}>
            {result.instagramPreview.unavailableReason ||
              "Basic public Instagram preview metadata was available."}
          </Text>
          {result.instagramPreview.authorName ? (
            <Text style={styles.evidenceSnippet}>
              Author: {result.instagramPreview.authorName}
            </Text>
          ) : null}
          {result.instagramPreview.title ? (
            <Text style={styles.evidenceSnippet}>Title: {result.instagramPreview.title}</Text>
          ) : null}
          {result.instagramPreview.thumbnailUrl ? (
            <Pressable
              onPress={() => Linking.openURL(result.instagramPreview?.thumbnailUrl || "")}
              style={styles.previewLink}
            >
              <MaterialCommunityIcons name="image-search" size={18} color="#14213d" />
              <Text style={styles.previewLinkText}>Open preview thumbnail</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {result.manipulationSignals && result.manipulationSignals.length > 0 ? (
        <View style={styles.mediaWarningBox}>
          <Text style={styles.sectionTitle}>Possible media caution signs</Text>
          {result.manipulationSignals.map((signal) => (
            <Text style={styles.evidenceSnippet} key={signal}>
              {signal}
            </Text>
          ))}
        </View>
      ) : null}

      {result.agentChecks ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agent checks</Text>
          <Text style={styles.checkItem}>{result.agentChecks.claimVerification}</Text>
          <Text style={styles.checkItem}>{result.agentChecks.scamDetection}</Text>
          <Text style={styles.checkItem}>{result.agentChecks.linkAnalysis}</Text>
          <Text style={styles.checkItem}>{result.agentChecks.misinformationCheck}</Text>
        </View>
      ) : null}

      {result.scamSignals && result.scamSignals.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Warning signs</Text>
          {result.scamSignals.map((signal) => (
            <Text style={styles.claim} key={signal}>
              {signal}
            </Text>
          ))}
        </View>
      ) : null}

      {result.linkFindings && result.linkFindings.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Link analysis</Text>
          {result.linkFindings.map((link) => (
            <Pressable key={link.url} onPress={() => Linking.openURL(link.url)} style={styles.evidence}>
              <Text style={styles.evidenceTitle}>{link.risk.toUpperCase()} risk link</Text>
              <Text style={styles.evidenceSnippet}>{link.reason}</Text>
              <Text style={styles.stance}>{link.url}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {result.transcript ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {result.mediaType === "video" ? "Reel audio heard" : "Voice text heard"}
          </Text>
          <Text style={styles.transcript}>{result.transcript}</Text>
        </View>
      ) : null}

      {result.frameFindings && result.frameFindings.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Video frames checked</Text>
          {result.frameFindings.map((finding) => (
            <View style={styles.evidence} key={finding.frameNumber}>
              <Text style={styles.evidenceTitle}>Frame {finding.frameNumber}</Text>
              {finding.visibleText ? (
                <Text style={styles.evidenceSnippet}>Visible text: {finding.visibleText}</Text>
              ) : null}
              <Text style={styles.evidenceSnippet}>{finding.sceneSummary}</Text>
              {finding.suspiciousSignals && finding.suspiciousSignals.length > 0 ? (
                <Text style={styles.stance}>{finding.suspiciousSignals.join("; ")}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {result.claims.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Claims checked</Text>
          {result.claims.map((claim) => (
            <Text style={styles.claim} key={claim}>
              {claim}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Evidence</Text>
        {result.evidence.length > 0 ? (
          result.evidence.map((item) => (
            <Pressable
              key={item.url}
              onPress={() => Linking.openURL(item.url)}
              style={styles.evidence}
            >
              <Text style={styles.evidenceTitle}>{item.title}</Text>
              <Text style={styles.evidenceSnippet}>{item.snippet}</Text>
              <Text style={styles.stance}>{item.stance}</Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyEvidence}>No strong public evidence was found.</Text>
        )}
      </View>

      <View style={styles.nextBox}>
        <Text style={styles.sectionTitle}>What to check next</Text>
        <Text style={styles.evidenceSnippet}>{result.whatToCheckNext}</Text>
      </View>

      <View style={styles.shareBox}>
        <Text style={styles.sectionTitle}>Message to share back</Text>
        <Text style={styles.evidenceSnippet}>{result.shareableExplanation}</Text>
      </View>

      <Pressable onPress={shareResult} style={styles.shareButton}>
        <MaterialCommunityIcons name="share-variant" size={20} color="#ffffff" />
        <Text style={styles.shareButtonText}>Share result back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "rgba(20,33,61,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  agentBanner: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12
  },
  agentMeta: {
    flex: 1
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  smallIconWrap: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  label: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700"
  },
  verdict: {
    fontSize: 22,
    fontWeight: "800"
  },
  agentDecision: {
    fontSize: 29,
    fontWeight: "800"
  },
  confidence: {
    backgroundColor: "#eef2e8",
    borderRadius: 999,
    color: "#4f6f52",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  language: {
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  summary: {
    color: "#26324f",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 27
  },
  safety: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderRadius: 8,
    borderWidth: 1,
    color: "#9a3412",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
    padding: 12
  },
  reelBox: {
    backgroundColor: "#eef4ff",
    borderColor: "#bfdbfe",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  mediaWarningBox: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  instagramBox: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  previewLink: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(20,33,61,0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12
  },
  previewLinkText: {
    color: "#14213d",
    fontSize: 14,
    fontWeight: "800"
  },
  seenBox: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12
  },
  seenBoxMedium: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a"
  },
  seenBoxHigh: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca"
  },
  seenLabel: {
    color: "#14213d",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 21
  },
  seenWarning: {
    color: "#b45309",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 21
  },
  section: {
    gap: 8
  },
  sectionTitle: {
    color: "#4f6f52",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  claim: {
    backgroundColor: "#f7f7f2",
    borderRadius: 8,
    color: "#14213d",
    fontSize: 14,
    lineHeight: 21,
    padding: 12
  },
  checkItem: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
    padding: 12
  },
  transcript: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
    padding: 12
  },
  evidence: {
    borderColor: "rgba(20,33,61,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  evidenceTitle: {
    color: "#14213d",
    fontSize: 15,
    fontWeight: "800"
  },
  evidenceSnippet: {
    color: "#526071",
    fontSize: 14,
    lineHeight: 21
  },
  stance: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: "capitalize"
  },
  emptyEvidence: {
    backgroundColor: "#f7f7f2",
    borderRadius: 8,
    color: "#64748b",
    padding: 12
  },
  nextBox: {
    backgroundColor: "#f7f7f2",
    borderRadius: 8,
    gap: 6,
    padding: 12
  },
  shareBox: {
    backgroundColor: "#eef2e8",
    borderRadius: 8,
    gap: 6,
    padding: 12
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: "#14213d",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48
  },
  shareButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  }
});

"use client";

import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileImage,
  History,
  LinkIcon,
  Loader2,
  SearchCheck,
  ShieldQuestion,
  Upload,
  XCircle
} from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import type { VerifyResult, Verdict } from "@/lib/schema";

const verdictTone: Record<Verdict, string> = {
  Supported: "border-emerald-200 bg-emerald-50 text-emerald-800",
  False: "border-red-200 bg-red-50 text-red-800",
  Misleading: "border-amber-200 bg-amber-50 text-amber-800",
  Unverified: "border-slate-200 bg-slate-50 text-slate-800"
};

const verdictIcon: Record<Verdict, typeof CheckCircle2> = {
  Supported: CheckCircle2,
  False: XCircle,
  Misleading: AlertCircle,
  Unverified: ShieldQuestion
};

type RecentCheck = Pick<VerifyResult, "verdict" | "summary"> & {
  checkedAt: string;
};

export default function Home() {
  const [messageText, setMessageText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [recent, setRecent] = useState<RecentCheck[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageLabel = useMemo(() => {
    if (!image) {
      return "Upload screenshot";
    }

    return image.name.length > 28 ? `${image.name.slice(0, 25)}...` : image.name;
  }, [image]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      if (messageText.trim()) {
        formData.set("messageText", messageText.trim());
      }
      if (sourceUrl.trim()) {
        formData.set("sourceUrl", sourceUrl.trim());
      }
      if (image) {
        formData.set("image", image);
      }

      const response = await fetch("/api/verify", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Verification failed.");
      }

      setResult(payload);
      setRecent((checks) => [
        {
          verdict: payload.verdict,
          summary: payload.summary,
          checkedAt: new Intl.DateTimeFormat("en", {
            hour: "numeric",
            minute: "2-digit"
          }).format(new Date())
        },
        ...checks
      ].slice(0, 3));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Verification failed.");
    } finally {
      setIsLoading(false);
    }
  }

  const VerdictIcon = result ? verdictIcon[result.verdict] : SearchCheck;

  return (
    <main className="min-h-screen px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <section className="flex min-h-[calc(100vh-3rem)] flex-col justify-between rounded-[8px] border border-ink/10 bg-white/82 p-5 shadow-panel backdrop-blur sm:p-7">
          <div>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-[8px] bg-ink text-white">
                  <SearchCheck className="size-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sage">
                    Falsify
                  </p>
                  <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
                    Verify forwarded news before it travels further.
                  </h1>
                </div>
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Forwarded message</span>
                <textarea
                  className="min-h-44 w-full rounded-[8px] border border-ink/15 bg-white p-4 text-base outline-none transition focus:border-sage focus:ring-4 focus:ring-sage/15"
                  placeholder="Paste the forwarded claim, caption, or message text here."
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <LinkIcon className="size-4" aria-hidden="true" />
                  Source link
                </span>
                <input
                  className="h-12 w-full rounded-[8px] border border-ink/15 bg-white px-4 outline-none transition focus:border-sage focus:ring-4 focus:ring-sage/15"
                  placeholder="https://example.com/post-or-article"
                  type="url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                />
              </label>

              <div>
                <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <FileImage className="size-4" aria-hidden="true" />
                  Screenshot
                </span>
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                />
                <button
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-ink/25 bg-white px-4 text-sm font-semibold transition hover:border-sage hover:bg-sage/5"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload a JPG, PNG, or WebP screenshot"
                >
                  <Upload className="size-4" aria-hidden="true" />
                  {imageLabel}
                </button>
              </div>

              {error ? (
                <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

              <button
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-sage px-5 text-sm font-bold text-white transition hover:bg-sage/90 disabled:cursor-not-allowed disabled:bg-slate-400"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <SearchCheck className="size-5" aria-hidden="true" />
                )}
                {isLoading ? "Checking evidence" : "Verify message"}
              </button>
            </form>
          </div>

          <p className="mt-6 rounded-[8px] border border-signal/20 bg-signal/10 p-4 text-sm leading-6 text-ink/80">
            Falsify gives an evidence-based reading of public sources. It is not an
            absolute certification of truth, legal advice, or a substitute for editorial review.
          </p>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[8px] border border-ink/10 bg-white/88 p-5 shadow-panel backdrop-blur sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`grid size-11 place-items-center rounded-[8px] border ${
                  result ? verdictTone[result.verdict] : "border-ink/10 bg-paper text-ink"
                }`}
              >
                <VerdictIcon className="size-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink/60">Verdict</p>
                <h2 className="text-2xl font-semibold">{result?.verdict ?? "Ready to check"}</h2>
              </div>
            </div>

            {result ? (
              <div className="space-y-5">
                <div
                  className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${
                    verdictTone[result.verdict]
                  }`}
                >
                  {result.confidence.toUpperCase()} confidence
                </div>
                <p className="text-base leading-7 text-ink/82">{result.summary}</p>

                {result.claims.length > 0 ? (
                  <div>
                    <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-sage">
                      Claims checked
                    </h3>
                    <ul className="space-y-2">
                      {result.claims.map((claim) => (
                        <li className="rounded-[8px] bg-paper p-3 text-sm leading-6" key={claim}>
                          {claim}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-sage">
                    Evidence
                  </h3>
                  {result.evidence.length > 0 ? (
                    <div className="space-y-3">
                      {result.evidence.map((item) => (
                        <a
                          className="block rounded-[8px] border border-ink/10 p-4 transition hover:border-sage hover:bg-sage/5"
                          href={item.url}
                          key={item.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <span className="text-sm font-bold leading-5">{item.title}</span>
                            <ExternalLink className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          </div>
                          <p className="text-sm leading-6 text-ink/70">{item.snippet}</p>
                          <span className="mt-3 inline-flex rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold capitalize text-ink/70">
                            {item.stance}
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-[8px] bg-paper p-3 text-sm text-ink/70">
                      No strong public evidence was found for this check.
                    </p>
                  )}
                </div>

                <div className="rounded-[8px] border border-ink/10 bg-paper p-4">
                  <h3 className="mb-1 text-sm font-bold">What to check next</h3>
                  <p className="text-sm leading-6 text-ink/75">{result.whatToCheckNext}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm leading-6 text-ink/70">
                <p>
                  Paste text, add a link, or upload a screenshot. The app extracts checkable
                  claims, searches public sources, and returns a cited result.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[8px] bg-paper p-3">
                    <p className="font-bold text-ink">Input</p>
                    <p>Text, URLs, screenshots</p>
                  </div>
                  <div className="rounded-[8px] bg-paper p-3">
                    <p className="font-bold text-ink">Output</p>
                    <p>Verdict with sources</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[8px] border border-ink/10 bg-white/88 p-5 shadow-panel backdrop-blur sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <History className="size-5 text-sage" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Recent checks</h2>
            </div>
            {recent.length > 0 ? (
              <div className="space-y-3">
                {recent.map((item, index) => (
                  <div className="rounded-[8px] bg-paper p-3" key={`${item.checkedAt}-${index}`}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">{item.verdict}</span>
                      <span className="text-xs text-ink/55">{item.checkedAt}</span>
                    </div>
                    <p className="line-clamp-2 text-sm leading-6 text-ink/70">{item.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-ink/65">
                Checks from this browser session will appear here.
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

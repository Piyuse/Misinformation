# Falsify

Falsify is a Next.js web app that checks forwarded messages, links, and screenshots against public evidence.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key
OPENAI_MODEL=gpt-5.4
```

3. Run the app:

```bash
npm run dev
```

Open http://localhost:3000.

## Verification Flow

- Users paste text, paste a source URL, or upload a JPG/PNG/WebP screenshot.
- OpenAI extracts up to three factual claims.
- Tavily searches public web evidence for each claim.
- OpenAI compares the evidence and returns a structured verdict with citations.

Verdicts are evidence-based: `Supported`, `False`, `Misleading`, or `Unverified`.

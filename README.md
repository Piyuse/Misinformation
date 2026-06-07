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

<h1>Problem Statement</h1>
Senior citizens often struggle to identify scams, phishing attempts, and misinformation circulating through WhatsApp and Instagram. Our solution provides an AI-powered Digital Safety Agent that investigates shared content and delivers simple, trustworthy verification before users act on it.

<h1>Solution</h1>
The solution is an AI-powered Digital Safety Agent for senior citizens.

Users can share suspicious WhatsApp messages, Instagram links, screenshots, voice notes, or videos directly to the application using the device’s Share button. Once the content reaches the app, the agent analyzes it through multiple verification steps instead of simply giving a chatbot-style reply.

<H1>Features</H1>
User can check the fact of a link,poster,message(text),voice with multilanguage suppport.
Codex Usage

TechStack:
React Native
Next js route(backend)
SQLite/local data store for seen-count style tracking

<img width="540" height="1200" alt="WhatsApp Image 2026-06-07 at 4 34 34 AM" src="https://github.com/user-attachments/assets/d145b007-0a11-444d-993b-9bdfe710d6b3" />


# Falsify Mobile

Expo React Native app for checking forwarded WhatsApp, Instagram, screenshots, and voice messages.

## How it works

- The mobile app receives shared text, links, screenshots, and voice/audio files through `expo-sharing`.
- It sends the content to the existing Falsify web backend at `/api/verify`.
- Voice messages are uploaded to the backend, transcribed by OpenAI, and verified like text.
- Users can choose a simple explanation language before verification.
- OpenAI and Tavily keys stay on the backend. Do not put those keys in the mobile app.

## Setup

1. Start the web backend from the repository root:

```bash
npm run dev:lan
```

2. Create `mobile/.env.local`:

```bash
EXPO_PUBLIC_VERIFY_API_URL=http://192.168.1.35:3000/api/verify
```

Use your computer's LAN IP, not `localhost`, when testing from a physical phone. If your IP changes, update this value.

3. Start Expo:

```bash
cd mobile
npm run start
```

## WhatsApp forwarding

Inbound sharing requires a native app build because the share-sheet registration is configured by the `expo-sharing` config plugin. Expo Go cannot add your app as a WhatsApp share target.

Build and run a native app:

```bash
cd mobile
npm run android
```

Then share text, links, screenshots, or voice/audio files from WhatsApp or Instagram and choose Falsify from the system share sheet.

If Falsify does not appear in the share sheet after changing `mobile/app.json`, rebuild the native app with `npm run android`.

## WhatsApp bot integration

The app also includes a backend webhook scaffold for the official WhatsApp Business Cloud API:

- `GET /api/webhooks/whatsapp` verifies the webhook challenge from Meta.
- `POST /api/webhooks/whatsapp` receives text, image, and audio messages.
- Incoming media is downloaded from Meta, then reused by the same Falsify verification logic.
- The backend replies to the sender with a simple verdict and source links.

Add these values to the backend `.env.local` before enabling the webhook in Meta:

```bash
WHATSAPP_WEBHOOK_VERIFY_TOKEN=choose_a_long_random_token
WHATSAPP_ACCESS_TOKEN=your_meta_whatsapp_cloud_api_token
WHATSAPP_PHONE_NUMBER_ID=your_meta_phone_number_id
WHATSAPP_GRAPH_API_VERSION=v24.0
```

For local testing, expose the Next.js backend with an HTTPS tunnel and use this callback URL in the Meta Developer dashboard:

```text
https://your-public-tunnel.example.com/api/webhooks/whatsapp
```

Subscribe the WhatsApp Business Account webhook to the `messages` field. Personal WhatsApp accounts cannot be read directly by an app; direct bot replies require a WhatsApp Business Platform phone number.

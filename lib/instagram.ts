export type InstagramPreview = {
  providerName: string;
  authorName?: string;
  title?: string;
  thumbnailUrl?: string;
  html?: string;
  source: "instagram_oembed";
  unavailableReason?: string;
};

type InstagramOEmbedResponse = {
  author_name?: string;
  provider_name?: string;
  title?: string;
  thumbnail_url?: string;
  html?: string;
};

function getOEmbedAccessToken() {
  return (
    process.env.INSTAGRAM_OEMBED_ACCESS_TOKEN ||
    process.env.FACEBOOK_ACCESS_TOKEN ||
    process.env.META_ACCESS_TOKEN
  );
}

export function isInstagramUrl(sourceUrl?: string) {
  if (!sourceUrl) {
    return false;
  }

  try {
    const url = new URL(sourceUrl);
    return /(^|\.)instagram\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function isInstagramReelUrl(sourceUrl?: string) {
  if (!sourceUrl) {
    return false;
  }

  try {
    const url = new URL(sourceUrl);
    return isInstagramUrl(sourceUrl) && /\/(reel|reels)\//i.test(url.pathname);
  } catch {
    return false;
  }
}

export async function fetchInstagramPreview(sourceUrl?: string): Promise<InstagramPreview | undefined> {
  if (!sourceUrl || !isInstagramUrl(sourceUrl)) {
    return undefined;
  }

  const instagramUrl = sourceUrl;
  const accessToken = getOEmbedAccessToken();

  if (!accessToken) {
    return {
      providerName: "Instagram",
      source: "instagram_oembed",
      unavailableReason:
        "Instagram preview metadata was not requested because INSTAGRAM_OEMBED_ACCESS_TOKEN is not configured."
    };
  }

  try {
    const url = new URL("https://graph.facebook.com/v21.0/instagram_oembed");
    url.searchParams.set("url", instagramUrl);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("omitscript", "true");

    const response = await fetch(url);

    if (!response.ok) {
      return {
        providerName: "Instagram",
        source: "instagram_oembed",
        unavailableReason:
          "Instagram preview metadata was not available for this link. The post may be private, restricted, deleted, or blocked from embedding."
      };
    }

    const payload = (await response.json()) as InstagramOEmbedResponse;

    return {
      providerName: payload.provider_name || "Instagram",
      authorName: payload.author_name,
      title: payload.title,
      thumbnailUrl: payload.thumbnail_url,
      html: payload.html,
      source: "instagram_oembed"
    };
  } catch {
    return {
      providerName: "Instagram",
      source: "instagram_oembed",
      unavailableReason:
        "Instagram preview metadata could not be fetched. Continue by sharing the reel video, caption, audio, or screenshot."
    };
  }
}

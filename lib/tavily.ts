export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string;
};

export type SearchEvidence = {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
};

type TavilyResponse = {
  results?: TavilyResult[];
};

export async function searchTavily(
  query: string,
  apiKey = process.env.TAVILY_API_KEY
): Promise<SearchEvidence[]> {
  if (!apiKey) {
    throw new Error("Missing TAVILY_API_KEY");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
      max_results: 5
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as TavilyResponse;

  return (payload.results ?? []).map((result) => ({
    title: result.title,
    url: result.url,
    snippet: result.content,
    publishedDate: result.published_date
  }));
}

export async function searchClaims(
  claims: { text: string; searchQuery: string }[],
  apiKey = process.env.TAVILY_API_KEY
) {
  const searches = await Promise.all(
    claims.map(async (claim) => ({
      claim: claim.text,
      query: claim.searchQuery,
      results: await searchTavily(claim.searchQuery, apiKey)
    }))
  );

  return searches;
}

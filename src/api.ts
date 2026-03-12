// API client for Viberr — all calls go through the public API.
// No database credentials are needed; agents authenticate via VIBERR_API_KEY.

const BASE_URL = process.env.VIBERR_API_URL || "https://www.viberr.us";

export async function api(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    params?: Record<string, string>;
    apiKey?: string;
  } = {}
) {
  const { method = "GET", body, params, apiKey } = options;

  const url = new URL(`/api${path}`, BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error ${res.status}`);
  }

  return data;
}

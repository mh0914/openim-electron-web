const DEFAULT_SYNC_THROTTLE_INTERVAL = 120 * 1000;

const SYNC_THROTTLE_PATHS = [
  "/user/get_users_info",
  "/friend/get_black_list",
  "/group/get_incremental_join_groups",
  "/friend/get_incremental_friends",
  "/conversation/get_incremental_conversations",
  "/group/get_incremental_group_members_batch",
];

type CachedFetchResponse = {
  body: ArrayBuffer;
  headers: [string, string][];
  status: number;
  statusText: string;
  timestamp: number;
};

const getRequestUrl = (input: RequestInfo | URL) => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

const getRequestMethod = (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method) {
    return init.method.toUpperCase();
  }
  if (typeof input !== "string" && !(input instanceof URL)) {
    return input.method.toUpperCase();
  }
  return "GET";
};

const getBodyCacheKey = (init?: RequestInit) => {
  const body = init?.body;
  if (!body) {
    return "";
  }
  if (typeof body === "string") {
    return body;
  }
  if (body instanceof URLSearchParams) {
    return body.toString();
  }
  return "[stream-body]";
};

const isSyncRequest = (url: string) => {
  try {
    const { pathname } = new URL(url, window.location.origin);
    return SYNC_THROTTLE_PATHS.some((path) => pathname.endsWith(path));
  } catch {
    return false;
  }
};

export const installIMSyncFetchThrottle = (
  interval = DEFAULT_SYNC_THROTTLE_INTERVAL,
) => {
  const globalWindow = window as typeof window & {
    __hubMessageIMSyncFetchThrottleInstalled?: boolean;
    __hubMessageOriginalFetch?: typeof window.fetch;
  };

  if (globalWindow.__hubMessageIMSyncFetchThrottleInstalled) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  const cache = new Map<string, CachedFetchResponse>();

  globalWindow.__hubMessageOriginalFetch = originalFetch;
  globalWindow.__hubMessageIMSyncFetchThrottleInstalled = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getRequestUrl(input);
    if (!isSyncRequest(url)) {
      return originalFetch(input, init);
    }

    const method = getRequestMethod(input, init);
    const cacheKey = `${method}:${url}:${getBodyCacheKey(init)}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < interval) {
      return new Response(cached.body.slice(0), {
        headers: cached.headers,
        status: cached.status,
        statusText: cached.statusText,
      });
    }

    const response = await originalFetch(input, init);
    if (response.ok) {
      void response
        .clone()
        .arrayBuffer()
        .then((body) => {
          cache.set(cacheKey, {
            body,
            headers: Array.from(response.headers.entries()),
            status: response.status,
            statusText: response.statusText,
            timestamp: Date.now(),
          });
        });
    }
    return response;
  };
};

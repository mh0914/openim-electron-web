const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value);
const isAbsoluteWsUrl = (value: string) => /^wss?:\/\//i.test(value);

const getWindowOrigin = () => {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:18081";
  }

  return window.location.origin;
};

const getWindowWsOrigin = () => {
  if (typeof window === "undefined") {
    return "ws://127.0.0.1:18081";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
};

const normalizePath = (value: string, fallbackPath: string) => {
  const trimmed = value.trim() || fallbackPath;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const resolveHttpUrl = (value: string | undefined, fallbackPath: string) => {
  const rawValue = value?.trim();
  if (!rawValue) {
    return `${getWindowOrigin()}${fallbackPath}`;
  }

  if (isAbsoluteHttpUrl(rawValue)) {
    return rawValue;
  }

  return `${getWindowOrigin()}${normalizePath(rawValue, fallbackPath)}`;
};

const resolveWsUrl = (value: string | undefined, fallbackPath: string) => {
  const rawValue = value?.trim();
  if (!rawValue || rawValue.toLowerCase() === "auto") {
    return `${getWindowWsOrigin()}${fallbackPath}`;
  }

  if (isAbsoluteWsUrl(rawValue)) {
    return rawValue;
  }

  return `${getWindowWsOrigin()}${normalizePath(rawValue, fallbackPath)}`;
};

export const runtimeConfig = {
  apiUrl: resolveHttpUrl(import.meta.env.VITE_API_URL, "/api"),
  chatUrl: resolveHttpUrl(import.meta.env.VITE_CHAT_URL, "/chat"),
  wsUrl: resolveWsUrl(import.meta.env.VITE_WS_URL, "/msg_gateway"),
};

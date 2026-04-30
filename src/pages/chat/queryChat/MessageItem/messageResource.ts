const getWindowOrigin = () => {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:18081";
  }

  return window.location.origin;
};

const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);

const isEquivalentHost = (left: string, right: string) =>
  left === right || (localHosts.has(left) && localHosts.has(right));

export const resolveMessageUrl = (raw?: string) => {
  if (!raw) return "";
  if (/^[a-zA-Z]:\\/.test(raw)) {
    return `file:///${raw.replace(/\\/g, "/")}`;
  }

  if (/^(blob:|data:|file:)/i.test(raw)) {
    return raw;
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const currentUrl = new URL(getWindowOrigin());
      const targetUrl = new URL(raw);
      const shouldUseCurrentOrigin =
        targetUrl.pathname.startsWith("/object/") &&
        isEquivalentHost(targetUrl.hostname, currentUrl.hostname) &&
        targetUrl.origin !== currentUrl.origin;

      if (shouldUseCurrentOrigin) {
        return `${currentUrl.origin}${targetUrl.pathname}${targetUrl.search}`;
      }
    } catch (error) {
      console.warn("[messageResource] failed to normalize absolute url", raw, error);
    }

    return raw;
  }

  if (raw.startsWith("/")) {
    return `${getWindowOrigin()}${raw}`;
  }

  return raw;
};

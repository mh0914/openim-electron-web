import { LocationDraft } from "@/pages/chat/queryChat/ChatFooter/SendActionBar/useFileMessage";

declare global {
  interface Window {
    AMap?: any;
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
  }
}

export interface LocationCandidate extends LocationDraft {
  title: string;
  address?: string;
}

let amapLoaderPromise: Promise<any> | null = null;

const AMAP_SCRIPT_ID = "openim-amap-jsapi";
const AMAP_VERSION = "2.0";
const AMAP_PLUGIN_LIST = [
  "AMap.Geolocation",
  "AMap.Geocoder",
  "AMap.PlaceSearch",
  "AMap.CitySearch",
  "AMap.Scale",
  "AMap.ToolBar",
];

const normalizeCoordinate = (value: any) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const normalizeLngLat = (lnglat: any) => {
  if (!lnglat) {
    return {
      longitude: 0,
      latitude: 0,
    };
  }

  const longitude =
    typeof lnglat.getLng === "function" ? lnglat.getLng() : normalizeCoordinate(lnglat.lng);
  const latitude =
    typeof lnglat.getLat === "function" ? lnglat.getLat() : normalizeCoordinate(lnglat.lat);

  return {
    longitude,
    latitude,
  };
};

const getLocationDescription = (
  title: string,
  address?: string,
  fallback = "",
) => [title, address].filter(Boolean).join(" ").trim() || fallback;

const hasValidCoordinate = (longitude: number, latitude: number) =>
  Number.isFinite(longitude) &&
  Number.isFinite(latitude) &&
  !(Math.abs(longitude) < 0.000001 && Math.abs(latitude) < 0.000001);

const getErrorMessage = (value: any, fallback: string) => {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (value?.info) {
    return value.info;
  }

  if (value?.message) {
    return value.message;
  }

  return fallback;
};

const parseBoundsCenter = (bounds: any) => {
  if (!bounds) {
    return null;
  }

  if (typeof bounds.getCenter === "function") {
    const center = bounds.getCenter();
    return normalizeLngLat(center);
  }

  if (typeof bounds === "string") {
    const parts = bounds.split(";");
    if (parts.length === 2) {
      const [southWest, northEast] = parts.map((part) =>
        part.split(",").map((segment) => Number(segment.trim())),
      );

      if (
        southWest.length === 2 &&
        northEast.length === 2 &&
        southWest.every(Number.isFinite) &&
        northEast.every(Number.isFinite)
      ) {
        return {
          longitude: (southWest[0] + northEast[0]) / 2,
          latitude: (southWest[1] + northEast[1]) / 2,
        };
      }
    }
  }

  return null;
};

const formatCityDescription = (result: any, fallback = "当前位置") =>
  [
    result?.province,
    result?.city,
    result?.district,
    result?.formattedAddress,
    result?.city || result?.province,
  ]
    .find((item) => typeof item === "string" && item.trim())
    ?.toString() || fallback;

const locateByBrowser = async () =>
  new Promise<LocationDraft>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Browser geolocation is unavailable."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          description: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        });
      },
      (error) => {
        reject(new Error(error.message || "Browser geolocation failed."));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });

const locateByAMapGeolocation = async (AMap: any) =>
  new Promise<LocationDraft>((resolve, reject) => {
    const geolocation = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      zoomToAccuracy: true,
      position: "RB",
      needAddress: true,
      extensions: "all",
      getCityWhenFail: true,
      noIpLocate: 0,
      noGeoLocation: 0,
    });

    geolocation.getCurrentPosition((status: string, result: any) => {
      if (status === "complete" && result?.position) {
        const position = normalizeLngLat(result.position);
        if (!hasValidCoordinate(position.longitude, position.latitude)) {
          reject(new Error("AMap geolocation returned invalid coordinate 0,0."));
          return;
        }

        resolve({
          description:
            result.formattedAddress ||
            `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`,
          longitude: position.longitude,
          latitude: position.latitude,
        });
        return;
      }

      reject(new Error(getErrorMessage(result, "AMap geolocation failed.")));
    });
  });

const locateByAMapCity = async (AMap: any) =>
  new Promise<LocationDraft>((resolve, reject) => {
    const geolocation = new AMap.Geolocation({
      getCityWhenFail: true,
    });

    geolocation.getCityInfo((status: string, result: any) => {
      if (status === "complete") {
        const center = parseBoundsCenter(result?.bounds);
        if (center && hasValidCoordinate(center.longitude, center.latitude)) {
          resolve({
            description: formatCityDescription(result, "IP定位"),
            longitude: center.longitude,
            latitude: center.latitude,
          });
          return;
        }
      }

      const citySearch = new AMap.CitySearch();
      citySearch.getLocalCity((cityStatus: string, cityResult: any) => {
        if (cityStatus === "complete") {
          const center = parseBoundsCenter(cityResult?.bounds);
          if (center && hasValidCoordinate(center.longitude, center.latitude)) {
            resolve({
              description: formatCityDescription(cityResult, "IP定位"),
              longitude: center.longitude,
              latitude: center.latitude,
            });
            return;
          }
        }

        reject(
          new Error(
            getErrorMessage(cityResult, getErrorMessage(result, "IP city location failed.")),
          ),
        );
      });
    });
  });

export const loadAMap = async () => {
  if (window.AMap) {
    return window.AMap;
  }

  if (amapLoaderPromise) {
    return amapLoaderPromise;
  }

  const key = import.meta.env.VITE_AMAP_KEY;
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;

  if (!key) {
    throw new Error("AMap key is missing.");
  }

  if (securityJsCode) {
    window._AMapSecurityConfig = {
      securityJsCode,
    };
  }

  amapLoaderPromise = new Promise((resolve, reject) => {
    const existed = document.getElementById(AMAP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existed) {
      existed.addEventListener("load", () => resolve(window.AMap), {
        once: true,
      });
      existed.addEventListener(
        "error",
        () => reject(new Error("Failed to load AMap script.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = AMAP_SCRIPT_ID;
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=${AMAP_VERSION}&key=${key}&plugin=${AMAP_PLUGIN_LIST.join(",")}`;
    script.onload = () => resolve(window.AMap);
    script.onerror = () => reject(new Error("Failed to load AMap script."));
    document.head.appendChild(script);
  });

  return amapLoaderPromise;
};

export const createMapServices = async () => {
  const AMap = await loadAMap();
  const geocoder = new AMap.Geocoder({
    radius: 1000,
    extensions: "all",
  });
  const placeSearch = new AMap.PlaceSearch({
    pageSize: 10,
    pageIndex: 1,
  });

  return {
    AMap,
    geocoder,
    placeSearch,
  };
};

export const reverseGeocode = async (
  geocoder: any,
  longitude: number,
  latitude: number,
) =>
  new Promise<{
    selected: LocationDraft;
    candidates: LocationCandidate[];
  }>((resolve, reject) => {
    geocoder.getAddress([longitude, latitude], (status: string, result: any) => {
      if (status !== "complete" || !result?.regeocode) {
        reject(new Error("Failed to reverse geocode current location."));
        return;
      }

      const regeocode = result.regeocode;
      const formattedAddress =
        regeocode.formattedAddress || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      const poiCandidates = Array.isArray(regeocode.pois) ? regeocode.pois : [];
      const candidates: LocationCandidate[] = poiCandidates.slice(0, 10).map((poi: any) => {
        const poiLocation = normalizeLngLat(poi.location);
        const title = poi.name || formattedAddress;
        const address = poi.address || regeocode.formattedAddress || "";
        return {
          title,
          address,
          description: getLocationDescription(title, address, formattedAddress),
          longitude: poiLocation.longitude || longitude,
          latitude: poiLocation.latitude || latitude,
        };
      });

      resolve({
        selected: {
          description: formattedAddress,
          longitude,
          latitude,
        },
        candidates,
      });
    });
  });

export const searchPlaces = async (placeSearch: any, keyword: string) =>
  new Promise<LocationCandidate[]>((resolve, reject) => {
    placeSearch.search(keyword, (status: string, result: any) => {
      if (status !== "complete") {
        reject(new Error("Failed to search locations."));
        return;
      }

      const pois = result?.poiList?.pois ?? [];
      resolve(
        pois
          .filter((poi: any) => poi?.location)
          .slice(0, 10)
          .map((poi: any) => {
            const location = normalizeLngLat(poi.location);
            const title = poi.name || keyword;
            const address = poi.address || poi.cityname || "";
            return {
              title,
              address,
              description: getLocationDescription(title, address, keyword),
              longitude: location.longitude,
              latitude: location.latitude,
            };
          }),
      );
    });
  });

export const locateCurrentPosition = async (AMap: any, _map: any) => {
  try {
    const browserLocation = await locateByBrowser();
    console.info("[location] browser geolocation resolved", browserLocation);
    return browserLocation;
  } catch (browserError) {
    console.error(
      "[location] browser geolocation failed",
      getErrorMessage(browserError, "Browser geolocation failed."),
    );
  }

  try {
    const amapLocation = await locateByAMapGeolocation(AMap);
    console.info("[location] AMap precise geolocation resolved", amapLocation);
    return amapLocation;
  } catch (amapError) {
    console.error(
      "[location] AMap precise geolocation failed",
      getErrorMessage(amapError, "AMap precise geolocation failed."),
    );
  }

  const cityLocation = await locateByAMapCity(AMap);
  console.info("[location] AMap city fallback resolved", cityLocation);
  return cityLocation;
};

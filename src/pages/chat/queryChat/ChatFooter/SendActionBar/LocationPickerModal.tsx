import { AimOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { Button, Empty, Input, List, Modal, Spin, Typography, message as antdMessage } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  createMapServices,
  locateCurrentPosition,
  LocationCandidate,
  reverseGeocode,
  searchPlaces,
} from "@/services/map/amap";

import { LocationDraft } from "./useFileMessage";

const { Text } = Typography;

interface LocationPickerModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: LocationDraft) => Promise<void>;
}

const LocationPickerModal = ({ open, onCancel, onSubmit }: LocationPickerModalProps) => {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const placeSearchRef = useRef<any>(null);
  const amapRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationDraft | null>(null);
  const [candidates, setCandidates] = useState<LocationCandidate[]>([]);

  const pickedCandidates = useMemo(() => {
    if (searchKeyword.trim()) {
      return candidates;
    }
    return candidates.slice(0, 6);
  }, [candidates, searchKeyword]);

  const syncMapPoint = async (
    nextLocation: LocationDraft,
    options?: {
      descriptionOnly?: boolean;
    },
  ) => {
    if (!mapRef.current || !markerRef.current || !geocoderRef.current) {
      return;
    }

    markerRef.current.setPosition([nextLocation.longitude, nextLocation.latitude]);
    mapRef.current.setCenter([nextLocation.longitude, nextLocation.latitude]);

    if (options?.descriptionOnly) {
      setSelectedLocation(nextLocation);
      return;
    }

    const geocodeResult = await reverseGeocode(
      geocoderRef.current,
      nextLocation.longitude,
      nextLocation.latitude,
    );
    setSelectedLocation({
      description:
        nextLocation.description || geocodeResult.selected.description || nextLocation.description,
      longitude: nextLocation.longitude,
      latitude: nextLocation.latitude,
    });
    setCandidates(geocodeResult.candidates);
  };

  const handleLocateCurrent = async () => {
    if (!mapRef.current || !amapRef.current) {
      return;
    }

    setLocating(true);
    try {
      const current = await locateCurrentPosition(amapRef.current, mapRef.current);
      await syncMapPoint(current);
    } catch (error) {
      antdMessage.error(
        error instanceof Error ? error.message : t("toast.locationLocateFailed"),
      );
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (!open || !mapContainerRef.current) {
      return;
    }

    let cancelled = false;

    const initMap = async () => {
      try {
        const { AMap, geocoder, placeSearch } = await createMapServices();
        if (cancelled || !mapContainerRef.current) {
          return;
        }

        amapRef.current = AMap;
        geocoderRef.current = geocoder;
        placeSearchRef.current = placeSearch;

        if (!mapRef.current) {
          const map = new AMap.Map(mapContainerRef.current, {
            zoom: 16,
            resizeEnable: true,
            viewMode: "2D",
          });
          const marker = new AMap.Marker({
            map,
            draggable: true,
            anchor: "bottom-center",
          });

          map.addControl(new AMap.Scale());
          map.addControl(new AMap.ToolBar());

          map.on("click", async (event: any) => {
            const nextLocation = {
              description: "",
              longitude: event.lnglat.getLng(),
              latitude: event.lnglat.getLat(),
            };
            try {
              await syncMapPoint(nextLocation);
            } catch (error) {
              antdMessage.error(
                error instanceof Error ? error.message : t("toast.locationResolveFailed"),
              );
            }
          });

          marker.on("dragend", async (event: any) => {
            const nextLocation = {
              description: "",
              longitude: event.lnglat.getLng(),
              latitude: event.lnglat.getLat(),
            };
            try {
              await syncMapPoint(nextLocation);
            } catch (error) {
              antdMessage.error(
                error instanceof Error ? error.message : t("toast.locationResolveFailed"),
              );
            }
          });

          mapRef.current = map;
          markerRef.current = marker;
        } else {
          mapRef.current.resize();
        }

        setMapReady(true);
        if (!selectedLocation) {
          await handleLocateCurrent();
        } else {
          await syncMapPoint(selectedLocation, {
            descriptionOnly: true,
          });
        }
      } catch (error) {
        antdMessage.error(error instanceof Error ? error.message : t("toast.locationMapLoadFailed"));
      }
    };

    initMap();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mapReady || !mapRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      mapRef.current?.resize();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [mapReady, open]);

  const handleSearch = async () => {
    const keyword = searchKeyword.trim();
    if (!keyword || !placeSearchRef.current) {
      return;
    }

    setSearching(true);
    try {
      const result = await searchPlaces(placeSearchRef.current, keyword);
      setCandidates(result);
      if (result[0]) {
        await syncMapPoint(result[0], {
          descriptionOnly: true,
        });
        markerRef.current?.setPosition([result[0].longitude, result[0].latitude]);
        mapRef.current?.setCenter([result[0].longitude, result[0].latitude]);
      }
    } catch (error) {
      antdMessage.error(
        error instanceof Error ? error.message : t("toast.locationSearchFailed"),
      );
    } finally {
      setSearching(false);
    }
  };

  const handleSelectCandidate = async (candidate: LocationCandidate) => {
    setSelectedLocation(candidate);
    markerRef.current?.setPosition([candidate.longitude, candidate.latitude]);
    mapRef.current?.setCenter([candidate.longitude, candidate.latitude]);
  };

  const handleSubmit = async () => {
    if (!selectedLocation) {
      antdMessage.warning(t("toast.locationSelectRequired"));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(selectedLocation);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      centered
      confirmLoading={submitting}
      destroyOnClose={false}
      onCancel={onCancel}
      onOk={handleSubmit}
      open={open}
      title={t("placeholder.location")}
      width={1080}
      okText={t("placeholder.send")}
      styles={{
        body: {
          maxHeight: "calc(100vh - 180px)",
          overflow: "hidden",
          paddingTop: 16,
        },
      }}
    >
      <div
        className="flex min-h-0 flex-col gap-4 overflow-hidden"
        style={{ height: "min(640px, calc(100vh - 260px))" }}
      >
        <div className="shrink-0 flex gap-3">
          <Input.Search
            allowClear
            enterButton={t("placeholder.search")}
            onChange={(event) => setSearchKeyword(event.target.value)}
            onSearch={handleSearch}
            placeholder={t("placeholder.locationSearch")}
            value={searchKeyword}
          />
          <Button
            icon={<AimOutlined />}
            loading={locating}
            onClick={handleLocateCurrent}
          >
            {t("placeholder.currentLocation")}
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
          <div className="min-w-0 flex-[1.7] overflow-hidden rounded-xl border border-[var(--gap-text)]">
            <div className="relative h-full min-h-[420px] w-full bg-[#f5f7fa]">
              <div className="absolute left-3 top-3 z-10 rounded-md bg-white/95 px-3 py-2 shadow">
                <div className="flex items-start gap-2">
                  <EnvironmentOutlined className="pt-1 text-[var(--primary)]" />
                  <div className="min-w-0">
                    <div className="max-w-[420px] truncate text-sm font-medium text-[var(--text)]">
                      {selectedLocation?.description || t("placeholder.locationSelectHint")}
                    </div>
                    {selectedLocation && (
                      <Text className="text-xs text-[var(--sub-text)]">
                        {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                      </Text>
                    )}
                  </div>
                </div>
              </div>
              {!mapReady && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                  <Spin tip={t("placeholder.locationMapLoading")} />
                </div>
              )}
              <div className="h-full w-full" ref={mapContainerRef} />
            </div>
          </div>

          <div className="flex min-h-0 w-[320px] shrink-0 flex-col rounded-xl border border-[var(--gap-text)] px-3 py-3">
            <div className="mb-3 shrink-0 text-sm font-medium text-[var(--text)]">
              {searchKeyword.trim()
                ? t("placeholder.locationSearchResult")
                : t("placeholder.locationNearby")}
            </div>
            <Spin className="min-h-0 flex-1" spinning={searching}>
              <div className="h-full overflow-y-auto pr-1">
                <List
                  dataSource={pickedCandidates}
                  locale={{
                    emptyText: (
                      <Empty
                        description={t("empty.noSearchResults")}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ),
                  }}
                  renderItem={(item) => {
                    const active =
                      selectedLocation?.longitude === item.longitude &&
                      selectedLocation?.latitude === item.latitude;

                    return (
                      <List.Item
                        className={`cursor-pointer rounded-lg px-3 transition-colors ${
                          active ? "bg-[var(--primary-active)]" : "hover:bg-[var(--chat-hover)]"
                        }`}
                        onClick={() => handleSelectCandidate(item)}
                      >
                        <List.Item.Meta
                          title={
                            <span className="text-sm font-medium text-[var(--text)]">
                              {item.title}
                            </span>
                          }
                          description={
                            <span className="text-xs text-[var(--sub-text)]">
                              {item.address || item.description}
                            </span>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              </div>
            </Spin>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default LocationPickerModal;

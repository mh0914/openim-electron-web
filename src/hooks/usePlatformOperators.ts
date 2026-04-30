import { useEffect, useMemo, useState } from "react";

import { findPlatformOperators } from "@/api/platformOperator";

const POSITIVE_CACHE_TTL = 10 * 60 * 1000;
const NEGATIVE_CACHE_TTL = 60 * 1000;
const REQUEST_FAILURE_RETRY_TTL = 2 * 60 * 1000;

type OperatorCacheEntry = {
  value: boolean;
  updatedAt: number;
};

const operatorCache = new Map<string, OperatorCacheEntry>();
const pendingIDs = new Set<string>();
const failedFetchAtMap = new Map<string, number>();

const isCacheFresh = (userID: string) => {
  const cacheEntry = operatorCache.get(userID);
  if (!cacheEntry) {
    return false;
  }

  const ttl = cacheEntry.value ? POSITIVE_CACHE_TTL : NEGATIVE_CACHE_TTL;
  return Date.now() - cacheEntry.updatedAt < ttl;
};

const isFailureCoolingDown = (userID: string) => {
  const failedAt = failedFetchAtMap.get(userID);
  if (!failedAt) {
    return false;
  }

  return Date.now() - failedAt < REQUEST_FAILURE_RETRY_TTL;
};

export const usePlatformOperators = (userIDs: string[]) => {
  const userIDsKey = userIDs.join("|");
  const normalizedUserIDs = useMemo(
    () => Array.from(new Set(userIDs.filter(Boolean))).sort(),
    [userIDsKey],
  );
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unknownUserIDs = normalizedUserIDs.filter(
      (userID) =>
        !isCacheFresh(userID) &&
        !pendingIDs.has(userID) &&
        !isFailureCoolingDown(userID),
    );
    if (!unknownUserIDs.length) {
      return;
    }

    unknownUserIDs.forEach((userID) => pendingIDs.add(userID));

    void findPlatformOperators(unknownUserIDs)
      .then((resp) => {
        const operatorSet = new Set(resp.userIDs ?? []);
        const updatedAt = Date.now();
        unknownUserIDs.forEach((userID) => {
          failedFetchAtMap.delete(userID);
          operatorCache.set(userID, {
            value: operatorSet.has(userID),
            updatedAt,
          });
          pendingIDs.delete(userID);
        });
        setVersion((prev) => prev + 1);
      })
      .catch(() => {
        const failedAt = Date.now();
        unknownUserIDs.forEach((userID) => {
          pendingIDs.delete(userID);
          failedFetchAtMap.set(userID, failedAt);
        });
      });
  }, [normalizedUserIDs]);

  return useMemo(
    () =>
      new Set(
        normalizedUserIDs.filter((userID) => operatorCache.get(userID)?.value),
      ),
    [normalizedUserIDs, version],
  );
};

import { v4 as uuidv4 } from "uuid";

import { runtimeConfig } from "@/config/runtime";
import createAxiosInstance from "@/utils/request";

const request = createAxiosInstance(runtimeConfig.chatUrl, false);

export const findPlatformOperators = async (userIDs: string[]) => {
  const uniqueUserIDs = Array.from(new Set(userIDs.filter(Boolean)));
  if (!uniqueUserIDs.length) {
    return {
      userIDs: [],
    };
  }

  const response = await request.post<{ userIDs: string[] }>(
    "/user/operator/find",
    {
      userIDs: uniqueUserIDs,
    },
    {
      headers: {
        operationID: uuidv4(),
      },
    },
  );

  return response.data ?? { userIDs: [] };
};

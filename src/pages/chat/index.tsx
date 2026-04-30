import { Layout } from "antd";
import { Outlet } from "react-router-dom";

import ConversationSider from "./ConversationSider";

export const Chat = () => {
  return (
    <Layout className="h-full min-h-0 !flex-row overflow-hidden bg-white">
      <ConversationSider />
      <Outlet />
    </Layout>
  );
};

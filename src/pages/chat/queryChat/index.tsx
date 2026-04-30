import { InfoCircleOutlined } from "@ant-design/icons";
import { SessionType } from "@openim/wasm-client-sdk";
import { useUnmount } from "ahooks";
import { Layout } from "antd";
import { t } from "i18next";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { useConversationStore } from "@/store";

import ChatContent from "./ChatContent";
import ChatFooter from "./ChatFooter";
import ChatHeader from "./ChatHeader";
import useConversationState from "./useConversationState";

export const QueryChat = () => {
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );

  useConversationState();

  useUnmount(() => {
    updateCurrentConversation();
  });

  return (
    <Layout id="chat-container" className="relative h-full min-h-0 overflow-hidden bg-white">
      <ChatHeader />
      <PanelGroup direction="vertical">
        <Panel id="chat-main" order={0}>
          <ChatContent />
        </Panel>
        <PanelResizeHandle />
        <Panel
          id="chat-footer"
          order={1}
          defaultSize={20}
          maxSize={52}
          className="min-h-[176px]"
        >
          <ChatFooter />
        </Panel>
      </PanelGroup>
    </Layout>
  );
};

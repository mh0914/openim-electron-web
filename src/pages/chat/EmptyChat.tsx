import { Layout } from "antd";

import empty_chat_bg from "@/assets/images/empty_chat_bg.png";

export const EmptyChat = () => {
  return (
    <Layout className="no-mobile flex items-center justify-center overflow-hidden bg-white">
      <div className="flex max-h-full flex-col items-center justify-center px-4 py-6">
        <img
          src={empty_chat_bg}
          alt=""
          className="w-[min(280px,45vh)] max-w-full object-contain"
        />
      </div>
    </Layout>
  );
};

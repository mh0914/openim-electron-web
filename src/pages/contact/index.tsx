import { Layout } from "antd";
import { Outlet } from "react-router-dom";

import ContactSider from "@/pages/contact/ContactSider";

export const Contact = () => {
  return (
    <Layout className="relative z-0 h-full min-h-0 !flex-row overflow-hidden bg-white">
      <ContactSider />
      <Outlet />
    </Layout>
  );
};

import { Button, Result, Spin } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { exchangeSSOTicket } from "@/api/login";
import { clearIMProfile, setIMProfile } from "@/utils/storage";

export const SSOLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const ticket = searchParams.get("ticket")?.trim();
    if (!ticket) {
      setError("单点登录票据缺失，请从主系统重新进入。");
      return;
    }

    clearIMProfile();
    exchangeSSOTicket(ticket)
      .then(({ data }) => {
        setIMProfile(data);
        navigate("/chat", { replace: true });
      })
      .catch(() => {
        setError("单点登录已失效，请从主系统重新进入。");
      });
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-[#f5f8fc]">
        <Result
          status="warning"
          title={error}
          extra={
            <Button type="primary" onClick={() => navigate("/login", { replace: true })}>
              返回登录
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-[#f5f8fc]">
      <Spin size="large" tip="正在登录" />
    </div>
  );
};

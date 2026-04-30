import { Button, Form, Input, Select, Space, Tabs } from "antd";
import { t } from "i18next";
import md5 from "md5";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useLogin, useSendSms } from "@/api/login";
import { IS_SKIP_SMS_VERIFY } from "@/config";
import {
  getEmail,
  getPhoneNumber,
  setAreaCode,
  setEmail,
  setIMProfile,
  setPhoneNumber,
} from "@/utils/storage";

import { areaCode } from "./areaCode";
import type { FormType } from "./index";
import styles from "./index.module.scss";

// 0login 1resetPassword 2register
enum LoginType {
  Password,
  VerifyCode,
}

type LoginFormProps = {
  setFormType: (type: FormType) => void;
  loginMethod: "phone" | "email";
  updateLoginMethod: (method: "phone" | "email") => void;
};

const createCaptchaCode = () =>
  Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join("");

const GraphicCaptcha = ({
  code,
  onRefresh,
}: {
  code: string;
  onRefresh: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f3f9ff";
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 10; i += 1) {
      ctx.strokeStyle = `rgba(2, 137, 250, ${0.08 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.stroke();
    }

    for (let i = 0; i < 24; i += 1) {
      ctx.fillStyle = `rgba(2, 137, 250, ${0.12 + Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(
        Math.random() * width,
        Math.random() * height,
        1 + Math.random() * 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    code.split("").forEach((char, index) => {
      const x = 18 + index * 24;
      const y = 28 + Math.random() * 8;
      const angle = ((Math.random() * 36 - 18) * Math.PI) / 180;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.font = "bold 24px Segoe UI";
      ctx.fillStyle = ["#0b4ea2", "#1463c4", "#0289fa", "#2b5aa6"][
        Math.floor(Math.random() * 4)
      ];
      ctx.fillText(char, 0, 0);
      ctx.restore();
    });
  }, [code]);

  return (
    <button
      type="button"
      className="flex h-[46px] min-w-[118px] items-center justify-center rounded-md border border-[#d9d9d9] bg-[#f8fbff] px-2 transition hover:border-[var(--primary)]"
      onClick={onRefresh}
      title="点击刷新验证码"
    >
      <canvas ref={canvasRef} width={112} height={40} />
    </button>
  );
};

const LoginForm = ({ loginMethod, setFormType, updateLoginMethod }: LoginFormProps) => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loginType, setLoginType] = useState<LoginType>(LoginType.Password);
  const { mutate: login, isLoading: loginLoading } = useLogin();
  const { mutate: semdSms } = useSendSms();
  const smsVerificationDisabled = IS_SKIP_SMS_VERIFY;
  const [captchaCode, setCaptchaCode] = useState(() => createCaptchaCode());
  const normalizedCaptchaCode = useMemo(() => captchaCode.toLowerCase(), [captchaCode]);

  const refreshCaptcha = useCallback(() => {
    setCaptchaCode(createCaptchaCode());
    form.setFieldValue("graphicCaptcha", "");
  }, [form]);

  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prevCountdown) => prevCountdown - 1);
        if (countdown === 1) {
          clearTimeout(timer);
          setCountdown(0);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const onFinish = (params: API.Login.LoginParams) => {
    delete (params as API.Login.LoginParams & { graphicCaptcha?: string }).graphicCaptcha;
    if (smsVerificationDisabled || loginType === LoginType.Password) {
      params.password = md5(params.password ?? "");
    }
    if (params.phoneNumber) {
      setAreaCode(params.areaCode);
      setPhoneNumber(params.phoneNumber);
    }
    if (params.email) {
      setEmail(params.email);
    }
    login(params, {
      onSuccess: (data) => {
        const { chatToken, imToken, userID } = data.data;
        setIMProfile({ chatToken, imToken, userID });
        navigate("/chat");
      },
    });
  };

  const sendSmsHandle = () => {
    if (smsVerificationDisabled) {
      return;
    }
    const options = {
      phoneNumber: form.getFieldValue("phoneNumber"),
      email: form.getFieldValue("email"),
      areaCode: form.getFieldValue("areaCode"),
      usedFor: 3,
    };
    if (loginMethod === "phone") {
      delete options.email;
    }
    if (loginMethod === "email") {
      delete options.phoneNumber;
      delete options.areaCode;
    }

    semdSms(options, {
      onSuccess() {
        setCountdown(60);
      },
    });
  };

  const onLoginMethodChange = (key: string) => {
    updateLoginMethod(key as "phone" | "email");
  };

  return (
    <>
      <div className="flex flex-row items-center justify-between">
        <div className="text-xl font-medium">{t("placeholder.welcome")}</div>
      </div>
      <Tabs
        className={styles["login-method-tab"]}
        activeKey={loginMethod}
        items={[
          { key: "phone", label: t("placeholder.phoneNumber") },
          { key: "email", label: t("placeholder.email") },
        ]}
        onChange={onLoginMethodChange}
      />
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        autoComplete="off"
        labelCol={{ prefixCls: "custom-form-item" }}
        initialValues={{
          areaCode: "+86",
          phoneNumber: getPhoneNumber() ?? "",
          email: getEmail() ?? "",
        }}
      >
        {loginMethod === "phone" ? (
          <Form.Item label={t("placeholder.phoneNumber")}>
            <Space.Compact className="w-full">
              <Form.Item name="areaCode" noStyle>
                <Select options={areaCode} className="!w-28" />
              </Form.Item>
              <Form.Item name="phoneNumber" noStyle>
                <Input allowClear placeholder={t("toast.inputPhoneNumber")} />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
        ) : (
          <Form.Item
            label={t("placeholder.email")}
            name="email"
            rules={[{ type: "email", message: t("toast.inputCorrectEmail") }]}
          >
            <Input allowClear placeholder={t("toast.inputEmail")} />
          </Form.Item>
        )}

        {!smsVerificationDisabled && loginType === LoginType.VerifyCode ? (
          <Form.Item label={t("placeholder.verifyCode")} name="verifyCode">
            <Space.Compact className="w-full">
              <Input
                allowClear
                placeholder={t("toast.inputVerifyCode")}
                className="w-full"
              />
              <Button type="primary" onClick={sendSmsHandle} loading={countdown > 0}>
                {countdown > 0
                  ? t("date.second", { num: countdown })
                  : t("placeholder.sendVerifyCode")}
              </Button>
            </Space.Compact>
          </Form.Item>
        ) : (
          <Form.Item label={t("placeholder.password")} name="password">
            <Input.Password allowClear placeholder={t("toast.inputPassword")} />
          </Form.Item>
        )}

        <Form.Item
          label="图形验证码"
          required
        >
          <Space.Compact className="w-full">
            <Form.Item
              className="mb-0 flex-1"
              name="graphicCaptcha"
              noStyle
              rules={[
                { required: true, message: "请输入图形验证码" },
                {
                  validator: async (_, value) => {
                    if (!value) return;
                    if (String(value).trim().toLowerCase() !== normalizedCaptchaCode) {
                      throw new Error("图形验证码错误");
                    }
                  },
                },
              ]}
            >
              <Input
                allowClear
                maxLength={4}
                placeholder="请输入右侧 4 位验证码"
              />
            </Form.Item>
            <div className="ml-2">
              <GraphicCaptcha code={captchaCode} onRefresh={refreshCaptcha} />
            </div>
          </Space.Compact>
        </Form.Item>

        {!smsVerificationDisabled && (
          <div className="mb-10 flex flex-row justify-between">
            <span
              className="cursor-pointer text-sm text-gray-400"
              onClick={() => setFormType(1)}
            >
              {t("placeholder.forgetPassword")}
            </span>
            <span
              className="cursor-pointer text-sm text-[var(--primary)]"
              onClick={() =>
                setLoginType(
                  loginType === LoginType.Password
                    ? LoginType.VerifyCode
                    : LoginType.Password,
                )
              }
            >
              {`${
                loginType === LoginType.Password
                  ? t("placeholder.verifyCode")
                  : t("placeholder.password")
              }${t("placeholder.login")}`}
            </span>
          </div>
        )}

        <Form.Item className="mb-4">
          <Button type="primary" htmlType="submit" block loading={loginLoading}>
            {t("placeholder.login")}
          </Button>
        </Form.Item>

        <div className="flex flex-row items-center justify-center">
          <span className="text-sm text-gray-400">
            {t("placeholder.registerToast")}
          </span>
          <span
            className="cursor-pointer text-sm text-blue-500"
            onClick={() => setFormType(2)}
          >
            {t("placeholder.toRegister")}
          </span>
        </div>
      </Form>
    </>
  );
};

export default LoginForm;

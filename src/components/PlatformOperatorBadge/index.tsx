import clsx from "clsx";
import { t } from "i18next";
import { memo } from "react";

interface PlatformOperatorBadgeProps {
  variant?: "platformOperator" | "official" | "customerService";
  compact?: boolean;
  className?: string;
}

const badgeStyleMap = {
  platformOperator: "border border-[#CCE6D5] bg-[#E9F5EC] text-[#177245]",
  official: "border border-[#F1C48B] bg-[#FFF4E8] text-[#B45F10] shadow-[0_1px_2px_rgba(180,95,16,0.08)]",
  customerService: "border border-[#BFD8FF] bg-[#EAF3FF] text-[#1F5FC7] shadow-[0_1px_2px_rgba(31,95,199,0.08)]",
} as const;

const PlatformOperatorBadge = ({
  variant = "platformOperator",
  compact = false,
  className,
}: PlatformOperatorBadgeProps) => {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold leading-none",
        compact ? "px-2 py-1 text-[11px]" : "px-2 py-[3px] text-[10px]",
        badgeStyleMap[variant],
        className,
      )}
    >
      {t(`operatorBadge.${variant}`)}
    </span>
  );
};

export default memo(PlatformOperatorBadge);

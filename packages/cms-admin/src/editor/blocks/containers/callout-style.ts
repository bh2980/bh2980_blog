import { AlertCircle, AlertOctagon, AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { ComponentType } from "react";

/** 콜아웃 블록의 종류(블록 정의 `callout.variant`의 선택지). */
export type CalloutVariant = "note" | "tip" | "info" | "warning" | "danger";

/** 편집기의 콜아웃 아이콘. 공개 화면의 모양은 사이트의 렌더러가 정한다. */
export const CALLOUT_ICON_BY_VARIANT: Record<CalloutVariant, ComponentType<{ className?: string }>> = {
	note: AlertCircle,
	tip: Lightbulb,
	info: Info,
	warning: AlertTriangle,
	danger: AlertOctagon,
};

const TITLE_BY_VARIANT: Record<CalloutVariant, string> = {
	note: "NOTE",
	tip: "TIP",
	info: "INFO",
	warning: "WARNING",
	danger: "DANGER",
};

/** 제목을 비웠을 때 편집기에 흐리게 보이는 기본 제목. */
export const getDefaultCalloutTitle = (variant: CalloutVariant) => TITLE_BY_VARIANT[variant];

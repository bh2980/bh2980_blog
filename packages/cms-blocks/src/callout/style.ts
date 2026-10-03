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

/** 편집기 콜아웃 상자의 모양. 블로그 공개 화면의 콜아웃과 같은 색이다. */
export const CALLOUT_BOX_CLASS = [
	"relative block w-full rounded-lg border px-4 py-3 text-sm",
	"[&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
	"[&_:is(ul,ol)>li]:marker:text-slate-700",
	"dark:[&_:is(ul,ol)>li]:marker:text-slate-200/80",
].join(" ");

/** 종류별 색. */
export const CALLOUT_CLASS_BY_VARIANT: Record<CalloutVariant, string> = {
	note: "bg-slate-100 border-border text-slate-900 dark:bg-slate-800/70 dark:border-slate-500/60 dark:text-slate-50",
	tip: [
		"bg-emerald-50 text-emerald-900 border-emerald-200 [&>svg]:text-emerald-700",
		"dark:bg-emerald-400/25 dark:text-emerald-50 dark:border-emerald-300/70 dark:[&>svg]:text-emerald-100",
	].join(" "),
	info: [
		"bg-sky-50 text-sky-900 border-sky-200 [&>svg]:text-sky-700",
		"dark:bg-sky-400/25 dark:text-sky-50 dark:border-sky-300/70 dark:[&>svg]:text-sky-100",
	].join(" "),
	warning: [
		"bg-amber-50 text-amber-900 border-amber-200 [&>svg]:text-amber-700",
		"dark:bg-amber-400/25 dark:text-amber-50 dark:border-amber-300/70 dark:[&>svg]:text-amber-100",
	].join(" "),
	danger: [
		"bg-red-50 text-red-900 border-red-200 [&>svg]:text-red-700",
		"dark:bg-red-400/25 dark:text-red-50 dark:border-red-300/70 dark:[&>svg]:text-red-100",
	].join(" "),
};

/** 제목을 비웠을 때 편집기에 흐리게 보이는 기본 제목. */
export const getDefaultCalloutTitle = (variant: CalloutVariant) => TITLE_BY_VARIANT[variant];

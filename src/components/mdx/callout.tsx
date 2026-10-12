// components/callout.tsx
import type { VariantProps } from "class-variance-authority";
import { AlertCircle, AlertOctagon, AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { PropsWithChildren } from "react";

import { Alert, type alertVariants } from "../ui/alert";

export type CalloutVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

export const CALLOUT_ICON_BY_VARIANT: Record<CalloutVariant, React.ComponentType<{ className?: string }>> = {
	note: AlertCircle,
	tip: Lightbulb,
	info: Info,
	warning: AlertTriangle,
	danger: AlertOctagon,
};

type CalloutProps = PropsWithChildren<{
	variant?: CalloutVariant;
	title?: string;
}>;

/**
 * 콜아웃. 제목이 있으면 아이콘과 제목 줄 아래에 본문을 두고, 없으면 아이콘 옆에 본문을 바로 둔다.
 * 기본 이름표(NOTE·TIP 등)는 두지 않는다. 한국어 글 사이에서 영어 대문자가 튀고, 종류는 아이콘과 선 색이 이미 알려 준다.
 */
export const Callout = ({ variant = "note", title, children }: CalloutProps) => {
	const v = variant ?? "note";
	const Icon = CALLOUT_ICON_BY_VARIANT[v];
	const resolvedTitle = title?.trim();
	const body = children ? (
		<div
			data-slot="callout-body"
			className="min-w-0 text-current text-sm [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&_p]:m-0 [&_p]:leading-relaxed"
		>
			{children}
		</div>
	) : null;

	if (!resolvedTitle) {
		return (
			<Alert variant={v} layout="stack" className="not-prose my-6 flex w-full items-start gap-2">
				<Icon className="mt-[0.2rem] size-4 shrink-0 text-current" />
				{body}
			</Alert>
		);
	}

	return (
		<Alert variant={v} layout="stack" className="not-prose my-6 w-full">
			<div className="flex items-start gap-2">
				<Icon className="mt-0.5 size-4 shrink-0 text-current" />
				<div className="min-h-4 min-w-0 font-medium tracking-tight">{resolvedTitle}</div>
			</div>
			{/* 본문 없이 제목만 둔 콜아웃은 빈 본문 칸을 그리지 않는다. */}
			{body ? <div className="mt-2">{body}</div> : null}
		</Alert>
	);
};

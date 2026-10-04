"use client";

import { ADMIN_LOCALE, CMS_TIME_ZONE, parseDateTimeInput } from "@bh2980/cms/client";
import {
	type CmsAdminComponents,
	CmsAdminComponentsProvider,
	type EntryActionContext,
	type EntryActionExtension,
	type EntryActionResult,
} from "@bh2980/cms-admin";
import { CmsApiError, cmsFetch, errorText } from "@bh2980/cms-admin/api";
import { Button } from "@bh2980/cms-admin/ui/button";
import { DropdownMenuItem } from "@bh2980/cms-admin/ui/dropdown-menu";
import { CalendarClock } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { SCHEDULE_PLUGIN_NAME } from "../options";
import type { EntrySchedule } from "../types";
import { formatScheduleTime, ScheduleDialog, ScheduleNotice } from "./dialog";

const scheduleUrl = (entryId: string) => `/api/cms/v1/entries/${entryId}/schedule`;

/** 설정 시간대의 이름(예: `한국 표준시`). 예약 시각 안내에 쓴다. */
const timeZoneName = () =>
	new Intl.DateTimeFormat(ADMIN_LOCALE, { timeZone: CMS_TIME_ZONE, timeZoneName: "long" })
		.formatToParts(new Date())
		.find((part) => part.type === "timeZoneName")?.value ?? CMS_TIME_ZONE;

/**
 * 편집 화면의 발행 예약. 발행 메뉴의 "발행 예약"이 예약 창을 열고, 예약이 걸린 글(서버가 잠근 글)에는 안내 띠와
 * 발행 단추 자리의 "예약 해제"를 둔다.
 */
function useScheduleAction(context: EntryActionContext): EntryActionResult {
	const { entry } = context;
	const [schedule, setSchedule] = useState<EntrySchedule<string> | null>(null);
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	// 글을 불러오거나 판·잠금이 바뀌면 예약 상태를 다시 읽는다.
	const entryId = entry?.id;
	const version = entry?.version;
	const lockedBy = entry?.lockedBy;
	// biome-ignore lint/correctness/useExhaustiveDependencies: 판·잠금이 바뀔 때 다시 읽는다
	useEffect(() => {
		if (!entryId) {
			setSchedule(null);
			return;
		}
		let cancelled = false;
		cmsFetch<EntrySchedule<string>>(scheduleUrl(entryId))
			.then((loaded) => {
				if (!cancelled) setSchedule(loaded);
			})
			.catch(() => {
				if (!cancelled) setSchedule(null);
			});
		return () => {
			cancelled = true;
		};
	}, [entryId, version, lockedBy]);

	const submit = async (dateTime: string) => {
		if (context.busy) return;
		setError(null);
		const scheduledAt = parseDateTimeInput(dateTime);
		if (!scheduledAt) {
			setError(`예약 일시를 확인하세요. ${timeZoneName()} 기준입니다.`);
			return;
		}
		if (Date.parse(scheduledAt) <= Date.now()) {
			setError("예약은 미래 시각만 지정할 수 있습니다.");
			return;
		}
		setSubmitting(true);
		context.setBusy(true);
		try {
			const id = await context.ensureSaved("예약", setError);
			if (!id) return;
			await cmsFetch(scheduleUrl(id), {
				method: "POST",
				json: { expectedVersion: context.getVersion(), scheduledAt },
				fallback: "예약하지 못했습니다.",
			});
			setOpen(false);
			await context.reload();
			toast.success(`${formatScheduleTime(scheduledAt)}에 발행하도록 예약했습니다.`);
		} catch (failure) {
			// 발행 검사에 걸리면 창을 닫고 문제 목록을 보인다. 그 밖의 실패는 창 안에 보인다.
			if (failure instanceof CmsApiError && failure.issues.length > 0) {
				context.showIssues(failure.issues);
				setOpen(false);
				toast.error("예약할 수 없습니다. 아래 문제를 수정하세요.");
				return;
			}
			setError(errorText(failure, "예약하지 못했습니다."));
		} finally {
			setSubmitting(false);
			context.setBusy(false);
		}
	};

	const cancel = async () => {
		const pending = schedule?.pending;
		if (!entryId || !pending || context.busy) return;
		setSubmitting(true);
		context.setBusy(true);
		try {
			await cmsFetch(`${scheduleUrl(entryId)}?scheduleId=${pending.id}`, { method: "DELETE" });
			await context.reload();
			toast.success("예약을 해제했습니다. 이제 편집할 수 있습니다.");
		} catch (failure) {
			toast.error(errorText(failure, "예약을 해제하지 못했습니다."));
		} finally {
			setSubmitting(false);
			context.setBusy(false);
		}
	};

	return {
		publishMenu: (
			<DropdownMenuItem
				onClick={() => {
					setError(null);
					setOpen(true);
				}}
			>
				<CalendarClock aria-hidden />
				발행 예약
			</DropdownMenuItem>
		),
		notice: <ScheduleNotice schedule={schedule} />,
		lockedAction: (
			<Button type="button" size="sm" disabled={context.busy} onClick={() => void cancel()}>
				{submitting ? "예약 해제 중…" : "예약 해제"}
			</Button>
		),
		overlay: (
			<ScheduleDialog
				open={open}
				onOpenChange={setOpen}
				runnerConfigured={schedule?.runnerConfigured}
				submitting={submitting}
				error={error}
				onSubmit={(dateTime) => void submit(dateTime)}
			/>
		),
	};
}

export const scheduleAction: EntryActionExtension = { name: SCHEDULE_PLUGIN_NAME, use: useScheduleAction };

const components: CmsAdminComponents = { entryActions: [scheduleAction] };

/** 편집 화면에 발행 예약을 넣는다. */
export function ScheduleProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}

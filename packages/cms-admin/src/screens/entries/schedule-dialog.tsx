"use client";

import { formatDateTimeInput } from "@bh2980/cms/client";
import { useState } from "react";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Field, FieldError, FieldLabel } from "../../ui/field";
import { Input } from "../../ui/input";
import type { EntryData } from "./entry-form";

/** 서울 시각 `2026-10-01 09:00`. */
export const formatSeoul = (value: string | null | undefined) => formatDateTimeInput(value ?? null).replace("T", " ");

/**
 * 발행 예약 창. 열 때마다 빈 입력으로 시작한다. 입력한 서울 시각 문자열을 그대로 넘기고, 검사·요청은 부르는 쪽이 한다.
 * 검사·요청이 실패하면 부르는 쪽이 `error`로 넘기고, 창 안에 보인다(창 밖에 보이지 않는다).
 */
export function ScheduleDialog({
	open,
	onOpenChange,
	runnerConfigured,
	submitting,
	error,
	onSubmit,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 외부 실행기 연결 여부. 모르면(새 글) 안내하지 않는다. */
	runnerConfigured: boolean | undefined;
	submitting: boolean;
	/** 창 안에 보일 오류. */
	error?: string | null;
	onSubmit: (seoulDateTime: string) => void;
}) {
	const [input, setInput] = useState("");
	// 열릴 때마다 입력을 비운다(부르는 쪽이 `open`을 직접 바꿔도).
	const [wasOpen, setWasOpen] = useState(open);
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) setInput("");
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>발행 예약</DialogTitle>
					<DialogDescription>
						저장된 초안을 검증한 뒤 예약합니다. 예약 중에는 편집이 잠깁니다. 정해진 시각의 실행은 외부 실행기가
						맡습니다.
					</DialogDescription>
				</DialogHeader>
				<form
					className="contents"
					onSubmit={(event) => {
						event.preventDefault();
						if (input && !submitting) onSubmit(input);
					}}
				>
					<Field data-invalid={Boolean(error) || undefined}>
						<FieldLabel htmlFor="schedule-date">예약 일시</FieldLabel>
						<Input
							id="schedule-date"
							type="datetime-local"
							value={input}
							aria-invalid={Boolean(error) || undefined}
							aria-describedby={error ? "schedule-date-error" : undefined}
							onChange={(event) => setInput(event.target.value)}
						/>
						{error && <FieldError id="schedule-date-error">{error}</FieldError>}
					</Field>
					{runnerConfigured === false && (
						<p className="text-amber-700 text-xs dark:text-amber-400">
							외부 실행기 연결 필요: 연결 전에는 예약이 실행 대기로 남습니다.
						</p>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							취소
						</Button>
						<Button type="submit" disabled={!input || submitting}>
							{submitting ? "예약 중…" : "예약"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** 대기 중인 예약(편집 잠김)이나 마지막 예약 실패를 편집 화면 위에 알린다. */
export function ScheduleNotice({ schedule }: { schedule: EntryData["schedule"] }) {
	if (schedule?.pending) {
		return (
			<section aria-label="예약" className="flex flex-wrap items-center gap-2 border-b bg-primary/10 px-4 py-2 text-sm">
				<span>
					{formatSeoul(schedule.pending.scheduledAt)} 발행 예약됨 — 예약 중에는 본문과 속성을 편집할 수 없습니다.
					{Date.parse(schedule.pending.scheduledAt) <= Date.now() && " 예정 시각이 지나 실행 대기 중입니다."}
					{!schedule.runnerConfigured && " 외부 실행기 연결 필요: 연결되지 않으면 자동으로 발행되지 않습니다."}
				</span>
			</section>
		);
	}
	if (schedule?.last?.status === "failed") {
		return (
			<p role="alert" className="border-b bg-destructive/10 px-4 py-2 text-destructive text-sm">
				{formatSeoul(schedule.last.scheduledAt)} 예약 발행이 실패해 공개본을 그대로 유지했습니다 (
				{schedule.last.failureCode}).
				{schedule.last.failureDetail ? ` ${schedule.last.failureDetail.slice(0, 200)}` : ""}
			</p>
		);
	}
	return null;
}

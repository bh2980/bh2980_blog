"use client";

import { useEffect, useMemo, useState } from "react";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import type { BulkOp } from "@/cms/core/api";
import { isRecordCollection } from "@/cms/core/collections";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cmsFetch, errorText } from "../admin-api";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { useTaxonomy } from "../shared/use-taxonomy";

export type BulkItemResult =
	| { id: string; ok: true; version: number }
	| { id: string; ok: false; error: string; issues?: CmsIssue[] };

export type BulkSelection = { id: string; expectedVersion: number; title?: string | null };

const ACTIONS: { value: BulkOp; label: string; confirm?: string; content?: boolean; post?: boolean }[] = [
	{ value: "tags.add", label: "태그 추가", content: true },
	{ value: "tags.remove", label: "태그 제거", content: true },
	{ value: "category.set", label: "카테고리 변경", post: true },
	{ value: "folder.move", label: "폴더 이동" },
	{
		value: "publish",
		label: "발행",
		confirm: "선택한 글을 발행할까요? 각 글에 발행 검증을 적용하고 최신 초안이 공개됩니다.",
		content: true,
	},
	{ value: "archive", label: "보관", confirm: "선택한 글을 보관할까요? 공개가 종료됩니다.", content: true },
	{ value: "unarchive", label: "보관 해제", content: true },
	{ value: "trash", label: "휴지통 이동", confirm: "선택한 항목을 휴지통으로 옮길까요? 공개가 종료됩니다." },
];

/** 작업별 실패 사유(§3.4 "성공·실패를 구분하고 실패한 항목만 다시 실행"). */
export const BULK_ERROR_LABEL: Record<string, string> = {
	conflict: "다른 곳에서 먼저 바뀌었습니다(버전 충돌). 목록을 새로고침한 뒤 다시 실행하세요.",
	not_found: "삭제되었거나 없습니다.",
	invalid_input: "이 항목에는 적용할 수 없습니다.",
	invalid_status: "현재 상태에서는 할 수 없는 작업입니다.",
	locked: "예약된 글입니다. 편집 화면에서 예약을 해제하세요.",
	publish_validation_failed: "발행 검증을 통과하지 못했습니다.",
	slug_conflict: "같은 주소(slug)가 이미 사용 중입니다.",
	in_use: "다른 콘텐츠가 사용 중입니다.",
	invalid_reference: "휴지통에 있는 항목을 참조합니다.",
};

async function runBulk(
	op: BulkOp,
	items: BulkSelection[],
	params: { tagIds?: string[]; categoryId?: string | null; folderId?: string | null },
): Promise<BulkItemResult[]> {
	const data = await cmsFetch<{ results: BulkItemResult[] }>("/api/cms/v1/bulk", {
		method: "POST",
		json: { op, items: items.map(({ id, expectedVersion }) => ({ id, expectedVersion })), ...params },
		fallback: "일괄 작업 요청이 실패했습니다.",
	});
	return data.results;
}

/**
 * 일괄 작업(§3.4). 현재 페이지에서 고른 항목에만 적용하고, 항목마다 결과를 보여 준다.
 * 실패한 항목만 다시 실행할 수 있다.
 */
export function BulkBar({
	collection,
	selected,
	folders,
	onClearSelection,
	onDone,
}: {
	collection: string;
	selected: BulkSelection[];
	folders: Folder[];
	onClearSelection: () => void;
	onDone: (failedIds: string[]) => void;
}) {
	const isRecord = isRecordCollection(collection);
	const actions = useMemo(
		() => ACTIONS.filter((action) => (!action.content || !isRecord) && (!action.post || collection === "post")),
		[isRecord, collection],
	);
	const [action, setAction] = useState<BulkOp>(actions[0]?.value ?? "trash");
	const [checked, setChecked] = useState<string[]>([]);
	const [single, setSingle] = useState("");
	const [isRunning, setIsRunning] = useState(false);
	const [results, setResults] = useState<BulkItemResult[] | null>(null);
	const [ranItems, setRanItems] = useState<BulkSelection[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const tags = useTaxonomy("tag", !isRecord);
	const categories = useTaxonomy("category", collection === "post");

	useEffect(() => {
		if (!actions.some((candidate) => candidate.value === action)) setAction(actions[0]?.value ?? "trash");
	}, [actions, action]);

	// 작업을 바꾸면 그 작업의 입력값을 비운다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed by action
	useEffect(() => {
		setChecked([]);
		setSingle("");
		setError(null);
	}, [action]);

	const needsTags = action === "tags.add" || action === "tags.remove";
	const needsSingle = action === "category.set" || action === "folder.move";
	const canRun =
		!isRunning && selected.length > 0 && (needsTags ? checked.length > 0 : needsSingle ? single !== "" : true);
	const activeAction = actions.find((candidate) => candidate.value === action);

	const run = async (items: BulkSelection[]) => {
		setIsRunning(true);
		setError(null);
		try {
			const params = needsTags
				? { tagIds: checked }
				: action === "category.set"
					? { categoryId: single === "__none__" ? null : single }
					: action === "folder.move"
						? { folderId: single === "__unfiled__" ? null : single }
						: {};
			const out = await runBulk(action, items, params);
			setResults(out);
			setRanItems(items);
			onDone(out.filter((result) => !result.ok).map((result) => result.id));
		} catch (err) {
			setError(errorText(err, "일괄 작업이 실패했습니다."));
		} finally {
			setIsRunning(false);
		}
	};

	const start = () => {
		if (activeAction?.confirm) {
			setConfirm({
				title: `${activeAction.label} — ${selected.length}개`,
				description: activeAction.confirm,
				confirmLabel: "계속",
				destructive: action === "trash",
				onConfirm: () => run(selected),
			});
		} else {
			void run(selected);
		}
	};

	const failures = (results ?? []).filter((result): result is Extract<BulkItemResult, { ok: false }> => !result.ok);
	const successes = (results ?? []).length - failures.length;
	const titleOf = (id: string) => ranItems.find((item) => item.id === id)?.title || id.slice(0, 8);

	if (selected.length === 0 && !results) return null;

	const selectClass =
		"h-auto rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 pr-9 text-neutral-200 text-sm shadow-none dark:bg-neutral-900";

	return (
		<section aria-label="일괄 작업" className="border-neutral-800 border-b bg-neutral-900/60 px-6 py-3">
			<div className="flex flex-wrap items-center gap-3 text-sm">
				<span className="font-semibold text-white">{selected.length}개 선택</span>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onClearSelection}
					className="h-7 text-neutral-400 text-xs"
				>
					선택 해제
				</Button>

				<NativeSelect
					aria-label="일괄 작업 종류"
					value={action}
					onChange={(event) => setAction(event.target.value as BulkOp)}
					className={selectClass}
				>
					{actions.map((candidate) => (
						<option key={candidate.value} value={candidate.value}>
							{candidate.label}
						</option>
					))}
				</NativeSelect>

				{needsTags && (
					<fieldset className="flex max-h-24 flex-wrap items-center gap-2 overflow-auto">
						<legend className="sr-only">적용할 태그</legend>
						{tags.options.length === 0 && <span className="text-neutral-500 text-xs">태그 없음</span>}
						{tags.options.map((option) => (
							<label key={option.id} className="flex items-center gap-1 text-neutral-300 text-xs">
								<input
									type="checkbox"
									checked={checked.includes(option.id)}
									onChange={() =>
										setChecked((prev) =>
											prev.includes(option.id) ? prev.filter((id) => id !== option.id) : [...prev, option.id],
										)
									}
								/>
								{option.title}
							</label>
						))}
					</fieldset>
				)}

				{action === "category.set" && (
					<NativeSelect
						aria-label="대상 카테고리"
						value={single}
						onChange={(event) => setSingle(event.target.value)}
						className={selectClass}
					>
						<option value="">카테고리 선택</option>
						<option value="__none__">지우기(없음)</option>
						{categories.options.map((option) => (
							<option key={option.id} value={option.id}>
								{option.title}
							</option>
						))}
					</NativeSelect>
				)}

				{action === "folder.move" && (
					<NativeSelect
						aria-label="이동할 폴더"
						value={single}
						onChange={(event) => setSingle(event.target.value)}
						className={selectClass}
					>
						<option value="">폴더 선택</option>
						<option value="__unfiled__">미분류</option>
						{folders.map((folder) => (
							<option key={folder.id} value={folder.id}>
								{folder.name}
							</option>
						))}
					</NativeSelect>
				)}

				<Button
					type="button"
					disabled={!canRun}
					onClick={start}
					className="h-auto rounded-lg bg-white px-3.5 py-1.5 font-semibold text-neutral-950 text-sm hover:bg-neutral-200"
				>
					{isRunning ? "실행 중..." : "일괄 실행"}
				</Button>

				{results && (
					<output className="text-neutral-300 text-xs">
						성공 {successes} / 실패 {failures.length}
					</output>
				)}
				{failures.length > 0 && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 text-xs"
						onClick={() => void run(ranItems.filter((item) => failures.some((failure) => failure.id === item.id)))}
					>
						실패만 다시 실행
					</Button>
				)}
			</div>

			{error && (
				<p role="alert" className="pt-2 text-red-400 text-xs">
					{error}
				</p>
			)}
			{failures.length > 0 && (
				<ul className="flex flex-col gap-1 pt-2 text-red-300 text-xs">
					{failures.map((failure) => (
						<li key={failure.id}>
							<span className="font-medium">{titleOf(failure.id)}</span> —{" "}
							{BULK_ERROR_LABEL[failure.error] ?? failure.error}
							{failure.issues?.length ? ` (${failure.issues.slice(0, 3).map(cmsIssueMessage).join(", ")})` : ""}
						</li>
					))}
				</ul>
			)}
			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
		</section>
	);
}

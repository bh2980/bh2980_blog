"use client";

import { ChevronDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import type { BulkOp } from "@/cms/core/api";
import { isRecordCollection } from "@/cms/core/collections";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/utils/cn";
import { cmsFetch, errorText } from "../admin-api";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { useTaxonomy } from "../shared/use-taxonomy";

export type BulkUsage = { entryId: string; title: string | null; collection: string; state: string };

export type BulkItemResult =
	| { id: string; ok: true; version: number }
	| { id: string; ok: false; error: string; issues?: CmsIssue[]; usages?: BulkUsage[] };

export type BulkSelection = { id: string; expectedVersion: number; title?: string | null };

type ActionDef = {
	value: BulkOp;
	label: string;
	confirm?: string;
	content?: boolean;
	post?: boolean;
	destructive?: boolean;
};

const LIST_ACTIONS: ActionDef[] = [
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
	{
		value: "trash",
		label: "휴지통 이동",
		confirm: "선택한 항목을 휴지통으로 옮길까요? 공개가 종료됩니다.",
		destructive: true,
	},
];

const TRASH_ACTIONS: ActionDef[] = [
	{
		value: "permanentDelete",
		label: "영구 삭제",
		confirm:
			"선택한 항목을 영구 삭제할까요? 되돌릴 수 없습니다. 다른 콘텐츠가 쓰는 항목은 지우지 않고 사유를 보여 줍니다.",
		destructive: true,
	},
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

/** 실패 한 건의 사유. 영구 삭제를 막은 사용처가 있으면 `사용 중: ○○`으로 이름을 댄다(v2 A3). */
export function describeBulkFailure(failure: Extract<BulkItemResult, { ok: false }>): string {
	if (failure.error === "in_use" && failure.usages?.length) {
		const names = [...new Set(failure.usages.map((usage) => usage.title || "제목 없음"))];
		return `사용 중: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` 외 ${names.length - 3}개` : ""}`;
	}
	const base = BULK_ERROR_LABEL[failure.error] ?? failure.error;
	return failure.issues?.length ? `${base} (${failure.issues.slice(0, 3).map(cmsIssueMessage).join(", ")})` : base;
}

export async function runBulk(
	op: BulkOp,
	items: BulkSelection[],
	params: { tagIds?: string[]; categoryId?: string | null; folderId?: string | null } = {},
): Promise<BulkItemResult[]> {
	const data = await cmsFetch<{ results: BulkItemResult[] }>("/api/cms/v1/bulk", {
		method: "POST",
		json: { op, items: items.map(({ id, expectedVersion }) => ({ id, expectedVersion })), ...params },
		fallback: "일괄 작업 요청이 실패했습니다.",
	});
	return data.results;
}

/**
 * 일괄 작업 줄의 태그 선택. 폴더·카테고리 선택처럼 작은 버튼 하나로 두고, 누르면 검색과 체크 목록이 열린다.
 * 버튼에는 고른 태그를 `React 외 2개`처럼 줄여 보여 줘서 줄이 넘치지 않는다.
 */
function TagPicker({
	options,
	value,
	onValueChange,
}: {
	options: { id: string; title: string }[];
	value: string[];
	onValueChange: (value: string[]) => void;
}) {
	const names = value.map((id) => options.find((option) => option.id === id)?.title ?? id);
	const summary =
		names.length === 0 ? "태그 선택" : names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}개`;
	const toggle = (id: string) =>
		onValueChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						type="button"
						variant="outline"
						size="sm"
						aria-label={`적용할 태그: ${names.length === 0 ? "없음" : names.join(", ")}`}
						className={cn(
							"max-w-56 justify-between gap-1.5 font-normal",
							names.length === 0 && "text-muted-foreground",
						)}
					/>
				}
			>
				<span className="truncate">{summary}</span>
				<ChevronDownIcon aria-hidden className="size-4 text-muted-foreground" />
			</PopoverTrigger>
			<PopoverContent align="start" className="w-64 p-0">
				<Command>
					<CommandInput placeholder="태그 검색" aria-label="태그 검색" />
					<CommandList className="max-h-64">
						<CommandEmpty>일치하는 태그가 없습니다.</CommandEmpty>
						<CommandGroup>
							{options.map((option) => (
								<CommandItem key={option.id} value={`${option.title} ${option.id}`} onSelect={() => toggle(option.id)}>
									<Checkbox
										checked={value.includes(option.id)}
										tabIndex={-1}
										aria-hidden
										className="pointer-events-none"
									/>
									{option.title}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

/**
 * 일괄 작업(§3.4). 현재 페이지에서 고른 항목에만 적용하고, 항목마다 결과를 보여 준다.
 * 실패한 항목만 다시 실행할 수 있다. 휴지통 화면(`mode="trash"`)에서는 일괄 영구 삭제만 제공한다.
 */
export function BulkBar({
	collection,
	selected,
	folders,
	mode = "list",
	onClearSelection,
	onRun = runBulk,
	onDone,
}: {
	collection: string;
	selected: BulkSelection[];
	folders: Folder[];
	mode?: "list" | "trash";
	onClearSelection: () => void;
	/** 작업 요청. 목록 화면은 목록에 먼저 반영(낙관적 갱신)하는 요청을 넘긴다. */
	onRun?: typeof runBulk;
	onDone?: (failedIds: string[]) => void;
}) {
	const isRecord = isRecordCollection(collection);
	const actions = useMemo(
		() =>
			mode === "trash"
				? TRASH_ACTIONS
				: LIST_ACTIONS.filter((action) => (!action.content || !isRecord) && (!action.post || collection === "post")),
		[isRecord, collection, mode],
	);
	const [action, setAction] = useState<BulkOp>(actions[0]?.value ?? "trash");
	const [checked, setChecked] = useState<string[]>([]);
	const [single, setSingle] = useState("");
	const [isRunning, setIsRunning] = useState(false);
	const [results, setResults] = useState<BulkItemResult[] | null>(null);
	const [ranItems, setRanItems] = useState<BulkSelection[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const tags = useTaxonomy("tag", !isRecord && mode === "list");
	const categories = useTaxonomy("category", collection === "post" && mode === "list");

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
			const out = await onRun(action, items, params);
			setResults(out);
			setRanItems(items);
			onDone?.(out.filter((result) => !result.ok).map((result) => result.id));
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
				confirmLabel: activeAction.label,
				destructive: activeAction.destructive,
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

	const categoryItems = [
		{ value: "__none__", label: "지우기(없음)" },
		...categories.options.map((option) => ({ value: option.id, label: option.title })),
	];
	const folderItems = [
		{ value: "__unfiled__", label: "최상위" },
		...folders.map((folder) => ({ value: folder.id, label: folder.name })),
	];

	return (
		<section aria-label="일괄 작업" className="border-b bg-primary/5 px-5 py-2">
			<div className="flex min-h-7 flex-wrap items-center gap-2 text-sm">
				<span className="font-medium text-primary">{selected.length}개 선택</span>
				<Button type="button" variant="ghost" size="xs" onClick={onClearSelection}>
					선택 해제
				</Button>

				{actions.length > 1 ? (
					<Select
						value={action}
						items={actions.map((candidate) => ({ value: candidate.value, label: candidate.label }))}
						onValueChange={(value) => value && setAction(value as BulkOp)}
					>
						<SelectTrigger size="sm" aria-label="일괄 작업 종류">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{actions.map((candidate) => (
								<SelectItem key={candidate.value} value={candidate.value}>
									{candidate.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}

				{needsTags && <TagPicker options={tags.options} value={checked} onValueChange={setChecked} />}

				{needsSingle && (
					<Select
						value={single || null}
						items={action === "category.set" ? categoryItems : folderItems}
						onValueChange={(value) => setSingle(typeof value === "string" ? value : "")}
					>
						<SelectTrigger size="sm" aria-label={action === "category.set" ? "대상 카테고리" : "이동할 폴더"}>
							<SelectValue placeholder={action === "category.set" ? "카테고리 선택" : "폴더 선택"} />
						</SelectTrigger>
						<SelectContent>
							{(action === "category.set" ? categoryItems : folderItems).map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				<Button
					type="button"
					size="sm"
					variant={activeAction?.destructive ? "destructive" : "default"}
					disabled={!canRun}
					onClick={start}
				>
					{isRunning ? "실행 중..." : (activeAction?.label ?? "실행")}
				</Button>

				{results && (
					<output className="text-muted-foreground text-xs">
						성공 {successes} / 실패 {failures.length}
					</output>
				)}
				{failures.length > 0 && (
					<Button
						type="button"
						variant="outline"
						size="xs"
						onClick={() => void run(ranItems.filter((item) => failures.some((failure) => failure.id === item.id)))}
					>
						실패만 다시 실행
					</Button>
				)}
			</div>

			{error && (
				<p role="alert" className="pt-2 text-destructive text-xs">
					{error}
				</p>
			)}
			{failures.length > 0 && (
				<ul className="flex flex-col gap-1 pt-2 text-destructive text-xs">
					{failures.map((failure) => (
						<li key={failure.id}>
							<span className="font-medium">{titleOf(failure.id)}</span> — {describeBulkFailure(failure)}
						</li>
					))}
				</ul>
			)}
			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
		</section>
	);
}

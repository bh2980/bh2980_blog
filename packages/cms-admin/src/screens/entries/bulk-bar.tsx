"use client";

import type { BulkOp } from "@bh2980/cms/client";
import { isItemCollection, taxonomyFieldsOf } from "@bh2980/cms/client";
import type { Folder } from "@bh2980/cms/runtime";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { josa } from "../../lib/utils/josa";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { cmsFetch, errorText } from "../admin-api";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { useTaxonomyOptions } from "../shared/use-taxonomy";

export type BulkUsage = { entryId: string; title: string | null; collection: string; state: string };

export type BulkItemResult =
	| { id: string; ok: true; version: number }
	| { id: string; ok: false; error: string; issues?: CmsIssue[]; usages?: BulkUsage[] };

export type BulkSelection = { id: string; expectedVersion: number; title?: string | null };

type RelationOp = Extract<BulkOp, `relation.${string}`>;

/**
 * 화면의 작업. 분류 작업은 `relation.add:tagIds`처럼 관계 필드 일괄 작업과 필드 이름을 함께 적는다.
 * 서버에는 관계 필드 일괄 작업(`relation.*`)으로 보낸다.
 */
type ListAction = Exclude<BulkOp, RelationOp> | `${RelationOp}:${string}`;

type ActionDef = {
	value: ListAction;
	label: string;
	/**
	 * 확인창의 질문. 여러 개를 한 번에 바꾸는 작업은 모두 묻는다(§5).
	 * `count`는 고른 수, `target`은 고른 대상 이름(폴더·분류). 대상을 비우는 작업이면 `null`.
	 */
	ask: (count: number, target: string | null) => string;
	content?: boolean;
	destructive?: boolean;
	/** 분류 작업이면 관계 필드. */
	relation?: { op: RelationOp; field: string; label: string; many: boolean };
};

/** 받침에 맞는 "으로/로"(ㄹ 받침은 "로"). */
const toward = (word: string) => {
	const code = word.charCodeAt(word.length - 1) - 0xac00;
	const final = code >= 0 && code <= 11171 ? code % 28 : 0;
	return `${word}${final === 0 || final === 8 ? "로" : "으로"}`;
};

/**
 * 컬렉션의 분류 필드(태그·카테고리 등)별 작업. 여러 개 필드는 추가·빼기, 하나뿐인 필드는 바꾸기다.
 * 여러 개 필드 작업을 먼저 둔다.
 */
export function taxonomyActions(collection: string): ActionDef[] {
	const fields = taxonomyFieldsOf(collection).flatMap((stored) =>
		stored.field.kind === "relation"
			? [{ name: stored.name, label: stored.field.label, many: stored.field.many === true }]
			: [],
	);
	const action = (op: RelationOp, field: (typeof fields)[number], verb: string, ask: ActionDef["ask"]): ActionDef => ({
		value: `${op}:${field.name}`,
		label: `${field.label} ${verb}`,
		ask,
		relation: { op, field: field.name, label: field.label, many: field.many },
	});
	return [
		...fields
			.filter((field) => field.many)
			.flatMap((field) => [
				action(
					"relation.add",
					field,
					"추가",
					(count, target) => `선택한 글 ${count}개에 '${target}' ${josa(field.label, "을", "를")} 추가할까요?`,
				),
				action(
					"relation.remove",
					field,
					"빼기",
					(count, target) => `선택한 글 ${count}개에서 '${target}' ${josa(field.label, "을", "를")} 뺄까요?`,
				),
			]),
		...fields
			.filter((field) => !field.many)
			.map((field) =>
				action("relation.set", field, "바꾸기", (count, target) =>
					target === null
						? `선택한 글 ${count}개의 ${josa(field.label, "을", "를")} 비울까요?`
						: `선택한 글 ${count}개의 ${josa(field.label, "을", "를")} ${toward(`'${target}'`)} 바꿀까요?`,
				),
			),
	];
}

const LIST_ACTIONS: ActionDef[] = [
	{
		value: "folder.move",
		label: "폴더로 이동",
		ask: (count, target) =>
			`선택한 항목 ${count}개를 ${target === null ? "최상위로" : `'${target}' 폴더로`} 이동할까요?`,
	},
	{
		value: "publish",
		label: "발행",
		ask: (count) => `선택한 글 ${count}개를 발행할까요? 각 글에 발행 검증을 적용하고 최신 초안이 공개됩니다.`,
		content: true,
	},
	{
		value: "archive",
		label: "보관",
		ask: (count) => `선택한 글 ${count}개를 보관할까요? 공개가 종료됩니다.`,
		content: true,
	},
	{
		value: "unarchive",
		label: "보관 해제",
		ask: (count) => `선택한 글 ${count}개의 보관을 해제할까요? 초안으로 돌아가고 자동으로 다시 공개하지 않습니다.`,
		content: true,
	},
	{
		value: "trash",
		label: "휴지통으로 이동",
		ask: (count) => `선택한 항목 ${count}개를 휴지통으로 이동할까요? 공개가 종료됩니다.`,
		destructive: true,
	},
];

const TRASH_ACTIONS: ActionDef[] = [
	{
		value: "permanentDelete",
		label: "영구 삭제",
		ask: (count) =>
			`선택한 항목 ${count}개를 영구 삭제할까요? 되돌릴 수 없습니다. 다른 콘텐츠가 쓰는 항목은 삭제하지 않고 사유를 보여 줍니다.`,
		destructive: true,
	},
];

/** 작업별 실패 사유(§3.4 "성공·실패를 구분하고 실패한 항목만 다시 실행"). */
export const BULK_ERROR_LABEL: Record<string, string> = {
	conflict: "다른 곳에서 먼저 바뀌었습니다. 목록을 새로고침한 뒤 다시 실행하세요.",
	not_found: "삭제되었거나 없습니다.",
	invalid_input: "이 항목에는 적용할 수 없습니다.",
	invalid_status: "현재 상태에서는 할 수 없는 작업입니다.",
	locked: "예약된 글입니다. 편집 화면에서 예약을 해제하세요.",
	publish_validation_failed: "발행 검증을 통과하지 못했습니다.",
	slug_conflict: "같은 주소가 이미 사용 중입니다.",
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
	return failure.issues?.length ? `${base} ${failure.issues.slice(0, 3).map(cmsIssueMessage).join(" ")}` : base;
}

export async function runBulk(
	op: BulkOp,
	items: BulkSelection[],
	params: { field?: string; ids?: string[]; id?: string | null; folderId?: string | null } = {},
): Promise<BulkItemResult[]> {
	const data = await cmsFetch<{ results: BulkItemResult[] }>("/api/cms/v1/bulk", {
		method: "POST",
		json: { op, items: items.map(({ id, expectedVersion }) => ({ id, expectedVersion })), ...params },
		fallback: "일괄 작업 요청이 실패했습니다.",
	});
	return data.results;
}

/**
 * 일괄 작업 줄의 여러 개 분류(태그 등) 선택. 폴더·카테고리 선택처럼 작은 버튼 하나로 두고, 누르면 검색과 체크 목록이 열린다.
 * 버튼에는 고른 항목을 `React 외 2개`처럼 줄여 보여 줘서 줄이 넘치지 않는다.
 */
function ManyPicker({
	label,
	options,
	value,
	onValueChange,
}: {
	label: string;
	options: readonly { id: string; title: string }[];
	value: string[];
	onValueChange: (value: string[]) => void;
}) {
	const names = value.map((id) => options.find((option) => option.id === id)?.title ?? id);
	const summary =
		names.length === 0 ? `${label} 선택` : names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}개`;
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
						aria-label={`적용할 ${label}: ${names.length === 0 ? "없음" : names.join(", ")}`}
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
					<CommandInput placeholder={`${label} 검색`} aria-label={`${label} 검색`} />
					<CommandList className="max-h-64">
						<CommandEmpty>일치하는 {josa(label, "이", "가")} 없습니다.</CommandEmpty>
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
	const isRecord = isItemCollection(collection);
	const actions = useMemo(
		() =>
			mode === "trash"
				? TRASH_ACTIONS
				: [...taxonomyActions(collection), ...LIST_ACTIONS.filter((action) => !action.content || !isRecord)],
		[isRecord, collection, mode],
	);
	const [action, setAction] = useState<ListAction>(actions[0]?.value ?? "trash");
	const [checked, setChecked] = useState<string[]>([]);
	const [single, setSingle] = useState("");
	const [isRunning, setIsRunning] = useState(false);
	const [results, setResults] = useState<BulkItemResult[] | null>(null);
	const [ranItems, setRanItems] = useState<BulkSelection[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const options = useTaxonomyOptions(collection, mode === "list");

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

	const activeAction = actions.find((candidate) => candidate.value === action);
	const relation = activeAction?.relation;
	const needsMany = relation !== undefined && relation.op !== "relation.set";
	const needsSingle = relation?.op === "relation.set" || action === "folder.move";
	const relationOptions = relation ? (options[relation.field] ?? []) : [];
	const canRun =
		!isRunning && selected.length > 0 && (needsMany ? checked.length > 0 : needsSingle ? single !== "" : true);

	const run = async (items: BulkSelection[]) => {
		setIsRunning(true);
		setError(null);
		try {
			const params = needsMany
				? { field: relation.field, ids: checked }
				: relation
					? { field: relation.field, id: single === "__none__" ? null : single }
					: action === "folder.move"
						? { folderId: single === "__unfiled__" ? null : single }
						: {};
			const out = await onRun(relation?.op ?? (action as BulkOp), items, params);
			setResults(out);
			setRanItems(items);
			onDone?.(out.filter((result) => !result.ok).map((result) => result.id));
		} catch (err) {
			setError(errorText(err, "일괄 작업이 실패했습니다."));
		} finally {
			setIsRunning(false);
		}
	};

	/** 고른 대상의 이름. 분류는 고른 이름들, 폴더는 폴더 이름이다. 비우는 선택이면 `null`. */
	const targetName = (): string | null => {
		const titleOf = (id: string) => relationOptions.find((option) => option.id === id)?.title ?? id;
		if (needsMany) return checked.map(titleOf).join(", ");
		if (relation) return single === "__none__" ? null : titleOf(single);
		if (action === "folder.move")
			return single === "__unfiled__" ? null : (folders.find((folder) => folder.id === single)?.name ?? single);
		return null;
	};

	// 여러 개를 한 번에 바꾸는 작업은 모두 묻는다(§5).
	const start = () => {
		if (!activeAction) return;
		setConfirm({
			title: activeAction.label,
			description: activeAction.ask(selected.length, targetName()),
			confirmLabel: activeAction.label,
			destructive: activeAction.destructive,
			onConfirm: () => run(selected),
		});
	};

	const failures = (results ?? []).filter((result): result is Extract<BulkItemResult, { ok: false }> => !result.ok);
	const successes = (results ?? []).length - failures.length;
	const titleOf = (id: string) => ranItems.find((item) => item.id === id)?.title || id.slice(0, 8);

	if (selected.length === 0 && !results) return null;

	const singleItems = relation
		? [
				{ value: "__none__", label: "없음" },
				...relationOptions.map((option) => ({ value: option.id, label: option.title })),
			]
		: [
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
						onValueChange={(value) => value && setAction(value as ListAction)}
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

				{needsMany && (
					<ManyPicker label={relation.label} options={relationOptions} value={checked} onValueChange={setChecked} />
				)}

				{needsSingle && (
					<Select
						value={single || null}
						items={singleItems}
						onValueChange={(value) => setSingle(typeof value === "string" ? value : "")}
					>
						<SelectTrigger size="sm" aria-label={relation ? `대상 ${relation.label}` : "이동할 폴더"}>
							<SelectValue placeholder={relation ? `${relation.label} 선택` : "폴더 선택"} />
						</SelectTrigger>
						<SelectContent>
							{singleItems.map((item) => (
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
					{isRunning ? "실행 중…" : (activeAction?.label ?? "실행")}
				</Button>

				{results && (
					<output className="text-muted-foreground text-xs">
						성공 {successes} · 실패 {failures.length}
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

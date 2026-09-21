"use client";

import { useEffect, useState } from "react";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import { BULK_ERROR_LABEL, runBulk, type BulkItemResult, type BulkOp } from "./bulk-client";

interface Option {
	id: string;
	title: string | null;
	name?: string;
}

interface BulkBarProps {
	selected: { id: string; expectedVersion: number }[];
	folders: Folder[];
	onClearSelection: () => void;
	onDone: (failedIds: string[]) => void;
}

const ACTIONS: { value: BulkOp; label: string; confirm?: string }[] = [
	{ value: "tags.add", label: "태그 추가" },
	{ value: "tags.remove", label: "태그 제거" },
	{ value: "category.set", label: "카테고리 변경" },
	{ value: "folder.move", label: "폴더 이동" },
	{ value: "archive", label: "보관" },
	{ value: "unarchive", label: "보관 해제" },
	{ value: "trash", label: "휴지통 이동", confirm: "선택한 글을 휴지통으로 이동할까요?" },
	{ value: "publish", label: "발행", confirm: "선택한 글을 발행할까요? 초안이 공개본에 반영됩니다." },
];

async function fetchOptions(collection: "tag" | "category"): Promise<Option[]> {
	const res = await fetch(`/api/cms/v1/entries?collection=${collection}&pageSize=100`);
	if (!res.ok) return [];
	const data = await res.json();
	return (data.items ?? []).map((i: any) => ({ id: i.id, title: i.title ?? null }));
}

export function BulkBar({ selected, folders, onClearSelection, onDone }: BulkBarProps) {
	const [action, setAction] = useState<BulkOp>("tags.add");
	const [options, setOptions] = useState<Option[]>([]);
	const [checked, setChecked] = useState<string[]>([]);
	const [single, setSingle] = useState<string>("");
	const [isRunning, setIsRunning] = useState(false);
	const [results, setResults] = useState<BulkItemResult[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	const needsMulti = action === "tags.add" || action === "tags.remove";
	const needsSingle = action === "category.set" || action === "folder.move";

	useEffect(() => {
		setChecked([]);
		setSingle("");
		setResults(null);
		setError(null);
		if (action === "tags.add" || action === "tags.remove") {
			fetchOptions("tag").then(setOptions).catch(() => setOptions([]));
		} else if (action === "category.set") {
			fetchOptions("category").then(setOptions).catch(() => setOptions([]));
		}
	}, [action]);

	const toggleCheck = (id: string) => {
		setChecked((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
	};

	const activeAction = ACTIONS.find((a) => a.value === action);

	const canRun =
		!isRunning && selected.length > 0 && (needsMulti ? checked.length > 0 : needsSingle ? single !== "" : true);

	const run = async (items: { id: string; expectedVersion: number }[]) => {
		setIsRunning(true);
		setError(null);
		try {
			const params =
				action === "tags.add" || action === "tags.remove"
					? { tagIds: checked }
					: action === "category.set"
						? { categoryId: single === "__none__" ? null : single }
						: action === "folder.move"
							? { folderId: single === "__root__" ? null : single }
							: {};
			const out = await runBulk(action, items, params);
			setResults(out);
			const failedIds = out.filter((r) => !r.ok).map((r) => r.id);
			onDone(failedIds);
		} catch (e) {
			setError(e instanceof Error ? e.message : "일괄 작업 실패");
		} finally {
			setIsRunning(false);
		}
	};

	const failures = (results ?? []).filter((r) => !r.ok);
	const successes = (results ?? []).filter((r) => r.ok).length;

	const rerunFailures = () => {
		const failedItems = failures
			.map((f) => selected.find((s) => s.id === f.id))
			.filter((s): s is { id: string; expectedVersion: number } => Boolean(s));
		if (failedItems.length > 0) void run(failedItems);
	};

	if (selected.length === 0 && !results) return null;

	return (
		<div className="border-b border-neutral-800 bg-neutral-900/60 px-6 py-3">
			<div className="flex flex-wrap items-center gap-3 text-sm">
				<span className="font-semibold text-white">{selected.length}개 선택</span>
				<button type="button" onClick={onClearSelection} className="text-xs text-neutral-400 hover:text-white">
					선택 해제
				</button>

				<select
					value={action}
					onChange={(e) => setAction(e.target.value as BulkOp)}
					className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600"
				>
					{ACTIONS.map((a) => (
						<option key={a.value} value={a.value}>
							{a.label}
						</option>
					))}
				</select>

				{needsMulti && (
					<div className="flex max-h-24 flex-wrap items-center gap-2 overflow-auto">
						{options.length === 0 && <span className="text-xs text-neutral-500">태그 없음</span>}
						{options.map((o) => (
							<label key={o.id} className="flex items-center gap-1 text-xs text-neutral-300">
								<input
									type="checkbox"
									checked={checked.includes(o.id)}
									onChange={() => toggleCheck(o.id)}
									className="accent-white"
								/>
								{o.title ?? o.id.slice(0, 8)}
							</label>
						))}
					</div>
				)}

				{action === "category.set" && (
					<select
						value={single}
						onChange={(e) => setSingle(e.target.value)}
						className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600"
					>
						<option value="">카테고리 선택</option>
						<option value="__none__">지우기(없음)</option>
						{options.map((o) => (
							<option key={o.id} value={o.id}>
								{o.title ?? o.id.slice(0, 8)}
							</option>
						))}
					</select>
				)}

				{action === "folder.move" && (
					<select
						value={single}
						onChange={(e) => setSingle(e.target.value)}
						className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600"
					>
						<option value="">폴더 선택</option>
						<option value="__root__">최상위로</option>
						{folders.map((f) => (
							<option key={f.id} value={f.id}>
								{f.name}
							</option>
						))}
					</select>
				)}

				<button
					type="button"
					disabled={!canRun}
					onClick={() => {
						if (activeAction?.confirm && !window.confirm(activeAction.confirm)) return;
						void run(selected);
					}}
					className="rounded-lg bg-white px-3.5 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 transition disabled:opacity-40"
				>
					{isRunning ? "실행 중..." : "일괄 실행"}
				</button>

				{results && (
					<span className="text-xs text-neutral-300">
						성공 {successes} / 실패 {failures.length}
					</span>
				)}
				{failures.length > 0 && (
					<button
						type="button"
						onClick={rerunFailures}
						className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
					>
						실패만 다시 실행
					</button>
				)}
			</div>

			{error && <div className="pt-2 text-xs text-red-400">{error}</div>}

			{failures.length > 0 && (
				<ul className="flex flex-col gap-1 pt-2 text-xs text-red-300">
					{failures.map((f) => (
						<li key={f.id}>
							<span className="font-mono">{f.id.slice(0, 8)}</span> —{" "}
							{!f.ok && (BULK_ERROR_LABEL[f.error] ?? f.error)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

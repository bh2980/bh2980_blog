"use client";

import type { EditorExtension } from "@bh2980/cms-admin";
import { errorText } from "@bh2980/cms-admin/api";
import type { BlockAction } from "@bh2980/cms-admin/editor/tiptap-editor";
import { Button } from "@bh2980/cms-admin/ui/button";
import { Input } from "@bh2980/cms-admin/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@bh2980/cms-admin/ui/popover";
import type { Editor } from "@tiptap/react";
import { Languages, Square } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { runAiActionMany, useAiActions } from "./ai-slot-provider";
import { applyTranslation, collectUnits, type TranslateUnit, unitAt } from "./ai-translate-units";

/**
 * 번역본 에디터의 AI 번역(v2 D2). 안내 글(`untranslated`)이 남은 블록이 "아직 번역 안 된 곳"이다.
 * 번역은 일반 AI 기능 하나다. 붙을 곳이 `translation`인 기능(입력 `block`·`from`·`to`, MDX 결과)을 블록마다 부른다.
 * 블록의 원문 MDX(안내 글 표시를 걷어 낸 것)를 보내고, 서버가 번역·구조 검사를 통과한 MDX만 돌려주면 그 블록을 바꾼다.
 * 검사에 걸린 블록은 안내 글로 남는다. 번역 단위와 바꾸는 규칙은 `ai-translate-units.ts`다.
 */

/** 한 요청에 보내는 블록 수와 글자 수(서버 상한보다 작게). */
const BATCH_BLOCKS = 4;
const BATCH_CHARS = 12_000;
/** 동시에 보내는 요청 수. */
const PARALLEL_REQUESTS = 2;

type TranslateResult = { id: string; mdx: string } | { id: string; error: string };

async function requestTranslation(
	action: string,
	blocks: Array<{ id: string; mdx: string }>,
	locales: { sourceLocale: string; targetLocale: string },
	request: string,
	signal: AbortSignal,
): Promise<TranslateResult[]> {
	const results = await runAiActionMany(
		action,
		blocks.map((block) => ({ block: block.mdx, from: locales.sourceLocale, to: locales.targetLocale })),
		{ request, signal, env: { locale: locales.targetLocale } },
	);
	return results.map((item, index) => {
		const id = blocks[index]?.id ?? "";
		return "error" in item ? { id, error: item.error } : { id, mdx: "text" in item.result ? item.result.text : "" };
	});
}

/** 블록을 요청 단위로 묶는다. 한 블록이 커도 나누지 않고 혼자 보낸다. */
function batches<T extends { mdx: string }>(blocks: T[]): T[][] {
	const groups: T[][] = [];
	let current: T[] = [];
	let chars = 0;
	for (const block of blocks) {
		if (current.length > 0 && (current.length >= BATCH_BLOCKS || chars + block.mdx.length > BATCH_CHARS)) {
			groups.push(current);
			current = [];
			chars = 0;
		}
		current.push(block);
		chars += block.mdx.length;
	}
	if (current.length > 0) groups.push(current);
	return groups;
}

/**
 * 번역본 에디터의 AI 번역 동작. `blockAction`은 블록 손잡이 옆 `번역`, `toolbar`는 툴바의 `모두 번역`이다.
 * 번역 기능이 꺼져 있거나 연결이 없으면 둘 다 없다.
 */
export function useAiTranslate(locales: { sourceLocale: string; targetLocale: string } | null) {
	const { data } = useAiActions(locales !== null);
	const feature = data?.items.find(
		(item) => item.enabled && item.result === "mdx" && item.attach.some((attach) => attach.slot === "translation"),
	);
	const available = Boolean(locales && feature && data?.usable.includes(feature.key));
	const actionKey = feature?.key ?? "";
	const editorRef = useRef<Editor | null>(null);
	const [busyBlocks, setBusyBlocks] = useState<ReadonlySet<number>>(new Set());
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
	const [request, setRequest] = useState("");
	const [open, setOpen] = useState(false);
	const abortRef = useRef<AbortController | null>(null);

	const setEditor = useCallback((editor: Editor | null) => {
		editorRef.current = editor;
	}, []);

	const translateOne = useCallback(
		async (editor: Editor, pos: number) => {
			if (!locales) return;
			const unit = unitAt(editor.state.doc, pos);
			if (!unit) return;
			setBusyBlocks((current) => new Set([...current, pos]));
			try {
				const [result] = await requestTranslation(
					actionKey,
					[{ id: "b0", mdx: unit.mdx }],
					locales,
					request,
					new AbortController().signal,
				);
				if (!result) return;
				if ("error" in result) {
					toast.error(`번역하지 못해 원문 틀로 두었습니다. ${result.error}`);
					return;
				}
				const applied = applyTranslation(editor, unit, result.mdx, pos);
				if (applied === "changed") toast.message("그사이 블록이 바뀌어 넣지 않았습니다.");
				else if (applied === "invalid") toast.error("번역 결과가 이 자리에 맞지 않아 원문 틀로 두었습니다.");
			} catch (error) {
				toast.error(errorText(error, "번역하지 못했습니다."));
			} finally {
				setBusyBlocks((current) => new Set([...current].filter((item) => item !== pos)));
			}
		},
		[locales, request, actionKey],
	);

	const translateAll = useCallback(async () => {
		const editor = editorRef.current;
		if (!editor || !locales) return;
		const blocks: Array<TranslateUnit & { id: string }> = collectUnits(editor.state.doc).map((unit, index) => ({
			...unit,
			id: `b${index}`,
		}));
		if (blocks.length === 0) {
			toast.message("번역할 블록이 없습니다.");
			return;
		}
		const controller = new AbortController();
		abortRef.current = controller;
		setOpen(false);
		setProgress({ done: 0, total: blocks.length });
		const groups = batches(blocks);
		const failures: string[] = [];
		let skipped = 0;
		let fatal: string | null = null;
		let next = 0;
		const worker = async () => {
			while (next < groups.length && !controller.signal.aborted && !fatal) {
				const group = groups[next++] ?? [];
				try {
					const results = await requestTranslation(
						actionKey,
						group.map(({ id, mdx }) => ({ id, mdx })),
						locales,
						request,
						controller.signal,
					);
					for (const result of results) {
						const block = group.find((item) => item.id === result.id);
						if (!block) continue;
						if ("error" in result) failures.push(result.error);
						else {
							const applied = applyTranslation(editor, block, result.mdx, null);
							if (applied === "changed") skipped += 1;
							else if (applied === "invalid") failures.push("번역 결과가 그 자리에 맞지 않습니다.");
						}
					}
				} catch (error) {
					if (controller.signal.aborted) return;
					fatal = errorText(error, "번역하지 못했습니다.");
				}
				setProgress((current) => (current ? { ...current, done: current.done + group.length } : current));
			}
		};
		await Promise.all(Array.from({ length: Math.min(PARALLEL_REQUESTS, groups.length) }, worker));
		setProgress(null);
		abortRef.current = null;
		if (controller.signal.aborted) toast.message("번역을 멈췄습니다. 번역한 블록은 그대로 둡니다.");
		else if (fatal) toast.error(fatal);
		else if (failures.length > 0 || skipped > 0) {
			toast.warning(
				`${blocks.length - failures.length - skipped}개 블록을 번역했습니다. ${failures.length + skipped}개는 원문 틀로 남겼습니다.${failures[0] ? ` (${failures[0]})` : ""}`,
			);
		} else toast.success(`${blocks.length}개 블록을 번역했습니다.`);
	}, [locales, request, actionKey]);

	const blockAction = useMemo<BlockAction | null>(
		() =>
			available
				? {
						id: "ai-translate",
						label: "번역",
						icon: <Languages aria-hidden />,
						isAvailable: (editor, pos) => unitAt(editor.state.doc, pos) !== null && progress === null,
						isBusy: (pos) => busyBlocks.has(pos),
						run: (editor, pos) => void translateOne(editor, pos),
					}
				: null,
		[available, busyBlocks, progress, translateOne],
	);

	const toolbar = available ? (
		progress ? (
			<Button
				type="button"
				size="sm"
				variant="ghost"
				className="gap-1.5 text-muted-foreground"
				onClick={() => abortRef.current?.abort()}
			>
				<Square aria-hidden className="size-3.5" />
				번역 중 {progress.done}/{progress.total}
			</Button>
		) : (
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={<Button type="button" size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" />}
				>
					<Languages aria-hidden className="size-4" />
					모두 번역
				</PopoverTrigger>
				<PopoverContent align="end" className="w-72 gap-2 p-3 text-xs">
					{feature?.askInstruction && (
						<Input
							aria-label="추가 요청"
							placeholder="추가 요청"
							value={request}
							onChange={(event) => setRequest(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.nativeEvent.isComposing) {
									event.preventDefault();
									void translateAll();
								}
							}}
							className="h-8 text-xs"
						/>
					)}
					<Button type="button" size="sm" onClick={() => void translateAll()}>
						<Languages aria-hidden />
						번역 시작
					</Button>
				</PopoverContent>
			</Popover>
		)
	) : null;

	return { blockAction, toolbar, setEditor };
}

/** 편집 화면 확장으로 붙인 AI 번역. 번역본 편집기의 툴바에 `모두 번역`, 블록 손잡이 옆에 `번역`을 둔다. */
export const useAiTranslateExtension: EditorExtension = ({ translateLocales }) => {
	const translate = useAiTranslate(translateLocales);
	return {
		toolbar: translate.toolbar,
		blockActions: translate.blockAction ? [translate.blockAction] : undefined,
		onEditor: translate.setEditor,
	};
};

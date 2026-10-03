"use client";

import type { EditorExtension, EditorInsertAction, EditorSelectionAction } from "@bh2980/cms-admin";
import { type BlockAction, blockNodeName, MdxPreview, mdxToTiptap, tiptapToMdx } from "@bh2980/cms-admin/editor";
import { Button } from "@bh2980/cms-admin/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@bh2980/cms-admin/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@bh2980/cms-admin/ui/tabs";
import { Textarea } from "@bh2980/cms-admin/ui/textarea";
import type { Editor, JSONContent } from "@tiptap/core";
import { PenLine, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AiActionView } from "../actions";
import { streamAiAction, useAiActions } from "./ai-slot-provider";
import { diffWords } from "./word-diff";

/**
 * 본문에 글을 쓰는 AI 기능(M8-2·M8-3·M9-3). 붙을 곳이 `selection`(선택 영역 메뉴, 예: 문체 다듬기)이면 고른 글을 다듬어
 * 바뀐 곳을 보여 준 뒤 바꾸고, `insert`(슬래시 메뉴·빈 문서, 예: 초안 쓰기)면 커서 자리에 넣는다. `block`(블록 손잡이
 * 옆, 예: 다이어그램 고치기)이면 그 블록 원문을 고쳐 바뀐 곳을 보여 준 뒤 블록을 바꾼다.
 * 결과는 흘려받아 조금씩 보인다. 적용은 사용자가 누를 때만 한다.
 */

type Job =
	| { mode: "selection"; action: AiActionView; editor: Editor; from: number; to: number; source: string }
	| { mode: "insert"; action: AiActionView; editor: Editor; from: number; to: number }
	| {
			mode: "block";
			action: AiActionView;
			editor: Editor;
			from: number;
			to: number;
			source: string;
			/** 고치는 블록의 편집기 노드 이름. 결과도 이 블록 하나여야 바꾼다. */
			nodeType: string;
	  };

type RunState =
	| { status: "idle" }
	| { status: "running"; text: string }
	| { status: "done"; text: string }
	| { status: "error"; text: string; message: string };

/** 선택한 부분의 MDX. 부분만 고른 문단도 그 부분만 담는다. */
function selectionMdx(editor: Editor, from: number, to: number): string {
	const slice = editor.state.doc.slice(from, to);
	const nodes = (slice.content.toJSON() ?? []) as JSONContent[];
	// 한 문단 안을 고르면 글자 조각만 온다. 문단으로 감싸야 MDX가 된다.
	const content = slice.content.firstChild?.isInline ? [{ type: "paragraph", content: nodes }] : nodes;
	return tiptapToMdx({ type: "doc", content }).trim();
}

/** 결과 MDX를 편집기 내용으로. 한 문단 안을 고쳤고 결과도 한 문단이면 글자만 넣는다(문단을 쪼개지 않는다). */
function contentFor(editor: Editor, from: number, to: number, mdx: string): JSONContent[] {
	const blocks = mdxToTiptap(mdx).content ?? [];
	const $from = editor.state.doc.resolve(from);
	const $to = editor.state.doc.resolve(to);
	const inline = $from.parent === $to.parent && $from.parent.isTextblock;
	const only = blocks.length === 1 ? blocks[0] : undefined;
	return inline && only?.type === "paragraph" ? (only.content ?? []) : blocks;
}

function WriteDialog({ job, getEntry, onClose }: { job: Job; getEntry: GetEntry; onClose: () => void }) {
	const [request, setRequest] = useState("");
	const [state, setState] = useState<RunState>({ status: "idle" });
	const controllerRef = useRef<AbortController | null>(null);
	const { action, editor } = job;

	const run = async () => {
		controllerRef.current?.abort();
		const controller = new AbortController();
		controllerRef.current = controller;
		setState({ status: "running", text: "" });
		const entry = getEntry?.();
		const input: Record<string, unknown> =
			job.mode === "selection"
				? { selection: job.source, title: entry?.title || undefined }
				: job.mode === "block"
					? { block: job.source, title: entry?.title || undefined }
					: { title: entry?.title || undefined, body: tiptapToMdx(editor.getJSON()).trim() || undefined };
		try {
			const result = await streamAiAction(
				action.key,
				Object.fromEntries(Object.entries(input).filter(([name, value]) => value && action.input[name])),
				{
					env: {
						...(entry?.collection ? { collection: entry.collection } : {}),
						...(entry?.locale ? { locale: entry.locale } : {}),
						...(entry?.entryId ? { entryId: entry.entryId } : {}),
					},
					request,
					signal: controller.signal,
					onText: (text) => setState({ status: "running", text }),
				},
			);
			if (controller.signal.aborted) return;
			setState({ status: "done", text: "text" in result ? result.text : "" });
		} catch (error) {
			if (controller.signal.aborted) return;
			setState((current) => ({
				status: "error",
				text: "text" in current ? current.text : "",
				message: error instanceof Error && error.message ? error.message : "실행하지 못했습니다.",
			}));
		}
	};

	// 고칠 글이 정해진 다듬기는 열자마자 실행한다. 초안과 요청을 받는 블록 기능은 요청을 먼저 받는다.
	const fixed = job.mode === "selection" || (job.mode === "block" && !action.askInstruction);
	// biome-ignore lint/correctness/useExhaustiveDependencies: 열 때 한 번만 실행한다
	useEffect(() => {
		if (fixed) void run();
		return () => controllerRef.current?.abort();
	}, []);

	// 블록 고치기는 결과가 같은 종류의 블록 하나일 때만 바꾼다.
	const blockProblem = useMemo(() => {
		if (job.mode !== "block" || state.status !== "done") return null;
		const blocks = mdxToTiptap(state.text).content ?? [];
		return blocks.length === 1 && blocks[0]?.type === job.nodeType ? null : "결과가 같은 블록 하나가 아닙니다.";
	}, [job, state]);

	const apply = () => {
		if (state.status !== "done" || !state.text || blockProblem) return;
		// 블록은 결과 블록으로 통째로 바꾼다.
		const content =
			job.mode === "block" ? (mdxToTiptap(state.text).content ?? []) : contentFor(editor, job.from, job.to, state.text);
		editor.chain().focus().insertContentAt({ from: job.from, to: job.to }, content).run();
		onClose();
	};

	const diff = useMemo(
		() => (job.mode !== "insert" && state.status === "done" ? diffWords(job.source, state.text) : null),
		[job, state],
	);
	const running = state.status === "running";
	const result = "text" in state ? state.text : "";
	// 고친 글(다듬기)은 바뀐 곳부터, 블록·초안은 그린 모양부터 본다.
	const [view, setView] = useState<"preview" | "source">(job.mode === "selection" ? "source" : "preview");

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="gap-4 sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles aria-hidden className="size-4" />
						{action.label}
					</DialogTitle>
				</DialogHeader>
				{action.askInstruction && (
					<form
						className="space-y-2"
						onSubmit={(event) => {
							event.preventDefault();
							void run();
						}}
					>
						<Textarea
							aria-label="요청"
							value={request}
							rows={3}
							onChange={(event) => setRequest(event.target.value)}
							onKeyDown={(event) => {
								// 줄바꿈은 Enter, 보내기는 Cmd/Ctrl+Enter다.
								if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !running) {
									event.preventDefault();
									void run();
								}
							}}
							placeholder={
								job.mode === "insert" ? "무엇을 쓸까요?" : job.mode === "block" ? "무엇을 바꿀까요?" : "추가 요청"
							}
							className="max-h-48 min-h-20 resize-y text-sm"
							autoFocus={!fixed}
						/>
						<div className="flex justify-end">
							<Button type="submit" size="sm" disabled={running}>
								{state.status === "idle" ? "쓰기" : "다시"}
							</Button>
						</div>
					</form>
				)}
				<Tabs value={view} onValueChange={(value) => setView(value as "preview" | "source")} className="min-w-0 gap-2">
					<TabsList>
						<TabsTrigger value="preview">미리보기</TabsTrigger>
						<TabsTrigger value="source">{job.mode === "insert" ? "원문" : "바뀐 곳"}</TabsTrigger>
					</TabsList>
					<output aria-live="polite" className="block min-w-0">
						{state.status === "idle" ? (
							<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-xs">
								요청을 적고 쓰기를 누르세요.
							</p>
						) : view === "preview" ? (
							<ResultPreview job={job} text={result} done={state.status === "done"} />
						) : (
							<pre className="max-h-[50vh] min-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-mono text-xs leading-relaxed">
								{diff ? <DiffText parts={diff} /> : result || "쓰는 중..."}
							</pre>
						)}
					</output>
				</Tabs>
				{(state.status === "error" || blockProblem) && (
					<p role="alert" className="text-destructive text-xs">
						{state.status === "error" ? state.message : blockProblem}
					</p>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" size="sm" onClick={onClose}>
						취소
					</Button>
					<Button
						type="button"
						size="sm"
						disabled={state.status !== "done" || !state.text || !!blockProblem}
						onClick={apply}
					>
						{job.mode === "insert" ? "넣기" : "바꾸기"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** 바뀐 곳(지운 것·더한 것)을 표시한 글. */
function DiffText({ parts }: { parts: ReturnType<typeof diffWords> }) {
	return parts.map((part, index) =>
		part.type === "same" ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: 바뀐 곳 목록은 결과마다 새로 만든다
			<span key={index}>{part.text}</span>
		) : part.type === "del" ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: 바뀐 곳 목록은 결과마다 새로 만든다
			<del key={index} className="bg-destructive/15 text-destructive line-through">
				{part.text}
			</del>
		) : (
			// biome-ignore lint/suspicious/noArrayIndexKey: 바뀐 곳 목록은 결과마다 새로 만든다
			<ins key={index} className="bg-emerald-500/15 text-emerald-700 no-underline dark:text-emerald-400">
				{part.text}
			</ins>
		),
	);
}

const PANEL = "max-h-[50vh] min-h-48 overflow-y-auto rounded-md bg-muted/40 p-3";

/**
 * 결과를 글 모양 그대로 그린다(다이어그램·차트는 그림으로). 쓰는 중에는 반쯤 쓴 코드가 그려지지 않으므로 원문을 보인다.
 * 블록 고치기는 지금 블록과 바뀐 뒤를 나란히 보인다.
 */
function ResultPreview({ job, text, done }: { job: Job; text: string; done: boolean }) {
	const after = done ? (
		<MdxPreview mdx={text} label="바뀐 뒤" />
	) : (
		<pre className="whitespace-pre-wrap font-mono text-muted-foreground text-xs">{text || "쓰는 중..."}</pre>
	);
	if (job.mode === "insert") return <div className={PANEL}>{after}</div>;
	return (
		<div className="grid min-w-0 gap-3 sm:grid-cols-2">
			<section className="min-w-0 space-y-1.5">
				<h3 className="font-medium text-muted-foreground text-xs">지금</h3>
				<div className={PANEL}>
					<MdxPreview mdx={job.source} label="지금" />
				</div>
			</section>
			<section className="min-w-0 space-y-1.5">
				<h3 className="font-medium text-muted-foreground text-xs">바뀐 뒤</h3>
				<div className={PANEL}>{after}</div>
			</section>
		</div>
	);
}

type GetEntry = Parameters<EditorExtension>[0]["getEntry"];

/** 편집기가 빈 문서인가. 바뀔 때마다 다시 본다. */
function useIsEmpty(editor: Editor | null) {
	const [empty, setEmpty] = useState(false);
	useEffect(() => {
		if (!editor) return;
		const update = () => setEmpty(editor.isEmpty);
		update();
		editor.on("update", update);
		return () => {
			editor.off("update", update);
		};
	}, [editor]);
	return empty;
}

/** 편집 화면 확장으로 붙인 AI 쓰기(문체 다듬기·초안 쓰기). */
export const useAiWriteExtension: EditorExtension = ({ getEntry }) => {
	const { data } = useAiActions();
	const [editor, setEditor] = useState<Editor | null>(null);
	const [job, setJob] = useState<Job | null>(null);
	const empty = useIsEmpty(editor);

	const usable = useMemo(() => {
		const ready = new Set(data?.usable ?? []);
		const actions = (data?.items ?? []).filter((action) => action.enabled && ready.has(action.key));
		return {
			selection: actions.filter((action) => action.attach.some((attach) => attach.slot === "selection")),
			insert: actions.filter((action) => action.attach.some((attach) => attach.slot === "insert")),
			block: actions.filter((action) => action.attach.some((attach) => attach.slot === "block")),
		};
	}, [data]);

	const selectionActions = useMemo<EditorSelectionAction[]>(
		() =>
			usable.selection.map((action) => ({
				id: `ai:${action.key}`,
				label: action.label,
				icon: <Wand2 aria-hidden className="size-4" />,
				run: (current) => {
					const { from, to } = current.state.selection;
					if (from === to) return;
					setJob({ mode: "selection", action, editor: current, from, to, source: selectionMdx(current, from, to) });
				},
			})),
		[usable.selection],
	);

	const insertActions = useMemo<EditorInsertAction[]>(
		() =>
			usable.insert.map((action) => ({
				id: `ai:${action.key}`,
				title: action.label,
				description: "AI로 커서 자리에 쓰기",
				keywords: ["ai", "초안", "draft", action.label],
				icon: "sparkles",
				run: (current, range) => setJob({ mode: "insert", action, editor: current, from: range.from, to: range.to }),
			})),
		[usable.insert],
	);

	const blockActions = useMemo<BlockAction[]>(
		() =>
			usable.block.map((action) => {
				// 이 기능이 붙은 블록의 편집기 노드 이름.
				const nodes = new Set(
					action.attach.flatMap((attach) => (attach.slot === "block" ? [blockNodeName({ name: attach.block })] : [])),
				);
				return {
					id: `ai:${action.key}`,
					label: action.label,
					icon: <Sparkles aria-hidden className="size-3.5" />,
					isAvailable: (current, pos) => nodes.has(current.state.doc.nodeAt(pos)?.type.name ?? ""),
					run: (current, pos) => {
						const node = current.state.doc.nodeAt(pos);
						if (!node) return;
						const source = tiptapToMdx({ type: "doc", content: [node.toJSON() as JSONContent] }).trim();
						setJob({
							mode: "block",
							action,
							editor: current,
							from: pos,
							to: pos + node.nodeSize,
							source,
							nodeType: node.type.name,
						});
					},
				};
			}),
		[usable.block],
	);

	const firstInsert = usable.insert[0];
	return {
		toolbar: (
			<>
				{/* 빈 문서에서는 툴바에서 바로 초안을 쓴다. */}
				{empty && editor && firstInsert && (
					<Button
						type="button"
						variant="ghost"
						size="xs"
						onClick={() => {
							const { from, to } = editor.state.selection;
							setJob({ mode: "insert", action: firstInsert, editor, from, to });
						}}
					>
						<PenLine aria-hidden />
						{firstInsert.label}
					</Button>
				)}
			</>
		),
		overlay: job && <WriteDialog job={job} getEntry={getEntry} onClose={() => setJob(null)} />,
		selectionActions,
		insertActions,
		blockActions,
		onEditor: setEditor,
	};
};

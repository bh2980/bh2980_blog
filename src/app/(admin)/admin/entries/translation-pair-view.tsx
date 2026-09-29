"use client";

import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import { Tag } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { type AlignedUnit, type HeaderValue, parseFragment, parseHeader } from "@/cms/core/translation/units";
import { buildEditorExtensions } from "@/cms/editor/extensions";
import { ImageInsertDialog, type ImageInsertion } from "@/cms/editor/image-insert-dialog";
import { InlineBubble } from "@/cms/editor/inline-bubble";
import { mdxToTiptap, tiptapToMdx } from "@/cms/editor/tiptap-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";

type Filter = "all" | "untranslated" | "changed";

const FILTERS: { value: Filter; label: string }[] = [
	{ value: "all", label: "전체" },
	{ value: "untranslated", label: "미번역" },
	{ value: "changed", label: "원문 변경" },
];

const BOX_LABELS: Record<string, string> = { Callout: "콜아웃", Collapsible: "접기", Tabs: "탭" };

/** 셀 편집기 바깥이어도 편집을 끝내지 않는 떠 있는 UI(팝오버·대화상자·인라인 버블). */
const KEEP_OPEN =
	'[role="dialog"], [role="menu"], [role="listbox"], [data-slot^="popover"], [data-slot^="dialog"], [data-cms-inline-bubble]';

const PROSE = "prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed";

/** 번역 결과 조각이 그 줄에 맞는지 본다. 알맞으면 null, 아니면 짧은 오류 문구를 돌려준다. */
export const validateFragment = (mdx: string, type: string): string | null => {
	const nodes = parseFragment(mdx);
	if (nodes.length !== 1) return "블록 하나만";
	return nodes[0]?.type === type ? null : "같은 종류의 블록만";
};

/** 머리 줄 값을 한 줄 글자로 만든다. */
const headerTexts = (value: HeaderValue | null): string[] => {
	if (!value) return [];
	return "title" in value ? [value.title] : value.labels;
};

const headerLine = (value: string | null) => headerTexts(value === null ? null : parseHeader(value)).join(" · ");

/** 화면 근처에 왔을 때 처음 그린다. 글이 길어도 편집기를 한꺼번에 만들지 않는다. */
function LazyMount({ children, minHeight = 40 }: { children: ReactNode; minHeight?: number }) {
	const ref = useRef<HTMLDivElement>(null);
	const [shown, setShown] = useState(false);
	useEffect(() => {
		if (shown) return;
		const element = ref.current;
		if (!element || typeof IntersectionObserver === "undefined") {
			setShown(true);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setShown(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "400px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [shown]);
	return (
		<div ref={ref} style={shown ? undefined : { minHeight }}>
			{shown && children}
		</div>
	);
}

function PreviewEditor({ mdx }: { mdx: string }) {
	const [extensions] = useState(() => buildEditorExtensions());
	const content = useMemo(() => mdxToTiptap(mdx), [mdx]);
	const editor = useEditor({
		immediatelyRender: false,
		editable: false,
		extensions,
		content,
		editorProps: { attributes: { class: cn(PROSE, "focus:outline-none") } },
	});
	return <EditorContent editor={editor} />;
}

/** 읽기 전용 MDX 미리보기. 편집기와 같은 모양으로 그린다. */
export function UnitPreview({ mdx }: { mdx: string }) {
	return (
		<LazyMount>
			<PreviewEditor key={mdx} mdx={mdx} />
		</LazyMount>
	);
}

function HeaderText({ value }: { value: string | null }) {
	const text = headerLine(value);
	return text ? <p className="text-sm">{text}</p> : <p className="text-muted-foreground text-sm">-</p>;
}

function UnitValue({ header, value }: { header: boolean; value: string }) {
	return header ? <HeaderText value={value} /> : <UnitPreview mdx={value} />;
}

/** 셀 밖을 누르면 편집을 끝낸다. 떠 있는 UI를 누른 것은 밖으로 치지 않는다. */
function useOutsideCommit(ref: RefObject<HTMLElement | null>, commit: () => void) {
	const latest = useRef(commit);
	latest.current = commit;
	useEffect(() => {
		const onDown = (event: MouseEvent) => {
			const target = event.target instanceof Element ? event.target : null;
			if (!target || ref.current?.contains(target) || target.closest(KEEP_OPEN)) return;
			latest.current();
		};
		document.addEventListener("mousedown", onDown, true);
		return () => document.removeEventListener("mousedown", onDown, true);
	}, [ref]);
}

interface EditorShellProps {
	onCancel: () => void;
	commit: () => void;
	children: ReactNode;
	actions: ReactNode;
	error: string | null;
	rootRef: RefObject<HTMLFieldSetElement | null>;
}

function EditorShell({ onCancel, commit, children, actions, error, rootRef }: EditorShellProps) {
	useOutsideCommit(rootRef, commit);
	return (
		<fieldset
			ref={rootRef}
			aria-label="번역 편집"
			className="m-0 flex min-w-0 flex-col gap-2 rounded-md border border-ring/60 bg-background p-2 ring-2 ring-ring/20"
			onKeyDown={(event) => {
				if (!rootRef.current?.contains(event.target as Node) || event.nativeEvent.isComposing) return;
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					onCancel();
				} else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
					event.preventDefault();
					commit();
				}
			}}
		>
			{children}
			<div className="flex items-center gap-1">
				{actions}
				<span className="flex-1" />
				{error && (
					<span role="alert" className="text-destructive text-xs">
						{error}
					</span>
				)}
				<Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onCancel}>
					취소
				</Button>
				<Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={commit}>
					완료
				</Button>
			</div>
		</fieldset>
	);
}

interface BlockEditorProps {
	type: string;
	source: string;
	initial: string;
	onCommit: (target: string | null) => void;
	onCancel: () => void;
}

/**
 * 빈칸에서 번역을 시작할 때의 뼈대: 원문과 같은 종류·구조(제목 단계, 목록 항목 수, 표 칸, 코드 언어)에서
 * 글자와 이미지 설명만 비운다. 빈 문단에서 시작하면 제목·목록을 번역할 때 종류가 달라진다.
 */
export const blankLike = (json: JSONContent): JSONContent => {
	const strip = (node: JSONContent): JSONContent | null => {
		if (node.type === "text") return null;
		const attrs =
			node.type === "image"
				? { ...node.attrs, alt: "", caption: "", title: null }
				: (node.attrs as JSONContent["attrs"]);
		const content = node.content?.map(strip).filter((child): child is JSONContent => child !== null);
		return { ...node, ...(attrs ? { attrs } : {}), ...(node.content ? { content } : {}) };
	};
	return strip(json) ?? { type: "doc", content: [] };
};

function BlockCellEditor({ type, source, initial, onCommit, onCancel }: BlockEditorProps) {
	const [extensions] = useState(() => buildEditorExtensions());
	const [content] = useState(() => (initial ? mdxToTiptap(initial) : blankLike(mdxToTiptap(source))));
	const [error, setError] = useState<string | null>(null);
	const [imageOpen, setImageOpen] = useState(false);
	const dirtyRef = useRef(false);
	const rootRef = useRef<HTMLFieldSetElement>(null);
	const isImage = type === "image";
	const editor = useEditor({
		immediatelyRender: false,
		editable: true,
		autofocus: "end",
		extensions,
		content,
		editorProps: {
			attributes: {
				"aria-label": "번역 편집기",
				class: cn(PROSE, "min-h-10 px-1 focus:outline-none [&_.tableWrapper]:overflow-x-auto"),
			},
		},
		onUpdate: () => {
			dirtyRef.current = true;
			setError(null);
		},
	});

	const commit = () => {
		if (!editor) return;
		if (!dirtyRef.current) {
			onCancel();
			return;
		}
		const mdx = tiptapToMdx(editor.getJSON()).trim();
		if (!mdx) {
			onCommit(null);
			return;
		}
		const problem = validateFragment(mdx, type);
		if (problem) setError(problem);
		else onCommit(mdx);
	};

	const fillSource = () => {
		if (!editor) return;
		dirtyRef.current = true;
		editor.commands.setContent(mdxToTiptap(source), { emitUpdate: true });
		setError(null);
	};

	const swapImage = (image: ImageInsertion) => {
		if (!editor) return;
		editor
			.chain()
			.command(({ state, tr }) => {
				const node = state.doc.firstChild;
				if (node?.type.name !== "image") return false;
				tr.setNodeMarkup(0, undefined, {
					...node.attrs,
					mediaId: image.mediaId,
					src: null,
					alt: image.alt,
					caption: image.caption,
					decorative: image.decorative || null,
					crop: null,
					rotate: null,
				});
				return true;
			})
			.run();
		dirtyRef.current = true;
		setImageOpen(false);
	};

	return (
		<EditorShell
			rootRef={rootRef}
			commit={commit}
			onCancel={onCancel}
			error={error}
			actions={
				<>
					<Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={fillSource}>
						{isImage ? "원문 이미지로" : "원문 복사"}
					</Button>
					{isImage && (
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-7 px-2 text-xs"
							onClick={() => setImageOpen(true)}
						>
							이미지 바꾸기
						</Button>
					)}
				</>
			}
		>
			<EditorContent editor={editor} />
			{editor && <InlineBubble editor={editor} />}
			{isImage && (
				<ImageInsertDialog
					open={imageOpen}
					initialFile={null}
					onClose={() => setImageOpen(false)}
					onInsert={swapImage}
				/>
			)}
		</EditorShell>
	);
}

interface HeaderEditorProps {
	source: HeaderValue;
	initial: HeaderValue | null;
	onCommit: (target: string | null) => void;
	onCancel: () => void;
}

function HeaderCellEditor({ source, initial, onCommit, onCancel }: HeaderEditorProps) {
	const isTitle = "title" in source;
	const sourceTexts = headerTexts(source);
	const [initialTexts] = useState(() => {
		const same = initial && "title" in initial === isTitle ? headerTexts(initial) : [];
		return sourceTexts.map((_, index) => same[index] ?? "");
	});
	const [values, setValues] = useState(initialTexts);
	const valuesRef = useRef(values);
	const composingRef = useRef(false);
	const pendingRef = useRef(false);
	const rootRef = useRef<HTMLFieldSetElement>(null);

	const setAt = (index: number, value: string) => {
		valuesRef.current = valuesRef.current.map((current, i) => (i === index ? value : current));
		setValues(valuesRef.current);
	};

	const commit = () => {
		// 조합 중에는 끝내지 않는다. 조합이 끝나면 이어서 끝낸다.
		if (composingRef.current) {
			pendingRef.current = true;
			return;
		}
		pendingRef.current = false;
		const next = valuesRef.current.map((value) => value.trim());
		if (next.every((value, index) => value === (initialTexts[index] ?? "").trim())) {
			onCancel();
			return;
		}
		if (next.every((value) => !value)) {
			onCommit(null);
			return;
		}
		onCommit(JSON.stringify(isTitle ? { title: next[0] ?? "" } : { labels: next }));
	};

	const fillSource = () => {
		valuesRef.current = sourceTexts;
		setValues(sourceTexts);
	};

	return (
		<EditorShell
			rootRef={rootRef}
			commit={commit}
			onCancel={onCancel}
			error={null}
			actions={
				<Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={fillSource}>
					원문 복사
				</Button>
			}
		>
			<div className="flex flex-col gap-1.5">
				{sourceTexts.map((text, index) => (
					<Input
						// biome-ignore lint/suspicious/noArrayIndexKey: 탭 이름은 순서가 곧 정체성이다
						key={index}
						autoFocus={index === 0}
						aria-label={isTitle ? "제목" : `탭 이름 ${index + 1}`}
						value={values[index] ?? ""}
						placeholder={text}
						className="h-8 text-sm"
						onChange={(event) => setAt(index, event.target.value)}
						onCompositionStart={() => {
							composingRef.current = true;
						}}
						onCompositionEnd={(event) => {
							composingRef.current = false;
							setAt(index, event.currentTarget.value);
							if (pendingRef.current) commit();
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.nativeEvent.isComposing) {
								event.preventDefault();
								commit();
							}
						}}
					/>
				))}
			</div>
		</EditorShell>
	);
}

interface RowProps {
	row: AlignedUnit;
	index: number;
	editable: boolean;
	editing: boolean;
	comparing: boolean;
	rowRef: (element: HTMLElement | null) => void;
	onOpen: (index: number) => void;
	onCommit: (index: number, target: string | null) => void;
	onCancel: () => void;
	onToggleCompare: (index: number) => void;
	onChangeTarget: (index: number, target: string | null) => void;
	onIgnoreChange: (index: number) => void;
}

/** 열쇠의 앞부분(`/Callout/Tabs`)에서 상자 깊이를 센다. */
const depthOf = (key: string) => (key.split("|")[0] ?? "").split("/").filter(Boolean).length;

/** 상자 안 줄은 깊이만큼 왼쪽 선을 둘러 트리처럼 묶는다. */
const nest = (depth: number, content: ReactNode): ReactNode =>
	depth <= 0 ? content : nest(depth - 1, <div className="ml-1 border-border border-l-2 pl-3">{content}</div>);

const cellButton = "h-7 px-2 text-xs";

function PairRow({
	row,
	index,
	editable,
	editing,
	comparing,
	rowRef,
	onOpen,
	onCommit,
	onCancel,
	onToggleCompare,
	onChangeTarget,
	onIgnoreChange,
}: RowProps) {
	const { unit } = row;
	const isHeader = unit.kind === "header";
	const depth = depthOf(unit.key);
	const target = row.target;

	const editor = (() => {
		if (!editing) return null;
		const commit = (value: string | null) => onCommit(index, value);
		if (isHeader) {
			const sourceHeader = parseHeader(unit.source);
			if (!sourceHeader) return null;
			return (
				<HeaderCellEditor
					source={sourceHeader}
					initial={target === null ? null : parseHeader(target)}
					onCommit={commit}
					onCancel={onCancel}
				/>
			);
		}
		return (
			<BlockCellEditor
				type={unit.type}
				source={unit.source}
				initial={target ?? ""}
				onCommit={commit}
				onCancel={onCancel}
			/>
		);
	})();

	const preview = (value: string) => (
		<div className="relative">
			<UnitValue header={isHeader} value={value} />
			{editable && (
				<button
					type="button"
					aria-label="번역 편집"
					className="absolute inset-0 cursor-text rounded-sm hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring"
					onClick={() => onOpen(index)}
				/>
			)}
		</div>
	);

	const targetCell = (() => {
		if (unit.auto) return <p className="text-muted-foreground text-sm">원문 그대로</p>;
		if (editor) return editor;
		if (row.status === "untranslated" || target === null) {
			return (
				<div className="flex min-h-14 flex-col items-start justify-center gap-2 rounded-md border border-dashed px-3 py-2">
					<span className="text-muted-foreground text-sm">미번역</span>
					{editable && (
						<div className="flex gap-1">
							<Button type="button" size="sm" variant="outline" className={cellButton} onClick={() => onOpen(index)}>
								번역하기
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								className={cellButton}
								onClick={() => onChangeTarget(index, unit.source)}
							>
								원문 복사
							</Button>
						</div>
					)}
				</div>
			);
		}
		return preview(target);
	})();

	const changed = row.status === "changed" && !unit.auto;

	return (
		<div
			ref={rowRef}
			data-row-index={index}
			data-status={unit.auto ? "auto" : row.status}
			className={cn("grid scroll-mt-28 grid-cols-2 border-b", isHeader && "bg-muted/40")}
		>
			<div className="min-w-0 border-r p-3">
				{nest(
					depth,
					<>
						{isHeader && (
							<p className="mb-1 flex items-center gap-1 text-muted-foreground text-xs">
								<Tag aria-hidden className="size-3" />
								{BOX_LABELS[unit.type] ?? unit.type}
							</p>
						)}
						<UnitValue header={isHeader} value={unit.source} />
					</>,
				)}
			</div>
			<div className={cn("min-w-0 p-3", changed && "bg-amber-500/10")}>
				{nest(
					depth,
					<div className="flex flex-col gap-2">
						{changed && (
							<div className="flex items-center gap-2 text-amber-700 text-xs dark:text-amber-400">
								<span className="font-medium">원문 변경됨</span>
								<span className="flex-1" />
								<Button
									type="button"
									size="sm"
									variant="outline"
									className={cellButton}
									aria-pressed={comparing}
									onClick={() => onToggleCompare(index)}
								>
									비교
								</Button>
								{editable && (
									<Button
										type="button"
										size="sm"
										variant="outline"
										className={cellButton}
										onClick={() => onIgnoreChange(index)}
									>
										변경 무시
									</Button>
								)}
							</div>
						)}
						{changed && comparing && (
							<div className="grid gap-2 rounded-md border border-amber-500/40 bg-background/60 p-2">
								<div>
									<p className="mb-1 text-muted-foreground text-xs">이전</p>
									<UnitValue header={isHeader} value={row.baseSource} />
								</div>
								<div>
									<p className="mb-1 text-muted-foreground text-xs">지금</p>
									<UnitValue header={isHeader} value={unit.source} />
								</div>
							</div>
						)}
						{targetCell}
					</div>,
				)}
			</div>
		</div>
	);
}

export function TranslationPairView({
	rows,
	sourceLocale,
	targetLocale,
	editable,
	onChangeTarget,
	onIgnoreChange,
	sourceError,
}: {
	rows: readonly AlignedUnit[];
	sourceLocale: string;
	targetLocale: string;
	editable: boolean;
	/** 줄 번역을 바꾼다. 블록은 MDX 조각, 머리 줄은 JSON이다. `null`이면 비운다. */
	onChangeTarget: (index: number, target: string | null) => void;
	/** 고치지 않고 `원문 변경됨` 표시만 지운다. */
	onIgnoreChange: (index: number) => void;
	/** 원문 MDX를 해석할 수 없으면 줄 대신 안내를 보인다. */
	sourceError?: boolean;
}) {
	const [filter, setFilter] = useState<Filter>("all");
	const [editing, setEditing] = useState<number | null>(null);
	const [comparing, setComparing] = useState<ReadonlySet<number>>(new Set());
	const [scrollTo, setScrollTo] = useState<number | null>(null);
	const rowElements = useRef(new Map<number, HTMLElement>());
	const lastRef = useRef(-1);

	const counts = useMemo(() => {
		let translated = 0;
		let untranslated = 0;
		let changed = 0;
		for (const row of rows) {
			if (row.status === "translated") translated += 1;
			else if (row.status === "untranslated") untranslated += 1;
			else changed += 1;
		}
		return { translated, untranslated, changed };
	}, [rows]);

	useEffect(() => {
		if (scrollTo === null) return;
		rowElements.current.get(scrollTo)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
		setScrollTo(null);
	}, [scrollTo]);

	if (sourceError) {
		return (
			<p role="alert" className="mx-auto w-full max-w-6xl px-4 py-10 text-center text-muted-foreground text-sm">
				원문을 해석할 수 없습니다. 원문을 먼저 고치세요.
			</p>
		);
	}

	const open = (index: number) => {
		if (!editable) return;
		lastRef.current = index;
		setEditing(index);
	};

	const goNext = () => {
		const start = editing ?? lastRef.current;
		const untranslated = rows.flatMap((row, index) => (row.status === "untranslated" && !row.unit.auto ? [index] : []));
		const next = untranslated.find((index) => index > start) ?? untranslated[0];
		if (next === undefined) return;
		// 거른 보기에서 가려진 줄이면 전체로 돌려 보인다.
		setFilter((current) => (current === "changed" ? "all" : current));
		lastRef.current = next;
		setScrollTo(next);
		if (editable) setEditing(next);
	};

	const visible = (row: AlignedUnit) => {
		if (filter === "all") return true;
		return !row.unit.auto && row.status === filter;
	};

	const progress = [
		`번역 ${counts.translated}/${rows.length}`,
		counts.untranslated > 0 ? `미번역 ${counts.untranslated}` : null,
		counts.changed > 0 ? `원문 변경 ${counts.changed}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="relative w-full">
			<div className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur">
				<div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-2">
					<p className="text-sm">{progress}</p>
					<fieldset aria-label="보기 거르기" className="m-0 flex min-w-0 rounded-md border p-0.5">
						{FILTERS.map((item) => (
							<button
								key={item.value}
								type="button"
								aria-pressed={filter === item.value}
								className={cn(
									"rounded px-2 py-0.5 text-xs transition-colors",
									filter === item.value ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
								)}
								onClick={() => setFilter(item.value)}
							>
								{item.label}
							</button>
						))}
					</fieldset>
					<span className="flex-1" />
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="h-7 px-2 text-xs"
						disabled={counts.untranslated === 0}
						onClick={goNext}
					>
						다음 미번역
					</Button>
				</div>
				<div className="mx-auto grid w-full max-w-6xl grid-cols-2 px-4 pb-1.5 font-medium text-muted-foreground text-xs">
					<span className="pl-3">{sourceLocale.toUpperCase()} 원문</span>
					<span className="pl-3">{targetLocale.toUpperCase()}</span>
				</div>
			</div>
			<div className="mx-auto w-full max-w-6xl border-x px-0 sm:px-0">
				{rows.map((row, index) =>
					visible(row) ? (
						<PairRow
							// biome-ignore lint/suspicious/noArrayIndexKey: 줄은 원문 순서가 곧 정체성이다
							key={index}
							row={row}
							index={index}
							editable={editable}
							editing={editing === index}
							comparing={comparing.has(index)}
							rowRef={(element) => {
								if (element) rowElements.current.set(index, element);
								else rowElements.current.delete(index);
							}}
							onOpen={open}
							onCommit={(at, target) => {
								setEditing(null);
								onChangeTarget(at, target);
							}}
							onCancel={() => setEditing(null)}
							onToggleCompare={(at) =>
								setComparing((current) => {
									const next = new Set(current);
									if (!next.delete(at)) next.add(at);
									return next;
								})
							}
							onChangeTarget={onChangeTarget}
							onIgnoreChange={onIgnoreChange}
						/>
					) : null,
				)}
				{rows.length > 0 && !rows.some(visible) && (
					<p className="p-6 text-center text-muted-foreground text-sm">줄 없음</p>
				)}
			</div>
		</div>
	);
}

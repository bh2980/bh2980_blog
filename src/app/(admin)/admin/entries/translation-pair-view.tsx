"use client";

import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import { Tag } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/**
 * 빈칸에서 번역을 시작할 때의 뼈대: 원문과 같은 종류·구조(제목 단계, 목록 항목 수, 표 칸, 코드 언어)에서
 * 글자와 이미지 설명만 비운다. 빈 문단에서 시작하면 제목·목록을 번역할 때 종류가 달라진다.
 */
export const blankLike = (json: JSONContent): JSONContent => {
	const strip = (node: JSONContent): JSONContent | null => {
		if (node.type === "text") return null;
		// 다이어그램·차트·수식은 내용이 글자가 아니라 `value` 속성에 있다. 그것도 비운다.
		const attrs =
			node.type === "image"
				? { ...node.attrs, alt: "", caption: "", title: null }
				: typeof node.attrs?.value === "string"
					? { ...node.attrs, value: "" }
					: (node.attrs as JSONContent["attrs"]);
		const content = node.content?.map(strip).filter((child): child is JSONContent => child !== null);
		return { ...node, ...(attrs ? { attrs } : {}), ...(node.content ? { content } : {}) };
	};
	return strip(json) ?? { type: "doc", content: [] };
};

/** 셀 위에 마우스를 올리거나 초점이 있을 때만 보이는 작은 도구줄. */
function CellToolbar({ children }: { children: ReactNode }) {
	return (
		<div className="absolute -top-3 right-1 z-[1] flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-focus-within/cell:opacity-100 group-hover/cell:opacity-100">
			{children}
		</div>
	);
}

const toolButton = "h-6 bg-background px-1.5 text-xs";

interface CellEditorProps {
	source: string;
	/** 저장된 번역. `null`이면 미번역이다. */
	target: string | null;
	editable: boolean;
	/** 0이 아니면 이 셀에 초점을 달라는 요청이다. */
	focusToken: number;
	onFocusHandled: () => void;
	onCommit: (target: string | null) => void;
}

interface BlockEditorProps extends CellEditorProps {
	type: string;
}

/** 서식이 없는 빈 뼈대 MDX. 이것과 같으면 비운 것으로 본다. */
const blankMdxOf = (source: string) => tiptapToMdx(blankLike(mdxToTiptap(source))).trim();

function BlockCellEditor({ type, source, target, editable, focusToken, onFocusHandled, onCommit }: BlockEditorProps) {
	const [extensions] = useState(() => buildEditorExtensions());
	const blank = useMemo(() => blankLike(mdxToTiptap(source)), [source]);
	const blankMdx = useMemo(() => blankMdxOf(source), [source]);
	const contentOf = (mdx: string | null) => (mdx ? mdxToTiptap(mdx) : blank);
	const [error, setError] = useState<string | null>(null);
	const [empty, setEmpty] = useState(() => !target);
	const [imageOpen, setImageOpen] = useState(false);
	const dirtyRef = useRef(false);
	/** 마지막으로 저장한(또는 저장돼 있던) 번역. Escape로 되돌릴 기준이다. */
	const committedRef = useRef(target);
	const isImage = type === "image";

	const isEmptyMdx = (mdx: string) => mdx === "" || mdx === blankMdx;

	const commitRef = useRef(() => {});
	const editor = useEditor({
		immediatelyRender: false,
		editable,
		extensions,
		content: contentOf(target),
		editorProps: {
			attributes: {
				"aria-label": "번역 편집기",
				class: cn(PROSE, "min-h-10 px-1 py-1 focus:outline-none [&_.tableWrapper]:overflow-x-auto"),
			},
		},
		onUpdate: ({ editor: current }) => {
			dirtyRef.current = true;
			setError(null);
			setEmpty(isEmptyMdx(tiptapToMdx(current.getJSON()).trim()));
		},
		onBlur: () => commitRef.current(),
	});

	const load = (mdx: string | null) => {
		if (!editor) return;
		editor.commands.setContent(contentOf(mdx), { emitUpdate: false });
		dirtyRef.current = false;
		setError(null);
		setEmpty(!mdx || isEmptyMdx(tiptapToMdx(editor.getJSON()).trim()));
	};

	const commit = () => {
		if (!editor || !dirtyRef.current) return;
		const mdx = tiptapToMdx(editor.getJSON()).trim();
		if (isEmptyMdx(mdx)) {
			dirtyRef.current = false;
			if (committedRef.current !== null) {
				committedRef.current = null;
				onCommit(null);
			}
			return;
		}
		const problem = validateFragment(mdx, type);
		if (problem) {
			setError(problem);
			return;
		}
		dirtyRef.current = false;
		committedRef.current = mdx;
		onCommit(mdx);
	};
	commitRef.current = commit;

	const copySource = () => {
		load(source);
		committedRef.current = source;
		onCommit(source);
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
		setImageOpen(false);
		commit();
	};

	useEffect(() => {
		editor?.setEditable(editable, false);
	}, [editor, editable]);

	// 밖에서 번역이 바뀌면(원문에 맞춰 다시 맞춤 등) 편집 중이 아닐 때 내용을 바꾼다.
	const previousTarget = useRef(target);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `load`는 매번 새로 만들어지지만 target이 바뀔 때만 다시 읽는다
	useEffect(() => {
		if (!editor || previousTarget.current === target) return;
		previousTarget.current = target;
		if (target === committedRef.current) return;
		committedRef.current = target;
		if (editor.isFocused || dirtyRef.current) return;
		load(target);
	}, [editor, target]);

	useEffect(() => {
		if (!focusToken || !editor) return;
		editor.commands.focus("end");
		onFocusHandled();
	}, [focusToken, editor, onFocusHandled]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: 셀 안 편집기의 키 처리를 모은다
		<div
			className="group/cell relative"
			onKeyDown={(event) => {
				if (!editable || event.nativeEvent.isComposing || !event.currentTarget.contains(event.target as Node)) return;
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					load(committedRef.current);
					editor?.commands.blur();
				} else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
					event.preventDefault();
					commit();
				}
			}}
		>
			<div className="relative rounded-md border border-transparent focus-within:border-ring/60 hover:border-border">
				<EditorContent editor={editor} />
				{empty && (
					<span
						className={cn(
							"pointer-events-none absolute left-1 text-muted-foreground text-sm",
							isImage ? "bottom-1" : "top-1",
						)}
					>
						미번역
					</span>
				)}
			</div>
			{error && (
				<p role="alert" className="mt-1 text-destructive text-xs">
					{error}
				</p>
			)}
			{editable && (
				<CellToolbar>
					<Button type="button" size="sm" variant="outline" className={toolButton} onClick={copySource}>
						{isImage ? "원문 이미지로" : "원문 복사"}
					</Button>
					{isImage && (
						<Button type="button" size="sm" variant="outline" className={toolButton} onClick={() => setImageOpen(true)}>
							이미지 바꾸기
						</Button>
					)}
				</CellToolbar>
			)}
			{editor && editable && <InlineBubble editor={editor} />}
			{isImage && editable && (
				<ImageInsertDialog
					open={imageOpen}
					initialFile={null}
					onClose={() => setImageOpen(false)}
					onInsert={swapImage}
				/>
			)}
		</div>
	);
}

function HeaderCellEditor({ source, target, editable, focusToken, onFocusHandled, onCommit }: CellEditorProps) {
	const sourceHeader = parseHeader(source);
	const isTitle = sourceHeader !== null && "title" in sourceHeader;
	const sourceTexts = headerTexts(sourceHeader);
	const textsOf = (value: string | null) => {
		const parsed = value === null ? null : parseHeader(value);
		const same = parsed && "title" in parsed === isTitle ? headerTexts(parsed) : [];
		return sourceTexts.map((_, index) => same[index] ?? "");
	};
	const [values, setValues] = useState(() => textsOf(target));
	const valuesRef = useRef(values);
	/** 마지막으로 저장한(또는 저장돼 있던) 번역과 그 글자들. */
	const committedRef = useRef(target);
	const committedTextsRef = useRef(values);
	const composingRef = useRef(false);
	const pendingRef = useRef(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const firstInputRef = useRef<HTMLInputElement>(null);

	const show = (next: string[]) => {
		valuesRef.current = next;
		setValues(next);
	};

	const commit = () => {
		// 조합 중에는 끝내지 않는다. 조합이 끝나면 이어서 끝낸다.
		if (composingRef.current) {
			pendingRef.current = true;
			return;
		}
		pendingRef.current = false;
		const next = valuesRef.current.map((value) => value.trim());
		if (next.every((value, index) => value === (committedTextsRef.current[index] ?? "").trim())) return;
		committedTextsRef.current = next;
		const result = next.every((value) => !value)
			? null
			: JSON.stringify(isTitle ? { title: next[0] ?? "" } : { labels: next });
		committedRef.current = result;
		onCommit(result);
	};

	const copySource = () => {
		show(sourceTexts);
		committedTextsRef.current = sourceTexts;
		committedRef.current = source;
		onCommit(source);
	};

	const previousTarget = useRef(target);
	// biome-ignore lint/correctness/useExhaustiveDependencies: target이 바뀔 때만 다시 읽는다
	useEffect(() => {
		if (previousTarget.current === target) return;
		previousTarget.current = target;
		if (target === committedRef.current) return;
		committedRef.current = target;
		if (rootRef.current?.contains(document.activeElement)) return;
		const next = textsOf(target);
		committedTextsRef.current = next;
		show(next);
	}, [target]);

	useEffect(() => {
		if (!focusToken) return;
		firstInputRef.current?.focus();
		onFocusHandled();
	}, [focusToken, onFocusHandled]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: 셀 안 입력들의 포커스 이동과 Escape를 모은다
		<div
			ref={rootRef}
			className="group/cell relative flex flex-col gap-1.5"
			onBlur={(event) => {
				// 같은 셀 안 다른 입력으로 옮길 때는 끝내지 않는다.
				if (!editable || event.currentTarget.contains(event.relatedTarget as Node | null)) return;
				commit();
			}}
			onKeyDown={(event) => {
				if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
				event.preventDefault();
				event.stopPropagation();
				show(committedTextsRef.current);
				(event.target as HTMLElement).blur();
			}}
		>
			{sourceTexts.map((_, index) => (
				<Input
					// biome-ignore lint/suspicious/noArrayIndexKey: 탭 이름은 순서가 곧 정체성이다
					key={index}
					ref={index === 0 ? firstInputRef : undefined}
					aria-label={isTitle ? "제목" : `탭 이름 ${index + 1}`}
					value={values[index] ?? ""}
					placeholder="미번역"
					readOnly={!editable}
					className="h-8 text-sm"
					onChange={(event) => {
						const next = [...valuesRef.current];
						next[index] = event.target.value;
						show(next);
					}}
					onCompositionStart={() => {
						composingRef.current = true;
					}}
					onCompositionEnd={(event) => {
						composingRef.current = false;
						const next = [...valuesRef.current];
						next[index] = event.currentTarget.value;
						show(next);
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
			{editable && (
				<CellToolbar>
					<Button type="button" size="sm" variant="outline" className={toolButton} onClick={copySource}>
						원문 복사
					</Button>
				</CellToolbar>
			)}
		</div>
	);
}

interface RowProps {
	row: AlignedUnit;
	index: number;
	editable: boolean;
	comparing: boolean;
	focusToken: number;
	rowRef: (element: HTMLElement | null) => void;
	onVisit: (index: number) => void;
	onFocusHandled: () => void;
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
	comparing,
	focusToken,
	rowRef,
	onVisit,
	onFocusHandled,
	onToggleCompare,
	onChangeTarget,
	onIgnoreChange,
}: RowProps) {
	const { unit } = row;
	const isHeader = unit.kind === "header";
	const depth = depthOf(unit.key);
	const changed = row.status === "changed" && !unit.auto;

	const commit = (value: string | null) => onChangeTarget(index, value);
	const cellProps = {
		source: unit.source,
		target: row.target,
		editable,
		focusToken,
		onFocusHandled,
		onCommit: commit,
	};

	const targetCell = unit.auto ? (
		<p className="text-muted-foreground text-sm">원문 그대로</p>
	) : isHeader ? (
		<HeaderCellEditor {...cellProps} />
	) : (
		<LazyMount minHeight={48}>
			<BlockCellEditor {...cellProps} type={unit.type} />
		</LazyMount>
	);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: 초점이 들어온 줄을 기억해 다음 미번역의 기준으로 삼는다
		<div
			ref={rowRef}
			data-row-index={index}
			data-status={unit.auto ? "auto" : row.status}
			className={cn("grid scroll-mt-28 grid-cols-2 border-b", isHeader && "bg-muted/40")}
			onFocus={() => onVisit(index)}
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
	const [comparing, setComparing] = useState<ReadonlySet<number>>(new Set());
	const [scrollTo, setScrollTo] = useState<number | null>(null);
	const [focusRequest, setFocusRequest] = useState<{ index: number; id: number } | null>(null);
	const rowElements = useRef(new Map<number, HTMLElement>());
	const lastRef = useRef(-1);
	const requestCount = useRef(0);

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

	const handleFocused = useCallback(() => setFocusRequest(null), []);

	if (sourceError) {
		return (
			<p role="alert" className="mx-auto w-full max-w-6xl px-4 py-10 text-center text-muted-foreground text-sm">
				원문을 해석할 수 없습니다. 원문을 먼저 고치세요.
			</p>
		);
	}

	const goNext = () => {
		const untranslated = rows.flatMap((row, index) => (row.status === "untranslated" && !row.unit.auto ? [index] : []));
		const next = untranslated.find((index) => index > lastRef.current) ?? untranslated[0];
		if (next === undefined) return;
		// 거른 보기에서 가려진 줄이면 전체로 돌려 보인다.
		setFilter((current) => (current === "changed" ? "all" : current));
		lastRef.current = next;
		setScrollTo(next);
		if (editable) {
			requestCount.current += 1;
			setFocusRequest({ index: next, id: requestCount.current });
		}
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
							comparing={comparing.has(index)}
							focusToken={focusRequest?.index === index ? focusRequest.id : 0}
							rowRef={(element) => {
								if (element) rowElements.current.set(index, element);
								else rowElements.current.delete(index);
							}}
							onVisit={(at) => {
								lastRef.current = at;
							}}
							onFocusHandled={handleFocused}
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

"use client";

import {
	autoSummary,
	CMS_TIME_ZONE,
	previewHref as contentPreviewHref,
	DEFAULT_COLLECTION,
	fillFromBodyFields,
	isCollection,
	isRecordCollection,
	parseDateTimeInput,
	slugFieldOf,
	slugFromValues,
} from "@bh2980/cms/client";
import { analyze } from "@bh2980/cms/mdx";
import type { IncomingReferenceItem } from "@bh2980/cms/runtime";
import {
	Archive,
	CalendarClock,
	ChevronLeft,
	Copy,
	Eye,
	FileCode,
	type LucideIcon,
	MoreHorizontal,
	PanelLeft,
	PanelRight,
	Save,
	SunMoon,
	Trash,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useEditorExtensions } from "../../admin-components";
import { CmsEditor } from "../../editor/tiptap-editor";
import { cn } from "../../lib/utils/cn";
import { josa } from "../../lib/utils/josa";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button, buttonVariants } from "../../ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { FieldLabel } from "../../ui/field";
import { IconButton } from "../../ui/icon-button";
import { Input } from "../../ui/input";
import { Skeleton } from "../../ui/skeleton";
import { Textarea } from "../../ui/textarea";
import { Toggle } from "../../ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { CmsApiError, cmsFetch, errorText } from "../admin-api";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { describeEntryStatus } from "../shared/entry-status";
import { SIDE_PANEL_WIDTH } from "../shared/side-panel";
import {
	EMPTY_FORM,
	type EntryData,
	type EntryForm,
	type EntryFormPatch,
	formFingerprint,
	formFromEntry,
	formText,
	isTranslationEntry,
	stringifyTranslation,
	TRANSLATION_FORM_KEY,
	translationSourceOf,
	translationStateFromForm,
} from "./entry-form";
import { InspectorPanel } from "./inspector-panel";
import { LanguageTabs } from "./language-tabs";
import {
	type ConfirmedLifecycleAction,
	LIFECYCLE_LABEL,
	LIFECYCLE_SUCCESS,
	type LifecycleAction,
	lifecycleConfirm,
} from "./lifecycle-confirm";
import { backupKey, deleteLocalBackup, getLocalBackup } from "./local-backup";
import { ConflictDialog, type Recovery, RecoveryDialog } from "./recovery-dialogs";
import { formatScheduleTime, ScheduleDialog, ScheduleNotice } from "./schedule-dialog";
import { SourceChangeDialog } from "./source-change-dialog";
import { SourcePane } from "./source-pane";
import { useSourceSync } from "./source-sync";
import { TemplateMenu } from "./template-menu";
import { SAVE_STATUS_LABELS, type SaveStatus, useEntryAutosave } from "./use-entry-autosave";

interface EntryEditorShellProps {
	mode: "new" | "edit";
	initialEntryId?: string;
	collection?: string;
	/** 복구본 키에 쓰는 관리자 ID(§5.1). */
	adminId: string;
	/** 새 글을 만들 폴더(목록에서 연 위치). */
	folderId?: string | null;
}

const SOURCE_PANE_STORAGE_KEY = "cms:translation-source-pane";

function ToolbarAction({
	label,
	icon: Icon,
	href,
	onClick,
	disabled = false,
}: {
	label: string;
	icon: LucideIcon;
	href?: string;
	onClick?: () => void;
	disabled?: boolean;
}) {
	const className = "size-8 shrink-0 text-muted-foreground";
	const icon = <Icon aria-hidden className="size-4" />;
	if (!href || disabled) {
		return (
			<IconButton label={label} side="bottom" disabled={disabled} className={className} onClick={onClick}>
				{icon}
			</IconButton>
		);
	}
	// 링크는 링크로 남긴다(새 탭 열기·주소 복사). 이름과 툴팁은 아이콘 버튼과 같다.
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={label}
						className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), className)}
					>
						{icon}
					</a>
				}
			/>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

/** 편집기 도구 모음 끝의 켜고 끄는 단추(원문 창·MDX 원문). 이름과 툴팁이 같다. */
function ToolbarToggle({
	label,
	text,
	icon: Icon,
	pressed,
	disabled,
	onPressedChange,
}: {
	label: string;
	text: string;
	icon: LucideIcon;
	pressed: boolean;
	disabled?: boolean;
	onPressedChange: (pressed: boolean) => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Toggle
						size="sm"
						aria-label={label}
						pressed={pressed}
						disabled={disabled}
						onPressedChange={onPressedChange}
						className="gap-1.5 text-muted-foreground aria-pressed:text-foreground"
					/>
				}
			>
				<Icon aria-hidden className="size-4" />
				{text}
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

/** "먼저 저장하세요" 안내. 편집 화면 어디서 막혀도 같은 말을 쓴다. */
const saveFirstMessage = (purpose: string) => `변경사항을 먼저 저장한 후 ${purpose}하세요.`;

/** 저장 상태 점의 색. 상태를 더하면 여기서 색을 정해야 한다. */
const SAVE_STATUS_DOT: Record<SaveStatus, string> = {
	new: "bg-muted-foreground/50",
	saved: "bg-emerald-500",
	dirty: "bg-muted-foreground/50",
	saving: "animate-pulse bg-amber-500",
	"local-only": "bg-muted-foreground/50",
	failed: "bg-destructive",
	conflict: "bg-destructive",
	"session-expired": "bg-destructive",
};

/** 머리글의 저장 상태. 좁은 화면에서는 점만 보이고 이름은 읽기 도구로 알린다. */
function SaveStatusIndicator({ status, backupAvailable }: { status: SaveStatus; backupAvailable: boolean }) {
	const label = `${SAVE_STATUS_LABELS[status]}${backupAvailable ? "" : " · 브라우저 복구 불가"}`;
	return (
		<output
			aria-live="polite"
			aria-label={label}
			className="mr-1 flex items-center gap-1.5 text-muted-foreground text-xs"
		>
			<span aria-hidden className={cn("size-2 rounded-full", SAVE_STATUS_DOT[status])} />
			<span className="hidden lg:inline">{label}</span>
		</output>
	);
}

/**
 * 저장·발행 응답에는 번역 묶음 정보(v2 B4)가 없다. 불러올 때 받은 값을 유지하고 이 콘텐츠의 상태만 갱신한다.
 */
function keepTranslationGroup(current: EntryData | null, next: EntryData): Pick<EntryData, "translations" | "source"> {
	const translations = (current?.translations ?? next.translations)?.map((member) =>
		member.id === next.id ? { ...member, status: next.status } : member,
	);
	return { translations, source: current?.source ?? next.source };
}

/**
 * 게시글·메모 편집 화면(§3.1, §5). 태그·카테고리·모음집(record 컬렉션)은 목록의 작은 폼에서 편집한다.
 */
/** 설정 시간대의 이름(예: `한국 표준시`). 예약 시각 안내에 쓴다. */
const timeZoneName = () =>
	new Intl.DateTimeFormat("ko-KR", { timeZone: CMS_TIME_ZONE, timeZoneName: "long" })
		.formatToParts(new Date())
		.find((part) => part.type === "timeZoneName")?.value ?? CMS_TIME_ZONE;

export function EntryEditorShell({
	mode,
	initialEntryId,
	collection: propCollection = DEFAULT_COLLECTION,
	adminId,
	folderId,
}: EntryEditorShellProps) {
	const router = useRouter();
	const { resolvedTheme, setTheme } = useTheme();
	const [entry, setEntry] = useState<EntryData | null>(null);
	const [collection, setCollection] = useState(propCollection);
	const [isLoading, setIsLoading] = useState(mode === "edit");
	const [loadError, setLoadError] = useState<string | null>(null);
	const [editorMode, setEditorMode] = useState<"visual" | "source">("visual");
	const [isInspectorOpen, setIsInspectorOpen] = useState(true);
	const [isNarrowScreen, setIsNarrowScreen] = useState(false);
	const [isSourcePaneOpen, setIsSourcePaneOpen] = useState(true);
	const [isSourceCompareOpen, setIsSourceCompareOpen] = useState(false);
	const editorScrollRef = useRef<HTMLDivElement>(null);
	const sourcePaneRef = useRef<HTMLElement>(null);
	const [isSlugTouched, setIsSlugTouched] = useState(mode === "edit");
	/** 머리 단추가 하는 일. 하는 동안 단추를 막고 글자를 바꾼다. */
	const [busy, setBusy] = useState<"publish" | "schedule" | "status" | null>(null);
	const isSubmitting = busy !== null;
	/** 예약 창 안에 보일 오류. 창을 연 채 오류를 창 밖에 보이지 않는다. */
	const [scheduleError, setScheduleError] = useState<string | null>(null);
	const [publishIssues, setPublishIssues] = useState<CmsIssue[]>([]);
	const [pendingBodyPosition, setPendingBodyPosition] = useState<CmsIssue["position"]>();
	const [pendingFieldPath, setPendingFieldPath] = useState<string | null>(null);
	const [recovery, setRecovery] = useState<Recovery | null>(null);
	const [conflict, setConflict] = useState<{ server: EntryData; local: EntryForm } | null>(null);
	const [scheduleOpen, setScheduleOpen] = useState(false);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const [incoming, setIncoming] = useState<{ items: IncomingReferenceItem[]; loading: boolean; error: string | null }>({
		items: [],
		loading: false,
		error: null,
	});

	const scheduleLocked = Boolean(entry?.schedule?.pending);
	const isTrashed = entry?.status === "trashed";
	const isReadOnly = scheduleLocked || isTrashed;

	const autosave = useEntryAutosave({
		adminId,
		collection,
		entry,
		initialForm: EMPTY_FORM,
		enabled: !isReadOnly,
		newEntryFolderId: folderId,
		// 저장 응답에는 예약·번역 묶음 정보가 없다. 불러올 때 받은 값을 유지한다.
		onSaved: (saved) =>
			setEntry((current) => ({
				...saved,
				schedule: current?.schedule ?? saved.schedule,
				...keepTranslationGroup(current, saved),
			})),
		onConflict: (server, local) => setConflict({ server, local }),
	});
	const { form, setForm } = autosave;

	// §4.4: 해석할 수 없는 MDX나 frontmatter가 있는 본문은 시각 모드로 열지 않는다. 열면 빈 문서가 되어
	// 입력 한 번에 원문이 덮어써진다. 원문 모드에서 고치거나 보존한 채 저장할 수 있다.
	const deferredMdx = useDeferredValue(form.mdx);
	const sourceProblems = useMemo<CmsIssue[]>(() => {
		const analysis = analyze(deferredMdx);
		const problems: CmsIssue[] = analysis.errors.map((error) => ({
			code: "mdx_error",
			message: error.message,
			position: error.position,
		}));
		if (analysis.frontmatter !== null) problems.push({ code: "frontmatter_present", position: { line: 1, column: 1 } });
		return problems;
	}, [deferredMdx]);
	const canUseVisual = sourceProblems.length === 0;
	useEffect(() => {
		if (!canUseVisual && editorMode === "visual") setEditorMode("source");
	}, [canUseVisual, editorMode]);

	useEffect(() => {
		const media = window.matchMedia?.("(max-width: 1023px)");
		if (!media) return;
		const update = () => {
			setIsNarrowScreen(media.matches);
			// 1024px 이하에서는 본문을 우선한다(§3.1).
			if (media.matches) {
				setIsInspectorOpen(false);
				setIsSourcePaneOpen(false);
			}
		};
		update();
		media.addEventListener?.("change", update);
		return () => media.removeEventListener?.("change", update);
	}, []);

	// 원문 창을 열어 뒀는지는 브라우저에 기억한다. 저장소를 못 쓰면 매번 열린 채 시작한다.
	useEffect(() => {
		try {
			if (window.localStorage.getItem(SOURCE_PANE_STORAGE_KEY) === "closed") setIsSourcePaneOpen(false);
		} catch {
			// 저장소를 쓸 수 없으면 기본값을 쓴다.
		}
	}, []);
	const toggleSourcePane = (open: boolean) => {
		setIsSourcePaneOpen(open);
		try {
			window.localStorage.setItem(SOURCE_PANE_STORAGE_KEY, open ? "open" : "closed");
		} catch {
			// 기억하지 못해도 화면은 바뀐다.
		}
	};

	const translationSource = translationSourceOf(entry);
	const translationForm = form[TRANSLATION_FORM_KEY];
	/** 번역자가 마지막으로 확인한 원문. 지금 원문과 다르면 "원문이 바뀌었습니다"를 보인다. */
	const confirmedSource = translationStateFromForm(translationForm).baseSource;
	const sourceChanged =
		translationSource !== null && typeof translationForm === "string" && translationSource.mdx !== confirmedSource;

	useSourceSync({
		enabled: translationSource !== null && isSourcePaneOpen,
		syncScroll: editorMode === "visual",
		editorRef: editorScrollRef,
		paneRef: sourcePaneRef,
	});

	// 편집 화면 확장(플러그인의 툴바·블록 동작, 예: AI 번역). 언어가 같으면 같은 객체를 넘겨 동작이 다시 만들어지지 않게 한다.
	const sourceLocale = translationSource?.locale;
	const targetLocale = entry?.locale;
	const translateLocales = useMemo(
		() => (sourceLocale && targetLocale ? { sourceLocale: sourceLocale, targetLocale: targetLocale } : null),
		[sourceLocale, targetLocale],
	);
	const formRef = useRef(form);
	formRef.current = form;
	const getEntry = useCallback(
		() => ({
			title: formText(formRef.current, "title"),
			collection,
			...(entry?.locale ? { locale: entry.locale } : {}),
			...(entry?.id ? { entryId: entry.id } : {}),
		}),
		[collection, entry?.locale, entry?.id],
	);
	const extensions = useEditorExtensions({ translateLocales, getEntry });

	const refreshIncoming = useCallback(async (targetId: string) => {
		setIncoming((current) => ({ ...current, loading: true, error: null }));
		try {
			const data = await cmsFetch<{ incomingReferences: IncomingReferenceItem[] }>(
				`/api/cms/v1/entries/${targetId}/relations`,
			);
			setIncoming({ items: data.incomingReferences ?? [], loading: false, error: null });
		} catch {
			setIncoming({ items: [], loading: false, error: "사용처를 불러오지 못했습니다." });
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: autosave methods are ref-backed and stable
	const loadEntry = useCallback(
		async (id: string) => {
			const loaded = await cmsFetch<EntryData>(`/api/cms/v1/entries/${id}`, { fallback: "문서를 불러올 수 없습니다." });
			if (isRecordCollection(loaded.collection)) {
				// 태그·카테고리·모음집은 명시적 저장 폼을 쓴다(§5.2).
				router.replace(`/admin?collection=${loaded.collection}`);
				return null;
			}
			const loadedForm = formFromEntry(loaded);
			setEntry(loaded);
			setCollection(loaded.collection);
			autosave.resetFromServer(loaded, loadedForm);
			void refreshIncoming(loaded.id);
			return { loaded, loadedForm };
		},
		[refreshIncoming, router],
	);

	// 편집 화면을 열 때 서버 값과 브라우저 복구본을 비교한다(§5.1).
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once per opened entry
	useEffect(() => {
		let cancelled = false;
		const open = async () => {
			if (mode === "new") {
				if (isRecordCollection(propCollection)) {
					router.replace(`/admin?collection=${propCollection}`);
					return;
				}
				const backup = await getLocalBackup<EntryForm>(backupKey(adminId, null, propCollection));
				if (!cancelled && backup && backup.localFingerprint !== backup.baseFingerprint) {
					setRecovery({ kind: "restore", backup });
				}
				return;
			}
			try {
				const result = await loadEntry(initialEntryId as string);
				if (!result || cancelled) return;
				const key = backupKey(adminId, result.loaded.id, result.loaded.collection);
				const backup = await getLocalBackup<EntryForm>(key);
				if (!backup || cancelled) return;
				if (backup.localFingerprint === formFingerprint(result.loadedForm)) {
					await deleteLocalBackup(key);
				} else if (backup.baseVersion === result.loaded.version) {
					setRecovery({ kind: "restore", backup });
				} else {
					// 복구본 이후 서버도 바뀌었다. 불러오면 덮어쓴다는 것을 알린다.
					setRecovery({ kind: "conflict", backup, server: result.loaded });
				}
			} catch (error) {
				if (!cancelled) setLoadError(errorText(error, "문서를 불러올 수 없습니다."));
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};
		void open();
		return () => {
			cancelled = true;
		};
	}, [mode, initialEntryId]);

	const applyRecovered = (recovered: EntryForm) => {
		setIsSlugTouched(true);
		setForm(recovered);
		setRecovery(null);
	};

	/** 주소를 직접 고치지 않았으면 주소 필드의 `from`이 가리키는 값이 바뀔 때 주소를 다시 만든다. */
	const withAutoSlug = (patch: EntryFormPatch): EntryFormPatch => {
		if (isSlugTouched || !isCollection(collection)) return patch;
		const from = slugFieldOf(collection)?.from;
		if (!from || !Object.hasOwn(patch, from)) return patch;
		return { ...patch, slug: slugFromValues(collection, { ...form, ...patch }) };
	};
	const handleTitleChange = (title: string) => setForm(withAutoSlug({ title }));

	const focusIssue = (issue: CmsIssue) => {
		if (issue.path === "title") {
			if (isNarrowScreen) setIsInspectorOpen(false);
			setPendingFieldPath("title-canvas");
			return;
		}
		if (issue.position || issue.path === "mdx" || issue.path === "frontmatter") {
			if (isNarrowScreen) setIsInspectorOpen(false);
			setPendingBodyPosition(issue.position ?? { line: 1, column: 1 });
			setEditorMode("source");
			return;
		}
		if (issue.path) {
			setPendingFieldPath(issue.path);
			setIsInspectorOpen(true);
		}
	};

	useEffect(() => {
		if (!pendingBodyPosition || editorMode !== "source") return;
		const textarea = document.getElementById("cms-mdx-source") as HTMLTextAreaElement | null;
		if (!textarea) return;
		const lines = form.mdx.split("\n");
		const offset = lines.slice(0, pendingBodyPosition.line - 1).reduce((sum, line) => sum + line.length + 1, 0);
		const index = Math.min(form.mdx.length, offset + pendingBodyPosition.column - 1);
		textarea.focus();
		textarea.setSelectionRange(index, index);
		setPendingBodyPosition(undefined);
	}, [pendingBodyPosition, editorMode, form.mdx]);

	// 속성 필드는 속성 칸이 그 탭을 열고 초점을 옮긴다. 여기서는 본문 위 제목만 다룬다.
	useEffect(() => {
		if (pendingFieldPath !== "title-canvas") return;
		const control = document.getElementById("cms-title-canvas");
		if (control) {
			control.focus();
			setPendingFieldPath(null);
		}
	}, [pendingFieldPath]);

	/**
	 * 명시적 발행만 현재 입력을 저장한다. 다른 작업은 미저장 입력이 있으면 먼저 저장하도록 안내한다.
	 * 안내는 누른 자리 가까이에 보인다. 머리 단추·메뉴는 토스트(기본), 예약 창은 창 안이다.
	 */
	const ensureSaved = async (
		purpose: string,
		{ saveChanges = false, report = toast.error }: { saveChanges?: boolean; report?: (message: string) => void } = {},
	) => {
		if (autosave.status === "conflict") {
			report(`편집 충돌을 해결한 후 ${purpose}하세요.`);
			return null;
		}
		if (saveChanges && !(await autosave.flush())) {
			report(
				`변경사항이 서버에 저장되지 않아 ${purpose}하지 않았습니다. ${autosave.getLastError() ?? "저장 상태를 확인하세요."}`,
			);
			return null;
		}
		const id = autosave.getEntryId();
		if (!id || (!saveChanges && autosave.hasPendingChanges())) {
			report(saveFirstMessage(purpose));
			return null;
		}
		return id;
	};

	const handleSaveNow = async () => {
		if (isReadOnly) return;
		if (await autosave.flush()) toast.success("저장했습니다.");
		// 실패하면 반드시 이유를 보인다(충돌은 충돌 창이 따로 뜬다).
		else if (autosave.getStatus() !== "conflict") toast.error(autosave.getLastError() ?? "저장하지 못했습니다.");
	};

	/**
	 * 미리보기는 서버 초안을 그린다. 저장하지 않은 변경이 있으면 먼저 저장하고 연다.
	 * 저장을 기다리는 동안 팝업 차단에 걸리지 않게 창은 누르자마자 열어 둔다.
	 */
	const handlePreview = async (href: string) => {
		const opened = window.open("about:blank", "_blank");
		if (opened) opened.opener = null;
		if (isReadOnly || (await autosave.flush())) {
			if (opened) opened.location.href = href;
			else window.open(href, "_blank", "noopener");
			return;
		}
		opened?.close();
		toast.error(`저장하지 못해 미리보기를 열지 않았습니다. ${autosave.getLastError() ?? ""}`.trim());
	};

	const handlePublish = async () => {
		if (isSubmitting || isReadOnly) return;
		setPublishIssues([]);
		// §5.6: 본문에서 채우는 필드(`fillFromBody`)가 비었으면 본문에서 만들어 보여 준다. 만들 글이 없으면 직접 입력해야 한다.
		for (const { name, field } of isCollection(collection) ? fillFromBodyFields(collection) : []) {
			if (formText(form, name).trim()) continue;
			const generated = autoSummary(form.mdx);
			if (!generated) {
				setPublishIssues([{ code: "missing_field", message: field.label, path: name }]);
				toast.error(`${josa(field.label, "을", "를")} 만들 본문이 없습니다. 직접 입력하세요.`);
				return;
			}
			setForm({ [name]: generated });
			toast.message(`본문에서 ${josa(field.label, "을", "를")} 만들었습니다. 속성 패널에서 고칠 수 있습니다.`);
		}
		// 막지는 않는다. 확인하지 않은 원문 변경이 있는 채로 나가는 것만 알린다.
		if (sourceChanged) toast.warning("확인하지 않은 원문 변경이 있습니다.");
		setBusy("publish");
		try {
			const id = await ensureSaved("발행", { saveChanges: true });
			if (!id) return;
			const published = await cmsFetch<EntryData & { warnings?: CmsIssue[] }>(`/api/cms/v1/entries/${id}/publish`, {
				method: "POST",
				json: { expectedVersion: autosave.getVersion() },
				fallback: "발행하지 못했습니다.",
			});
			autosave.setVersion(published.version);
			// 수동 발행은 대기 중인 예약을 대신한다(서버가 예약을 취소한다).
			setEntry((current) => ({
				...published,
				schedule: current?.schedule ? { ...current.schedule, pending: null } : published.schedule,
				...keepTranslationGroup(current, published),
			}));
			void refreshIncoming(id);
			const warnings = published.warnings ?? [];
			if (warnings.length > 0) {
				toast.warning(`발행되었습니다. 확인할 경고 ${warnings.length}건`, {
					description: warnings.slice(0, 5).map(cmsIssueMessage).join("\n"),
					duration: 10000,
					action: warnings[0]?.position
						? { label: "이동", onClick: () => focusIssue(warnings[0] as CmsIssue) }
						: undefined,
				});
			} else {
				toast.success("발행되었습니다.");
			}
		} catch (error) {
			if (error instanceof CmsApiError && error.code === "conflict") {
				const server = await cmsFetch<EntryData>(`/api/cms/v1/entries/${autosave.getEntryId()}`).catch(() => null);
				if (server) setConflict({ server, local: form });
				return;
			}
			if (error instanceof CmsApiError && error.issues.length > 0) {
				setPublishIssues(error.issues);
				toast.error("발행할 수 없습니다. 아래 문제를 수정하세요.");
				return;
			}
			toast.error(errorText(error, "발행하지 못했습니다."));
		} finally {
			setBusy(null);
		}
	};

	const handleSchedule = async (dateTime: string) => {
		if (isSubmitting) return;
		setScheduleError(null);
		const scheduledAt = parseDateTimeInput(dateTime);
		if (!scheduledAt) {
			setScheduleError(`예약 일시를 확인하세요. ${timeZoneName()} 기준입니다.`);
			return;
		}
		if (Date.parse(scheduledAt) <= Date.now()) {
			setScheduleError("예약은 미래 시각만 지정할 수 있습니다.");
			return;
		}
		setBusy("schedule");
		try {
			const id = await ensureSaved("예약", { report: setScheduleError });
			if (!id) return;
			await cmsFetch(`/api/cms/v1/entries/${id}/schedule`, {
				method: "POST",
				json: { expectedVersion: autosave.getVersion(), scheduledAt },
				fallback: "예약하지 못했습니다.",
			});
			setScheduleOpen(false);
			await loadEntry(id);
			toast.success(`${formatScheduleTime(scheduledAt)}에 발행하도록 예약했습니다.`);
		} catch (error) {
			// 발행 검사에 걸리면 창을 닫고 문제 목록을 보인다. 그 밖의 실패는 창 안에 보인다.
			if (error instanceof CmsApiError && error.issues.length > 0) {
				setPublishIssues(error.issues);
				setScheduleOpen(false);
				toast.error("예약할 수 없습니다. 아래 문제를 수정하세요.");
				return;
			}
			setScheduleError(errorText(error, "예약하지 못했습니다."));
		} finally {
			setBusy(null);
		}
	};

	const handleCancelSchedule = async () => {
		const pending = entry?.schedule?.pending;
		if (!entry || !pending || isSubmitting) return;
		setBusy("status");
		try {
			await cmsFetch(`/api/cms/v1/entries/${entry.id}/schedule?scheduleId=${pending.id}`, { method: "DELETE" });
			await loadEntry(entry.id);
			toast.success("예약을 해제했습니다. 이제 편집할 수 있습니다.");
		} catch (error) {
			toast.error(errorText(error, "예약을 해제하지 못했습니다."));
		} finally {
			setBusy(null);
		}
	};

	/** 보관·보관 해제·휴지통·복원(§5.3). */
	const runLifecycle = async (action: LifecycleAction) => {
		if (!entry || isSubmitting) return;
		if (action !== "restore" && autosave.hasPendingChanges()) {
			toast.error(saveFirstMessage(LIFECYCLE_LABEL[action]));
			return;
		}
		setBusy("status");
		try {
			await cmsFetch(`/api/cms/v1/entries/${entry.id}/${action}`, {
				method: "POST",
				json: { expectedVersion: autosave.getVersion() },
			});
			// 번역본을 휴지통으로 보내면 원문 편집 화면으로 돌아간다.
			if (action === "trash" && isTranslationEntry(entry) && entry.translationGroupId) {
				toast.success(LIFECYCLE_SUCCESS[action]);
				router.push(`/admin/entries/${entry.translationGroupId}/edit`);
				return;
			}
			await loadEntry(entry.id);
			toast.success(LIFECYCLE_SUCCESS[action]);
		} catch (error) {
			toast.error(errorText(error, `${LIFECYCLE_LABEL[action]}하지 못했습니다.`));
		} finally {
			setBusy(null);
		}
	};

	/** 공개 글을 내리는 전환(보관·휴지통 이동)만 묻는다. 보관 해제·복원은 바로 한다(§5). */
	const confirmLifecycle = (action: ConfirmedLifecycleAction) => {
		setConfirm({ ...lifecycleConfirm(action, entry, incoming.items), onConfirm: () => runLifecycle(action) });
	};

	const confirmPermanentDelete = () => {
		if (!entry) return;
		setConfirm({
			title: "영구 삭제",
			description:
				"이 글을 영구 삭제할까요? 되돌릴 수 없습니다. 공개된 적 있는 주소는 다른 글이 다시 쓸 수 없도록 기록만 남습니다.",
			confirmLabel: "영구 삭제",
			destructive: true,
			onConfirm: async () => {
				try {
					await cmsFetch(`/api/cms/v1/entries/${entry.id}?expectedVersion=${autosave.getVersion()}`, {
						method: "DELETE",
					});
					await deleteLocalBackup(backupKey(adminId, entry.id, entry.collection));
					router.push(`/admin?collection=${entry.collection}&status=trashed`);
				} catch (error) {
					toast.error(errorText(error, "삭제하지 못했습니다."));
				}
			},
		});
	};

	const handleDuplicate = async () => {
		const id = await ensureSaved("복제");
		if (!id) return;
		try {
			const copy = await cmsFetch<EntryData>(`/api/cms/v1/entries/${id}/duplicate`, { method: "POST", json: {} });
			router.push(`/admin/entries/${copy.id}/edit`);
		} catch (error) {
			toast.error(errorText(error, "복제하지 못했습니다."));
		}
	};

	// 번역본은 원문과 slug를 같이 쓸 수 있어 언어를 함께 넘긴다(v2 B4).
	const previewHref = entry ? contentPreviewHref(collection, entry.workingSlug, entry.locale) : null;

	// Cmd/Ctrl+S 즉시 저장. 매 렌더의 최신 상태를 쓰도록 다시 등록한다.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing) return;
			const key = event.key.toLowerCase();
			if (key === "s") {
				event.preventDefault();
				void handleSaveNow();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	if (isLoading) {
		return (
			<div className="space-y-4 p-8" aria-busy>
				<span className="sr-only">문서를 불러오는 중…</span>
				<Skeleton className="h-8 w-1/2" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-5/6" />
			</div>
		);
	}
	if (loadError) {
		return (
			<div className="space-y-3 p-8">
				<Alert variant="danger">
					<AlertDescription className="col-start-auto">{loadError}</AlertDescription>
				</Alert>
				<Link href="/admin" className={buttonVariants({ variant: "outline" })}>
					목록으로
				</Link>
			</div>
		);
	}

	const schedule = entry?.schedule;
	const statusLabel = entry
		? describeEntryStatus({ ...entry, scheduledAt: schedule?.pending?.scheduledAt ?? null })
		: "새 글";
	const canRetry = ["failed", "local-only", "session-expired"].includes(autosave.status);
	const bodyIssue = publishIssues.find((issue) => issue.path === "mdx" || Boolean(issue.position));
	const titleIssue = publishIssues.find((issue) => issue.path === "title");
	const languageTabs =
		entry && !isRecordCollection(collection) ? (
			<LanguageTabs
				entry={entry}
				disabled={isReadOnly}
				onBeforeCreate={async () => !autosave.hasPendingChanges()}
				onTrashTranslation={() => confirmLifecycle("trash")}
			/>
		) : null;
	const titleInput = (
		<>
			<FieldLabel htmlFor="cms-title-canvas" className="sr-only">
				제목
			</FieldLabel>
			<Input
				id="cms-title-canvas"
				value={form.title}
				readOnly={isReadOnly}
				aria-invalid={Boolean(titleIssue) || undefined}
				aria-describedby={titleIssue ? "cms-title-error" : undefined}
				onChange={(event) => handleTitleChange(event.target.value)}
				placeholder={translationSource?.title || "제목 없음"}
				className="h-auto w-full rounded-none border-0 bg-transparent px-6 py-1 font-semibold text-[34px] leading-tight tracking-tight shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0 md:text-[34px] dark:bg-transparent"
			/>
			{titleIssue && (
				<p id="cms-title-error" className="text-destructive text-sm">
					{cmsIssueMessage(titleIssue)}
				</p>
			)}
		</>
	);
	const sourcePaneToggle = translationSource && (
		<ToolbarToggle
			label="원문"
			text="원문"
			icon={PanelLeft}
			pressed={isSourcePaneOpen}
			onPressedChange={toggleSourcePane}
		/>
	);
	const sourceModeToggle = (
		<ToolbarToggle
			label="MDX 원문"
			text="MDX"
			icon={FileCode}
			pressed={editorMode === "source"}
			// 해석할 수 없는 본문은 시각 모드로 돌아가지 못한다.
			disabled={editorMode === "source" && !canUseVisual}
			onPressedChange={(pressed) => setEditorMode(pressed ? "source" : "visual")}
		/>
	);
	const sourceEditor = (
		<>
			<Textarea
				id="cms-mdx-source"
				aria-label="MDX 본문"
				aria-invalid={Boolean(bodyIssue) || !canUseVisual || undefined}
				aria-describedby={bodyIssue ? "cms-mdx-error" : undefined}
				value={form.mdx}
				readOnly={isReadOnly}
				onChange={(event) => setForm({ mdx: event.target.value })}
				onCompositionStart={() => autosave.setComposing(true)}
				onCompositionEnd={() => autosave.setComposing(false)}
				placeholder="MDX 원문을 작성하세요…"
				className="min-h-[calc(100vh-240px)] w-full flex-1 resize-none p-4 font-mono text-sm md:text-sm"
			/>
			{bodyIssue && (
				<p id="cms-mdx-error" className="mt-2 text-destructive text-sm">
					{cmsIssueMessage(bodyIssue)}
				</p>
			)}
		</>
	);

	return (
		<div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
			<header className="z-20 flex min-h-13 shrink-0 flex-wrap items-center justify-between gap-1 border-b bg-background/95 px-3 py-2 backdrop-blur sm:flex-nowrap lg:px-4">
				<div className="flex min-w-0 items-center gap-2 text-[13px]">
					<Tooltip>
						<TooltipTrigger
							render={
								<Link
									href={`/admin?collection=${collection}`}
									aria-label="목록으로"
									className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "size-8 text-muted-foreground")}
								>
									<ChevronLeft aria-hidden className="size-4" />
								</Link>
							}
						/>
						<TooltipContent side="bottom">목록으로</TooltipContent>
					</Tooltip>
					<span className="hidden rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs sm:inline-flex">
						{statusLabel}
					</span>
				</div>

				<div className="flex w-full items-center justify-end gap-1 whitespace-nowrap sm:w-auto">
					<SaveStatusIndicator status={autosave.status} backupAvailable={autosave.backupAvailable} />
					{canRetry && (
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="text-muted-foreground"
							onClick={() => void autosave.retry(true)}
						>
							다시 시도
						</Button>
					)}
					{autosave.status === "session-expired" && (
						<a
							href="/admin/login"
							target="_blank"
							rel="noreferrer"
							className={buttonVariants({ variant: "link", size: "xs" })}
						>
							새 창에서 로그인
						</a>
					)}

					<ToolbarAction
						label="저장"
						icon={Save}
						disabled={isReadOnly || isSubmitting || autosave.status === "saving"}
						onClick={() => void handleSaveNow()}
					/>
					{previewHref && (
						<ToolbarAction
							label="미리보기"
							icon={Eye}
							href={autosave.hasPendingChanges() ? undefined : previewHref}
							onClick={() => void handlePreview(previewHref)}
						/>
					)}
					{!isReadOnly && entry?.status !== "archived" && (
						<ToolbarAction
							label="발행 예약"
							icon={CalendarClock}
							disabled={isSubmitting}
							onClick={() => {
								setScheduleError(null);
								setScheduleOpen(true);
							}}
						/>
					)}
					{/* 하나만 바꾸는 전환(발행·보관 해제·복원·예약 해제)은 묻지 않고 바로 한다(§5). */}
					{scheduleLocked ? (
						<Button
							type="button"
							size="sm"
							className="ml-1"
							disabled={isSubmitting}
							onClick={() => void handleCancelSchedule()}
						>
							{busy === "status" ? "예약 해제 중…" : "예약 해제"}
						</Button>
					) : isTrashed ? (
						<Button
							type="button"
							size="sm"
							className="ml-1"
							disabled={isSubmitting}
							onClick={() => void runLifecycle("restore")}
						>
							{busy === "status" ? "복원 중…" : "복원"}
						</Button>
					) : entry?.status === "archived" ? (
						<Button
							type="button"
							size="sm"
							className="ml-1"
							disabled={isSubmitting}
							onClick={() => void runLifecycle("unarchive")}
						>
							{busy === "status" ? "보관 해제 중…" : "보관 해제"}
						</Button>
					) : (
						<Button
							id="cms-publish"
							type="button"
							size="sm"
							className="ml-1"
							disabled={isSubmitting}
							onClick={() => void handlePublish()}
						>
							{busy === "publish" ? "발행 중…" : "발행"}
						</Button>
					)}
					<IconButton
						label="속성"
						side="bottom"
						pressed={isInspectorOpen}
						className="size-8 text-muted-foreground"
						onClick={() => setIsInspectorOpen((open) => !open)}
					>
						<PanelRight aria-hidden className="size-4" />
					</IconButton>
					<DropdownMenu>
						<IconButton
							label="더보기"
							side="bottom"
							className="size-8 text-muted-foreground"
							trigger={(button) => <DropdownMenuTrigger render={button} />}
						>
							<MoreHorizontal aria-hidden className="size-4" />
						</IconButton>
						<DropdownMenuContent align="end" className="w-56">
							{/* 저장은 머리의 저장 단추와 ⌘S로 한다. 메뉴에 다시 두지 않는다. */}
							{entry && !isTrashed && (
								<>
									<DropdownMenuItem onClick={() => void handleDuplicate()}>
										<Copy aria-hidden />
										복제
									</DropdownMenuItem>
									{(entry.status === "draft" || entry.status === "published") && (
										<DropdownMenuItem onClick={() => confirmLifecycle("archive")}>
											<Archive aria-hidden />
											보관
										</DropdownMenuItem>
									)}
								</>
							)}
							{entry && (
								<>
									{!isTrashed && <DropdownMenuSeparator />}
									{isTrashed ? (
										<DropdownMenuItem variant="destructive" onClick={confirmPermanentDelete}>
											<Trash aria-hidden />
											영구 삭제
										</DropdownMenuItem>
									) : (
										<DropdownMenuItem variant="destructive" onClick={() => confirmLifecycle("trash")}>
											<Trash2 aria-hidden />
											휴지통으로 이동
										</DropdownMenuItem>
									)}
								</>
							)}
							{entry && <DropdownMenuSeparator />}
							<DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
								<SunMoon aria-hidden />
								테마 전환
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			<ScheduleNotice schedule={schedule} />
			{isTrashed && (
				<section aria-label="휴지통" className="flex flex-wrap items-center gap-2 border-b bg-muted px-4 py-2 text-sm">
					<span>휴지통에 있는 글입니다. 복원하기 전에는 편집할 수 없습니다.</span>
				</section>
			)}
			{!canUseVisual && (
				<output className="border-b bg-amber-500/10 px-4 py-2 text-sm">
					해석할 수 없는 본문이 있어 원문 모드로만 편집합니다. 저장은 되지만 발행은 막힙니다 —{" "}
					{sourceProblems[0] ? cmsIssueMessage(sourceProblems[0]) : ""}
				</output>
			)}
			{autosave.lastError && ["failed", "session-expired"].includes(autosave.status) && (
				<p role="alert" className="border-b px-4 py-2 text-destructive text-sm">
					{autosave.lastError}
				</p>
			)}
			{publishIssues.length > 0 && (
				<ul className="max-h-36 overflow-y-auto border-b px-4 py-2 text-sm" aria-label="발행 검증 문제">
					{publishIssues.map((issue) => (
						<li key={JSON.stringify(issue)}>
							<Button
								type="button"
								variant="link"
								size="xs"
								className="h-auto whitespace-normal px-0 text-left"
								onClick={() => focusIssue(issue)}
							>
								{cmsIssueMessage(issue)}
							</Button>
						</li>
					))}
				</ul>
			)}

			{sourceChanged && translationSource && (
				<output className="flex flex-wrap items-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-sm">
					<span className="flex-1 font-medium text-amber-700 dark:text-amber-400">원문이 바뀌었습니다</span>
					<Button type="button" size="sm" variant="outline" onClick={() => setIsSourceCompareOpen(true)}>
						비교
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={isReadOnly}
						onClick={() =>
							setForm({
								[TRANSLATION_FORM_KEY]: stringifyTranslation({ version: 2, baseSource: translationSource.mdx }),
							})
						}
					>
						확인
					</Button>
				</output>
			)}

			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				{translationSource && isSourcePaneOpen && (
					<SourcePane
						ref={sourcePaneRef}
						mdx={translationSource.mdx}
						title={translationSource.title}
						locale={translationSource.locale}
						onClose={() => toggleSourcePane(false)}
						className="absolute inset-y-0 left-0 z-10 w-[min(100%,28rem)] shadow-lg lg:static lg:w-[45%] lg:shrink-0 lg:shadow-none"
					/>
				)}
				<div
					ref={editorScrollRef}
					// 원문 창과 아래 여백을 같게 둬 끝까지 스크롤해도 대응이 맞는다.
					className="h-full min-w-0 flex-1 overflow-y-auto"
					inert={(isInspectorOpen || (Boolean(translationSource) && isSourcePaneOpen)) && isNarrowScreen}
				>
					<CmsEditor
						content={form.mdx}
						titleField={
							<>
								{languageTabs}
								{titleInput}
							</>
						}
						toolbarEnd={
							<TemplateMenu currentMdx={form.mdx} disabled={isReadOnly} onApply={(mdx) => setForm({ mdx })} />
						}
						toolbarAside={
							<span className="flex items-center gap-1">
								{extensions.toolbar}
								{sourcePaneToggle}
								{sourceModeToggle}
							</span>
						}
						sourceView={editorMode === "source" ? sourceEditor : undefined}
						editable={!isReadOnly}
						onChange={(mdx) => setForm({ mdx })}
						blockActions={extensions.blockActions.length > 0 ? extensions.blockActions : undefined}
						selectionActions={extensions.selectionActions}
						insertActions={extensions.insertActions}
						onEditor={extensions.onEditor}
						onCompositionStart={() => autosave.setComposing(true)}
						onCompositionEnd={() => autosave.setComposing(false)}
					/>
					{extensions.overlay}
				</div>

				{isInspectorOpen && (
					// 좁은 화면은 본문 위에 덮고, 넓은 화면은 옆에 고정 폭으로 둔다.
					<div
						className={cn(
							"absolute inset-y-0 right-0 z-20 max-w-full shadow-lg lg:static lg:z-auto lg:shrink-0 lg:shadow-none",
							SIDE_PANEL_WIDTH,
						)}
					>
						<InspectorPanel
							collection={collection}
							form={form}
							disabled={isReadOnly}
							publishIssues={publishIssues}
							entry={entry}
							incomingReferences={incoming.items}
							isLoadingIncomingReferences={incoming.loading}
							onRefreshIncomingReferences={() => {
								if (entry) void refreshIncoming(entry.id);
							}}
							onSlugChange={(slug) => {
								setIsSlugTouched(true);
								setForm({ slug });
							}}
							onRegenerateSlug={() => {
								setIsSlugTouched(false);
								setForm({ slug: isCollection(collection) ? slugFromValues(collection, form) : "" });
							}}
							onChange={(patch) => setForm(withAutoSlug(patch))}
							onClose={() => setIsInspectorOpen(false)}
							focusPath={pendingFieldPath !== "title-canvas" ? pendingFieldPath : null}
							onFocused={() => setPendingFieldPath(null)}
						/>
					</div>
				)}
			</div>

			<RecoveryDialog
				recovery={recovery}
				onClose={() => setRecovery(null)}
				onKeepServer={async (current) => {
					await deleteLocalBackup(current.backup.key);
					setRecovery(null);
				}}
				onRestore={(current) => applyRecovered({ ...EMPTY_FORM, ...current.backup.snapshot })}
			/>
			<ConflictDialog
				conflict={conflict}
				onClose={() => setConflict(null)}
				onReload={() => window.location.reload()}
				onOverwrite={(serverVersion) => {
					setConflict(null);
					void autosave.overwriteWithLocal(serverVersion);
				}}
			/>
			<ScheduleDialog
				open={scheduleOpen}
				onOpenChange={setScheduleOpen}
				runnerConfigured={schedule?.runnerConfigured}
				submitting={busy === "schedule"}
				error={scheduleError}
				onSubmit={(dateTime) => void handleSchedule(dateTime)}
			/>

			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
			{translationSource && (
				<SourceChangeDialog
					open={isSourceCompareOpen}
					onOpenChange={setIsSourceCompareOpen}
					before={confirmedSource}
					after={translationSource.mdx}
				/>
			)}
		</div>
	);
}

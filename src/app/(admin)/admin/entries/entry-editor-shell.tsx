"use client";

import {
	Archive,
	CalendarClock,
	ChevronLeft,
	CodeXml,
	Copy,
	Eye,
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
import type { IncomingReferenceItem } from "@/cms/adapters/postgres/content-store";
import { isRecordCollection } from "@/cms/core/collections";
import { autoSummary } from "@/cms/core/plain-text";
import { slugify } from "@/cms/core/slug";
import { CmsEditor } from "@/cms/editor/tiptap-editor";
import { analyze } from "@/cms/mdx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatSeoulDateTimeInput, parseSeoulDateTimeInput } from "@/libs/contents/published-at";
import { cn } from "@/utils/cn";
import { CmsApiError, cmsFetch, errorText } from "../admin-api";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { describeEntryStatus } from "../shared/entry-status";
import {
	EMPTY_FORM,
	type EntryData,
	type EntryForm,
	formFingerprint,
	formFromEntry,
	formText,
	isTranslationEntry,
	stringifyTranslation,
	TRANSLATION_FORM_KEY,
	translationStateFromForm,
} from "./entry-form";
import { InspectorPanel } from "./inspector-panel";
import { LanguageTabs } from "./language-tabs";
import { backupKey, deleteLocalBackup, getLocalBackup, type LocalBackupRecord } from "./local-backup";
import { SourceChangeDialog } from "./source-change-dialog";
import { SourcePane } from "./source-pane";
import { useSourceSync } from "./source-sync";
import { SAVE_STATUS_LABELS, useEntryAutosave } from "./use-entry-autosave";

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

type Recovery =
	| { kind: "restore"; backup: LocalBackupRecord<EntryForm> }
	| { kind: "conflict"; backup: LocalBackupRecord<EntryForm>; server: EntryData };

type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";

const formatSeoul = (value: string | null | undefined) => formatSeoulDateTimeInput(value ?? null).replace("T", " ");

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
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					href && !disabled ? (
						<a
							href={href}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={label}
							className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), className)}
						>
							{icon}
						</a>
					) : (
						<Button
							type="button"
							size="icon-sm"
							variant="ghost"
							aria-label={label}
							disabled={disabled}
							className={className}
							onClick={onClick}
						>
							{icon}
						</Button>
					)
				}
			/>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
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
export function EntryEditorShell({
	mode,
	initialEntryId,
	collection: propCollection = "post",
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
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionFeedback, setActionFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
	const [publishIssues, setPublishIssues] = useState<CmsIssue[]>([]);
	const [pendingBodyPosition, setPendingBodyPosition] = useState<CmsIssue["position"]>();
	const [pendingFieldPath, setPendingFieldPath] = useState<string | null>(null);
	const [recovery, setRecovery] = useState<Recovery | null>(null);
	const [conflict, setConflict] = useState<{ server: EntryData; local: EntryForm } | null>(null);
	const [scheduleOpen, setScheduleOpen] = useState(false);
	const [scheduleInput, setScheduleInput] = useState("");
	const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
	const [templates, setTemplates] = useState<{ id: string; name: string; mdx: string }[] | null>(null);
	const [pendingTemplateMdx, setPendingTemplateMdx] = useState<string | null>(null);
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

	useSourceSync({
		enabled: Boolean(entry && isTranslationEntry(entry) && typeof entry.source?.mdx === "string") && isSourcePaneOpen,
		syncScroll: editorMode === "visual",
		editorRef: editorScrollRef,
		paneRef: sourcePaneRef,
	});

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
					// 복구본 이후 서버도 바뀌었다. 덮어쓰지 않고 양쪽을 보여 준다.
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

	const handleTitleChange = (title: string) => setForm(isSlugTouched ? { title } : { title, slug: slugify(title) });

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

	/** 명시적 발행만 현재 입력을 저장한다. 다른 작업은 미저장 입력이 있으면 먼저 저장하도록 안내한다. */
	const ensureSaved = async (purpose: string, saveChanges = false) => {
		if (autosave.status === "conflict") {
			setActionFeedback({ type: "error", message: `편집 충돌을 해결한 후 ${purpose}할 수 있습니다.` });
			return null;
		}
		if (saveChanges && !(await autosave.flush())) {
			setActionFeedback({
				type: "error",
				message: `변경사항이 서버에 저장되지 않아 ${purpose}하지 않았습니다. ${autosave.lastError ?? "저장 상태를 확인하세요."}`,
			});
			return null;
		}
		if (!saveChanges && autosave.hasPendingChanges()) {
			setActionFeedback({ type: "error", message: `변경사항을 먼저 저장한 후 ${purpose}하세요.` });
			return null;
		}
		const id = autosave.getEntryId();
		if (!id) setActionFeedback({ type: "error", message: `먼저 저장한 후 ${purpose}할 수 있습니다.` });
		return id;
	};

	const handleSaveNow = async () => {
		if (isReadOnly) return;
		if (await autosave.flush()) toast.success("저장했습니다.");
	};

	const handlePublish = async () => {
		if (isSubmitting || isReadOnly) return;
		setPublishIssues([]);
		setActionFeedback(null);
		// §5.6: 게시글 요약이 비었으면 본문에서 만들어 보여 준다. 만들 텍스트가 없으면 직접 입력해야 한다.
		if (collection === "post" && !formText(form, "summary").trim()) {
			const generated = autoSummary(form.mdx);
			if (!generated) {
				setPublishIssues([{ code: "missing_summary", message: "요약을 입력하세요.", path: "summary" }]);
				setActionFeedback({ type: "error", message: "요약을 만들 본문이 없습니다. 요약을 직접 입력하세요." });
				return;
			}
			setForm({ summary: generated });
			toast.message("본문에서 요약을 만들었습니다. 속성 패널에서 고칠 수 있습니다.");
		}
		if (formText(form, "publishedAt")) {
			const publishedAt = parseSeoulDateTimeInput(formText(form, "publishedAt"));
			if (publishedAt && Date.parse(publishedAt) > Date.now()) {
				setActionFeedback({
					type: "error",
					message: "미래 시각은 발행일로 지정할 수 없습니다. 예약 기능을 사용하세요.",
				});
				return;
			}
		}
		// 막지는 않는다. 확인하지 않은 원문 변경이 있는 채로 나가는 것만 알린다.
		if (sourceChanged) toast.warning("확인하지 않은 원문 변경이 있습니다.");
		setIsSubmitting(true);
		try {
			const id = await ensureSaved("발행", true);
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
				setActionFeedback({ type: "error", message: "발행할 수 없습니다. 아래 문제를 수정하세요." });
				return;
			}
			setActionFeedback({ type: "error", message: errorText(error, "발행하지 못했습니다.") });
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSchedule = async () => {
		const scheduledAt = parseSeoulDateTimeInput(scheduleInput);
		if (!scheduledAt || isSubmitting) {
			setActionFeedback({ type: "error", message: "예약 일시(서울 시간)를 확인하세요." });
			return;
		}
		if (Date.parse(scheduledAt) <= Date.now()) {
			setActionFeedback({ type: "error", message: "예약은 미래 시각만 지정할 수 있습니다." });
			return;
		}
		setIsSubmitting(true);
		try {
			const id = await ensureSaved("예약");
			if (!id) return;
			await cmsFetch(`/api/cms/v1/entries/${id}/schedule`, {
				method: "POST",
				json: { expectedVersion: autosave.getVersion(), scheduledAt },
				fallback: "예약하지 못했습니다.",
			});
			setScheduleOpen(false);
			await loadEntry(id);
			toast.success(`${formatSeoul(scheduledAt)}에 발행하도록 예약했습니다.`);
		} catch (error) {
			if (error instanceof CmsApiError && error.issues.length > 0) {
				setPublishIssues(error.issues);
				setScheduleOpen(false);
			}
			setActionFeedback({ type: "error", message: errorText(error, "예약하지 못했습니다.") });
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCancelSchedule = async () => {
		const pending = entry?.schedule?.pending;
		if (!entry || !pending) return;
		try {
			await cmsFetch(`/api/cms/v1/entries/${entry.id}/schedule?scheduleId=${pending.id}`, { method: "DELETE" });
			await loadEntry(entry.id);
			toast.success("예약을 해제했습니다. 이제 편집할 수 있습니다.");
		} catch (error) {
			setActionFeedback({ type: "error", message: errorText(error, "예약을 해제하지 못했습니다.") });
		}
	};

	/** 보관·보관 해제·휴지통·복원(§5.3). */
	const runLifecycle = async (action: LifecycleAction, successMessage: string) => {
		if (!entry) return;
		try {
			if (action !== "restore" && autosave.hasPendingChanges()) {
				setActionFeedback({ type: "error", message: "변경사항을 먼저 저장한 후 진행하세요." });
				return;
			}
			await cmsFetch(`/api/cms/v1/entries/${entry.id}/${action}`, {
				method: "POST",
				json: { expectedVersion: autosave.getVersion() },
			});
			// 번역본을 휴지통으로 보내면 원문 편집 화면으로 돌아간다.
			if (action === "trash" && isTranslationEntry(entry) && entry.translationGroupId) {
				toast.success(successMessage);
				router.push(`/admin/entries/${entry.translationGroupId}/edit`);
				return;
			}
			await loadEntry(entry.id);
			toast.success(successMessage);
		} catch (error) {
			setActionFeedback({ type: "error", message: errorText(error, "상태를 바꾸지 못했습니다.") });
		}
	};

	/** 공개 상태가 바뀌는 전환은 확인을 받는다. 공개본에서 이 글을 쓰는 곳이 있으면 함께 알린다(§6.1). */
	const confirmLifecycle = (action: LifecycleAction) => {
		const publishedUsers = incoming.items.filter((item) => item.state === "published");
		const usageNote =
			publishedUsers.length > 0
				? ` 이 글을 공개본에서 참조하는 콘텐츠가 ${publishedUsers.length}개 있습니다(속성 패널의 사용처).`
				: "";
		// 원문을 옮기면 같은 묶음의 번역본도 함께 옮겨진다.
		const otherLocales =
			entry && !isTranslationEntry(entry)
				? (entry.translations ?? [])
						.filter((member) => member.id !== entry.id && member.status !== "trashed")
						.map((member) => member.locale.toUpperCase())
				: [];
		const hasGroup = otherLocales.length > 0;
		const requests: Record<LifecycleAction, ConfirmRequest> = {
			archive: {
				title: "보관",
				description: `공개가 종료되고 대기 중인 예약이 취소됩니다.${usageNote}${hasGroup ? " 번역본도 함께 보관합니다." : ""}`,
				confirmLabel: "보관",
				onConfirm: () => runLifecycle("archive", "보관했습니다."),
			},
			unarchive: {
				title: "보관 해제",
				description: "초안으로 돌아갑니다. 자동으로 다시 공개하지 않습니다.",
				confirmLabel: "보관 해제",
				onConfirm: () => runLifecycle("unarchive", "보관을 해제했습니다."),
			},
			trash: {
				title: "휴지통으로 이동",
				description: `공개가 종료되고 대기 중인 예약이 취소됩니다.${usageNote}${hasGroup ? ` 번역본(${otherLocales.join("·")})도 함께 휴지통으로 이동합니다.` : ""}`,
				confirmLabel: "휴지통으로 이동",
				destructive: true,
				onConfirm: () => runLifecycle("trash", "휴지통으로 옮겼습니다."),
			},
			restore: {
				title: "휴지통에서 복원",
				description: "초안으로 복원합니다. 다시 공개하려면 발행하세요.",
				confirmLabel: "복원",
				onConfirm: () => runLifecycle("restore", "복원했습니다."),
			},
		};
		setConfirm(requests[action]);
	};

	const confirmPermanentDelete = () => {
		if (!entry) return;
		setConfirm({
			title: "영구 삭제",
			description: "되돌릴 수 없습니다. 공개된 적 있는 주소는 다른 글이 다시 쓸 수 없도록 기록만 남습니다.",
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
					setActionFeedback({ type: "error", message: errorText(error, "삭제하지 못했습니다.") });
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
			setActionFeedback({ type: "error", message: errorText(error, "복제하지 못했습니다.") });
		}
	};

	const openTemplates = async (open: boolean) => {
		setTemplateMenuOpen(open);
		if (!open || templates) return;
		try {
			const data = await cmsFetch<{ items: { id: string; name: string; mdx: string }[] }>("/api/cms/v1/templates");
			setTemplates(data.items);
		} catch {
			setTemplates([]);
		}
	};

	const applyTemplate = (mdx: string) => {
		setForm({ mdx });
		setTemplateMenuOpen(false);
		setPendingTemplateMdx(null);
	};

	// 번역본은 원문과 slug를 같이 쓸 수 있어 언어를 함께 넘긴다(v2 B4).
	const previewHref = entry?.workingSlug
		? `/preview/${collection === "memo" ? "memos" : "posts"}/${encodeURIComponent(entry.workingSlug)}${
				entry.locale && entry.locale !== "ko" ? `?locale=${entry.locale}` : ""
			}`
		: null;

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
				<span className="sr-only">문서를 불러오는 중...</span>
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
	/** 번역본이면 원문 본문·언어·제목. 원문 창과 제목 안내가 쓴다(v3). */
	const translationSource =
		entry && isTranslationEntry(entry) && typeof entry.source?.mdx === "string"
			? {
					mdx: entry.source.mdx,
					locale: entry.source.locale,
					title: typeof entry.source.metadata.title === "string" ? entry.source.metadata.title : "",
				}
			: null;
	const translationForm = form[TRANSLATION_FORM_KEY];
	/** 번역자가 마지막으로 확인한 원문. 지금 원문과 다르면 "원문이 바뀌었어요"를 보인다. */
	const confirmedSource = translationStateFromForm(translationForm).baseSource;
	const sourceChanged =
		translationSource !== null && typeof translationForm === "string" && translationSource.mdx !== confirmedSource;
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
				글 제목 (본문 위)
			</FieldLabel>
			<Input
				id="cms-title-canvas"
				value={form.title}
				readOnly={isReadOnly}
				aria-invalid={Boolean(titleIssue) || undefined}
				aria-describedby={titleIssue ? "cms-title-error" : undefined}
				onChange={(event) => handleTitleChange(event.target.value)}
				placeholder={translationSource?.title || "제목 없는 글"}
				className="h-auto w-full rounded-none border-0 bg-transparent px-6 py-1 font-semibold text-[34px] leading-tight tracking-tight shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0 md:text-[34px] dark:bg-transparent"
			/>
			{titleIssue && (
				<p id="cms-title-error" className="text-destructive text-sm">
					{cmsIssueMessage(titleIssue)}
				</p>
			)}
		</>
	);
	const templateMenu = (
		<DropdownMenu open={templateMenuOpen} onOpenChange={(open) => void openTemplates(open)}>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						size="icon-sm"
						variant="ghost"
						aria-label="템플릿 메뉴"
						title="템플릿"
						disabled={isReadOnly}
					/>
				}
			>
				<MoreHorizontal aria-hidden className="size-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
				<DropdownMenuGroup>
					<DropdownMenuLabel>템플릿</DropdownMenuLabel>
					{templates === null ? (
						<DropdownMenuItem disabled>불러오는 중...</DropdownMenuItem>
					) : templates.length === 0 ? (
						<DropdownMenuItem disabled>등록된 템플릿이 없습니다.</DropdownMenuItem>
					) : (
						templates.map((template) => (
							<DropdownMenuItem
								key={template.id}
								onClick={() => (form.mdx.trim() ? setPendingTemplateMdx(template.mdx) : applyTemplate(template.mdx))}
							>
								<span className="truncate">{template.name}</span>
							</DropdownMenuItem>
						))
					)}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => window.open("/admin/templates", "_blank", "noopener")}>
					템플릿 관리
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	const sourcePaneToggle = translationSource && (
		<Toggle
			size="sm"
			aria-label="원문"
			pressed={isSourcePaneOpen}
			onPressedChange={toggleSourcePane}
			className="gap-1.5 text-muted-foreground aria-pressed:text-foreground"
		>
			<PanelLeft aria-hidden className="size-4" />
			원문
		</Toggle>
	);
	const sourceModeToggle = (
		<Tooltip>
			<TooltipTrigger
				render={
					<Toggle
						size="sm"
						aria-label="MDX 원문"
						pressed={editorMode === "source"}
						// 해석할 수 없는 본문은 시각 모드로 돌아가지 못한다.
						disabled={editorMode === "source" && !canUseVisual}
						onPressedChange={(pressed) => setEditorMode(pressed ? "source" : "visual")}
						className="gap-1.5 text-muted-foreground aria-pressed:text-foreground"
					/>
				}
			>
				<CodeXml aria-hidden className="size-4" />
				MDX
			</TooltipTrigger>
			<TooltipContent side="bottom">MDX 원문</TooltipContent>
		</Tooltip>
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
				placeholder="MDX 원문을 작성하세요..."
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
					<output
						aria-live="polite"
						aria-label={`${SAVE_STATUS_LABELS[autosave.status]}${!autosave.backupAvailable ? " · 브라우저 복구 불가" : ""}`}
						className="mr-1 flex items-center gap-1.5 text-muted-foreground text-xs"
					>
						<span
							aria-hidden
							className={cn(
								"size-2 rounded-full",
								autosave.status === "saved"
									? "bg-emerald-500"
									: autosave.status === "saving"
										? "animate-pulse bg-amber-500"
										: ["conflict", "failed", "session-expired"].includes(autosave.status)
											? "bg-destructive"
											: "bg-muted-foreground/50",
							)}
						/>
						<span className="hidden lg:inline">
							{SAVE_STATUS_LABELS[autosave.status]}
							{!autosave.backupAvailable && " · 브라우저 복구 불가"}
						</span>
					</output>
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
							label={autosave.hasPendingChanges() ? "저장 후 미리보기" : "미리보기"}
							icon={Eye}
							href={previewHref}
							disabled={autosave.hasPendingChanges()}
						/>
					)}
					{!isReadOnly && entry?.status !== "archived" && (
						<ToolbarAction
							label="발행 예약"
							icon={CalendarClock}
							disabled={isSubmitting}
							onClick={() => {
								setScheduleInput("");
								setScheduleOpen(true);
							}}
						/>
					)}
					{scheduleLocked ? (
						<Button type="button" size="sm" className="ml-1" onClick={() => void handleCancelSchedule()}>
							예약 해제
						</Button>
					) : isTrashed ? (
						<Button type="button" size="sm" className="ml-1" onClick={() => confirmLifecycle("restore")}>
							복원
						</Button>
					) : entry?.status === "archived" ? (
						<Button type="button" size="sm" className="ml-1" onClick={() => confirmLifecycle("unarchive")}>
							보관 해제
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
							발행
						</Button>
					)}
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									type="button"
									size="icon-sm"
									variant="ghost"
									aria-label="속성"
									aria-pressed={isInspectorOpen}
									className="size-8 text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
									onClick={() => setIsInspectorOpen((open) => !open)}
								>
									<PanelRight aria-hidden className="size-4" />
								</Button>
							}
						/>
						<TooltipContent side="bottom">{isInspectorOpen ? "속성 닫기" : "속성 열기"}</TooltipContent>
					</Tooltip>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button type="button" size="icon-sm" variant="ghost" aria-label="더보기" title="더보기" />}
						>
							<MoreHorizontal aria-hidden className="size-4" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuItem disabled={isReadOnly} onClick={() => void handleSaveNow()}>
								<Save aria-hidden />
								저장
								<DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
							</DropdownMenuItem>
							{entry && !isTrashed && (
								<>
									<DropdownMenuSeparator />
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
									<DropdownMenuSeparator />
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
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
								<SunMoon aria-hidden />
								테마 전환
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			{schedule?.pending && (
				<section
					aria-label="예약"
					className="flex flex-wrap items-center gap-2 border-b bg-primary/10 px-4 py-2 text-sm"
				>
					<span>
						{formatSeoul(schedule.pending.scheduledAt)} 발행 예약됨 — 예약 중에는 본문과 속성을 편집할 수 없습니다.
						{Date.parse(schedule.pending.scheduledAt) <= Date.now() && " 예정 시각이 지나 실행 대기 중입니다."}
						{!schedule.runnerConfigured && " 외부 실행기 연결 필요: 연결되지 않으면 자동으로 발행되지 않습니다."}
					</span>
				</section>
			)}
			{!schedule?.pending && schedule?.last?.status === "failed" && (
				<p role="alert" className="border-b bg-destructive/10 px-4 py-2 text-destructive text-sm">
					{formatSeoul(schedule.last.scheduledAt)} 예약 발행이 실패해 공개본을 그대로 유지했습니다 (
					{schedule.last.failureCode}).
					{schedule.last.failureDetail ? ` ${schedule.last.failureDetail.slice(0, 200)}` : ""}
				</p>
			)}
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
			{actionFeedback && (
				<p
					role={actionFeedback.type === "error" ? "alert" : "status"}
					className={cn(
						"whitespace-pre-wrap border-b px-4 py-2 text-sm",
						actionFeedback.type === "error" && "text-destructive",
					)}
				>
					{actionFeedback.message}
				</p>
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
					<span className="flex-1 font-medium text-amber-700 dark:text-amber-400">원문이 바뀌었어요</span>
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
						toolbarEnd={templateMenu}
						toolbarAside={
							<span className="flex items-center gap-1">
								{sourcePaneToggle}
								{sourceModeToggle}
							</span>
						}
						sourceView={editorMode === "source" ? sourceEditor : undefined}
						editable={!isReadOnly}
						onChange={(mdx) => setForm({ mdx })}
						onCompositionStart={() => autosave.setComposing(true)}
						onCompositionEnd={() => autosave.setComposing(false)}
					/>
				</div>

				{isInspectorOpen && (
					// 좁은 화면은 본문 위에 덮고, 넓은 화면은 옆에 고정 폭으로 둔다.
					<div className="absolute inset-y-0 right-0 z-20 w-full shadow-lg sm:w-[21rem] lg:static lg:z-auto lg:shrink-0 lg:shadow-none">
						<InspectorPanel
							collection={collection}
							form={form}
							disabled={isReadOnly}
							publishIssues={publishIssues}
							entry={entry}
							incomingReferences={incoming.items}
							isLoadingIncomingReferences={incoming.loading}
							incomingReferencesError={incoming.error}
							onRefreshIncomingReferences={() => {
								if (entry) void refreshIncoming(entry.id);
							}}
							onSlugChange={(slug) => {
								setIsSlugTouched(true);
								setForm({ slug });
							}}
							onRegenerateSlug={() => {
								setIsSlugTouched(false);
								setForm({ slug: slugify(form.title) });
							}}
							onChange={setForm}
							onClose={() => setIsInspectorOpen(false)}
							focusPath={pendingFieldPath !== "title-canvas" ? pendingFieldPath : null}
							onFocused={() => setPendingFieldPath(null)}
						/>
					</div>
				)}
			</div>

			<Dialog open={recovery !== null} onOpenChange={(open) => !open && setRecovery(null)}>
				<DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{recovery?.kind === "conflict"
								? "브라우저 복구본과 서버 내용이 모두 바뀌었습니다"
								: "브라우저 복구본 발견"}
						</DialogTitle>
						<DialogDescription>
							{recovery?.kind === "conflict"
								? "복구본을 만든 뒤 다른 곳에서 서버 내용이 바뀌었습니다. 덮어쓰지 않도록 양쪽을 확인하세요."
								: `서버에 저장되지 않은 입력이 있습니다 (${recovery ? new Date(recovery.backup.savedAt).toLocaleString("ko-KR") : ""}).`}
						</DialogDescription>
					</DialogHeader>
					{recovery?.kind === "conflict" && (
						<ComparePanes
							local={{ ...EMPTY_FORM, ...recovery.backup.snapshot }}
							server={formFromEntry(recovery.server)}
							serverVersion={recovery.server.version}
						/>
					)}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={async () => {
								if (recovery) await deleteLocalBackup(recovery.backup.key);
								setRecovery(null);
							}}
						>
							복구본 삭제
						</Button>
						{recovery?.kind === "restore" && (
							<Button type="button" onClick={() => applyRecovered({ ...EMPTY_FORM, ...recovery.backup.snapshot })}>
								복구본 불러오기
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
				<DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
					<DialogHeader>
						<DialogTitle>편집 충돌</DialogTitle>
						<DialogDescription>
							다른 탭이나 기기에서 먼저 저장했습니다. 내 입력은 브라우저에 남아 있습니다. 양쪽을 비교해 복사하거나
							하나를 고르세요.
						</DialogDescription>
					</DialogHeader>
					{conflict && (
						<ComparePanes
							local={conflict.local}
							server={formFromEntry(conflict.server)}
							serverVersion={conflict.server.version}
						/>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setConflict(null)}>
							닫기
						</Button>
						<Button type="button" variant="outline" onClick={() => window.location.reload()}>
							다시 불러오기
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={() => {
								if (!conflict) return;
								const version = conflict.server.version;
								setConflict(null);
								void autosave.overwriteWithLocal(version);
							}}
						>
							내 내용으로 덮어쓰기
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={pendingTemplateMdx !== null} onOpenChange={(open) => !open && setPendingTemplateMdx(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>템플릿 적용</DialogTitle>
						<DialogDescription>현재 본문이 선택한 템플릿으로 바뀝니다.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setPendingTemplateMdx(null)}>
							취소
						</Button>
						<Button type="button" onClick={() => pendingTemplateMdx !== null && applyTemplate(pendingTemplateMdx)}>
							템플릿 적용
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>발행 예약</DialogTitle>
						<DialogDescription>
							저장된 초안을 검증한 뒤 예약합니다. 예약 중에는 편집이 잠깁니다. 정해진 시각의 실행은 외부 실행기가
							맡습니다.
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor="schedule-date">예약 일시</FieldLabel>
						<Input
							id="schedule-date"
							type="datetime-local"
							value={scheduleInput}
							onChange={(event) => setScheduleInput(event.target.value)}
						/>
					</Field>
					{schedule && !schedule.runnerConfigured && (
						<p className="text-amber-700 text-xs dark:text-amber-400">
							외부 실행기 연결 필요: 연결 전에는 예약이 실행 대기로 남습니다.
						</p>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setScheduleOpen(false)}>
							취소
						</Button>
						<Button type="button" disabled={!scheduleInput || isSubmitting} onClick={() => void handleSchedule()}>
							예약 등록
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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

/** 충돌·복구 화면의 양쪽 비교(§5.1 "양쪽 내용을 확인·복사"). */
function ComparePanes({
	local,
	server,
	serverVersion,
}: {
	local: EntryForm;
	server: EntryForm;
	serverVersion: number;
}) {
	const pane = (label: string, value: EntryForm) => (
		<div className="space-y-2 rounded border p-3">
			<p className="font-semibold text-sm">{label}</p>
			<p className="text-xs">
				제목: {value.title || "(없음)"} · 주소: {value.slug || "(없음)"}
			</p>
			<Button
				type="button"
				variant="link"
				size="xs"
				className="px-0"
				onClick={() => void navigator.clipboard.writeText(value.mdx)}
			>
				본문 복사
			</Button>
			<pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">{value.mdx}</pre>
		</div>
	);
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{pane("내 입력(브라우저)", local)}
			{pane(`서버 최신본 (v${serverVersion})`, server)}
		</div>
	);
}

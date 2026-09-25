"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { EditorToggle } from "@/cms/editor/editor-toggle";
import { CmsEditor } from "@/cms/editor/tiptap-editor";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { type CmsIssue, cmsApiErrorMessage, cmsApiIssues, cmsIssueMessage } from "../api-error-message";
import { deleteLocalBackup, getLocalBackup, type LocalBackupRecord, saveLocalBackup } from "./[id]/edit/indexed-db";
import { InspectorPanel } from "./inspector-panel";
import { slugify } from "./slugify";

type SaveStatus = "저장됨" | "저장 중" | "미저장 변경" | "오류" | "오프라인" | "충돌";

interface EntryData {
	id: string;
	collection: string;
	status: "draft" | "published" | "archived" | "trashed";
	version: number;
	workingSlug: string | null;
	publishedSlug: string | null;
	working: {
		metadata: Record<string, any>;
		mdx: string;
	};
}

interface EntryEditorShellProps {
	mode: "new" | "edit";
	initialEntryId?: string;
	collection?: string;
}

export function EntryEditorShell({ mode, initialEntryId, collection: propCollection = "post" }: EntryEditorShellProps) {
	const [entry, setEntry] = useState<EntryData | null>(null);
	const [collection, setCollection] = useState(propCollection);
	const [isLoading, setIsLoading] = useState(mode === "edit");

	useEffect(() => {
		setCollection(propCollection);
	}, [propCollection]);

	// Metadata Form State
	const [title, setTitle] = useState("");
	const [slug, setSlug] = useState("");
	const [isSlugTouched, setIsSlugTouched] = useState(false);
	const [publishDate, setPublishDate] = useState("");
	const [description, setDescription] = useState("");
	const [categoryId, setCategoryId] = useState<string | null>(null);
	const [tagIds, setTagIds] = useState<string[]>([]);
	// SEO 메타(M7-FE-2). performSave의 의존성 배열에 값이 없어 ref로 최신값을 넘긴다.
	const [seoTitle, setSeoTitle] = useState("");
	const [seoDescription, setSeoDescription] = useState("");
	const [canonicalUrl, setCanonicalUrl] = useState("");
	const [isInspectorOpen, setIsInspectorOpen] = useState(true);
	const [isNarrowScreen, setIsNarrowScreen] = useState(false);
	useEffect(() => {
		const media = window.matchMedia?.("(max-width: 639px)");
		if (!media) return;
		setIsNarrowScreen(media.matches);
		if (media.matches) setIsInspectorOpen(false);
		const update = () => setIsNarrowScreen(media.matches);
		media.addEventListener?.("change", update);
		return () => media.removeEventListener?.("change", update);
	}, []);

	const categoryIdRef = useRef<string | null>(null);
	const tagIdsRef = useRef<string[]>([]);
	const seoTitleRef = useRef("");
	const seoDescriptionRef = useRef("");
	const canonicalUrlRef = useRef("");

	// Editor State
	const [mdx, setMdx] = useState("");
	const [editorMode, setEditorMode] = useState<"visual" | "source">("visual");
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("저장됨");

	// Modals
	const [recoveryPrompt, setRecoveryPrompt] = useState<LocalBackupRecord | null>(null);
	const [conflictData, setConflictData] = useState<{
		server: EntryData;
		local: { title: string; slug: string; mdx: string };
	} | null>(null);
	const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
	const [scheduleInputDate, setScheduleInputDate] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [pendingTemplateMdx, setPendingTemplateMdx] = useState<string | null>(null);
	const [actionFeedback, setActionFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
	const [publishIssues, setPublishIssues] = useState<CmsIssue[]>([]);
	const [pendingBodyPosition, setPendingBodyPosition] = useState<CmsIssue["position"]>();
	const [pendingFieldPath, setPendingFieldPath] = useState<string | null>(null);

	// Template Menu State
	const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
	const [availableTemplates, setAvailableTemplates] = useState<{ id: string; name: string; mdx: string }[]>([]);
	const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);

	const handleOpenTemplateMenu = async () => {
		if (templateMenuOpen) {
			setTemplateMenuOpen(false);
			return;
		}
		setTemplateMenuOpen(true);
		setIsTemplatesLoading(true);
		try {
			const res = await fetch(`/api/cms/v1/templates?forCollection=${collection}`);
			if (res.ok) {
				const data = await res.json();
				setAvailableTemplates(data.items || []);
			}
		} catch (err) {
			console.error("Failed to load templates", err);
		} finally {
			setIsTemplatesLoading(false);
		}
	};

	const applyTemplate = (templateMdx: string) => {
		setMdx(templateMdx);
		mdxRef.current = templateMdx;
		triggerSave({ mdx: templateMdx });
		setTemplateMenuOpen(false);
		setPendingTemplateMdx(null);
	};

	const handleApplyTemplate = (templateMdx: string) => {
		if (mdx.trim().length > 0) {
			setPendingTemplateMdx(templateMdx);
			return;
		}
		applyTemplate(templateMdx);
	};

	// Autosave Refs
	const entryIdRef = useRef<string | null>(initialEntryId || null);
	const currentVersionRef = useRef(1);
	const serverFingerprintRef = useRef("");
	const changeSeqRef = useRef(0);
	const lastAckSeqRef = useRef(0);
	const inflightSeqRef = useRef<number | null>(null);
	const isComposingRef = useRef(false);
	const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
	const maxWaitTimerRef = useRef<NodeJS.Timeout | null>(null);
	useEffect(
		() => () => {
			if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
			if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
		},
		[],
	);

	const titleRef = useRef(title);
	titleRef.current = title;
	const slugRef = useRef(slug);
	slugRef.current = slug;
	const mdxRef = useRef(mdx);
	mdxRef.current = mdx;
	const isSlugTouchedRef = useRef(isSlugTouched);
	isSlugTouchedRef.current = isSlugTouched;

	const editorToggleRef = useRef<EditorToggle | null>(null);

	const computeFingerprint = (t: string, s: string, m: string) => `${t}:::${s}:::${m}`;

	// Fetch existing entry if edit mode
	// biome-ignore lint/correctness/useExhaustiveDependencies: fingerprint helper is pure and stable
	useEffect(() => {
		if (mode !== "edit" || !initialEntryId) return;
		let isMounted = true;
		async function load() {
			try {
				const res = await fetch(`/api/cms/v1/entries/${initialEntryId}`);
				if (!res.ok) throw new Error("문서를 불러올 수 없습니다.");
				const data: EntryData = await res.json();
				if (!isMounted) return;

				setEntry(data);
				if (data.collection) {
					setCollection(data.collection);
				}
				const initialTitle = data.working.metadata?.title || "";
				const initialSlug = data.workingSlug || "";
				const initialMdx = data.working.mdx || "";
				serverFingerprintRef.current = computeFingerprint(initialTitle, initialSlug, initialMdx);

				setTitle(initialTitle);
				setSlug(initialSlug);
				setIsSlugTouched(true);
				setMdx(initialMdx);
				currentVersionRef.current = data.version;

				setDescription(data.working.metadata?.summary || "");
				const loadedSeoTitle = data.working.metadata?.seoTitle || "";
				const loadedSeoDescription = data.working.metadata?.seoDescription || "";
				const loadedCanonicalUrl = data.working.metadata?.canonicalUrl || "";
				setSeoTitle(loadedSeoTitle);
				seoTitleRef.current = loadedSeoTitle;
				setSeoDescription(loadedSeoDescription);
				seoDescriptionRef.current = loadedSeoDescription;
				setCanonicalUrl(loadedCanonicalUrl);
				canonicalUrlRef.current = loadedCanonicalUrl;
				if (data.working.metadata?.categoryId) {
					setCategoryId(data.working.metadata.categoryId);
					categoryIdRef.current = data.working.metadata.categoryId;
				}
				if (Array.isArray(data.working.metadata?.tagIds)) {
					const ids = data.working.metadata.tagIds.filter((t: any) => typeof t === "string");
					setTagIds(ids);
					tagIdsRef.current = ids;
				}

				editorToggleRef.current = new EditorToggle(initialMdx);

				// IndexedDB check
				const backup = await getLocalBackup(`admin:${initialEntryId}`);
				if (backup) {
					const fp = computeFingerprint(initialTitle, initialSlug, initialMdx);
					if (backup.baseFingerprint === fp && backup.localFingerprint !== fp) {
						setRecoveryPrompt(backup);
					} else if (backup.localFingerprint === fp) {
						await deleteLocalBackup(`admin:${initialEntryId}`);
					}
				}
			} catch (err: any) {
				console.error(err);
			} finally {
				if (isMounted) setIsLoading(false);
			}
		}
		load();
		return () => {
			isMounted = false;
		};
	}, [mode, initialEntryId]);

	useEffect(() => {
		if (mode !== "new") return;
		let active = true;
		getLocalBackup(`admin:new:${collection}`).then((backup) => {
			if (active && backup && backup.localFingerprint !== backup.baseFingerprint) setRecoveryPrompt(backup);
		});
		return () => {
			active = false;
		};
	}, [mode, collection]);

	// Inflight Worker: handles either initial POST or subsequent PATCH
	// biome-ignore lint/correctness/useExhaustiveDependencies: autosave worker and scheduler call each other through refs
	const performSave = useCallback(async () => {
		if (inflightSeqRef.current !== null) return;
		if (changeSeqRef.current <= lastAckSeqRef.current) {
			setSaveStatus("저장됨");
			return;
		}
		if (isComposingRef.current) return;

		const targetSeq = changeSeqRef.current;
		inflightSeqRef.current = targetSeq;
		setSaveStatus("저장 중");

		const currentTitle = titleRef.current;
		const currentSlug = slugRef.current;
		const currentMdx = mdxRef.current;

		const currentEntryId = entryIdRef.current;

		try {
			const metadataToSave: Record<string, any> = {
				...(entry?.working.metadata || {}),
				title: currentTitle,
			};
			if (description.trim()) metadataToSave.summary = description.trim();
			if (categoryIdRef.current) metadataToSave.categoryId = categoryIdRef.current;
			else delete metadataToSave.categoryId;
			if (tagIdsRef.current.length > 0) metadataToSave.tagIds = tagIdsRef.current;
			else delete metadataToSave.tagIds;
			// SEO 메타는 비우면 키를 지워 head가 title/summary 폴백으로 되돌아가게 한다.
			if (seoTitleRef.current.trim()) metadataToSave.seoTitle = seoTitleRef.current.trim();
			else delete metadataToSave.seoTitle;
			if (seoDescriptionRef.current.trim()) metadataToSave.seoDescription = seoDescriptionRef.current.trim();
			else delete metadataToSave.seoDescription;
			if (canonicalUrlRef.current.trim()) metadataToSave.canonicalUrl = canonicalUrlRef.current.trim();
			else delete metadataToSave.canonicalUrl;

			if (!currentEntryId) {
				// Initial lazy creation via POST
				const res = await fetch("/api/cms/v1/entries", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						collection,
						slug: currentSlug || null,
						metadata: metadataToSave,
						mdx: currentMdx,
					}),
				});

				if (res.ok) {
					const created: EntryData = await res.json();
					entryIdRef.current = created.id;
					setEntry(created);
					currentVersionRef.current = created.version;
					serverFingerprintRef.current = computeFingerprint(currentTitle, currentSlug, currentMdx);
					lastAckSeqRef.current = targetSeq;
					inflightSeqRef.current = null;

					// Quietly promote URL without unmounting or triggering App Router remount
					window.history.replaceState({ ...window.history.state }, "", `/admin/entries/${created.id}/edit`);

					await deleteLocalBackup(`admin:new:${collection}`);

					if (changeSeqRef.current === targetSeq) {
						setSaveStatus("저장됨");
					} else {
						setSaveStatus("미저장 변경");
						triggerSave();
					}
				} else {
					inflightSeqRef.current = null;
					setSaveStatus("오류");
				}
			} else {
				// Standard PATCH update
				const res = await fetch(`/api/cms/v1/entries/${currentEntryId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						expectedVersion: currentVersionRef.current,
						slug: currentSlug || null,
						metadata: metadataToSave,
						mdx: currentMdx,
					}),
				});

				if (res.ok) {
					const updated = await res.json();
					currentVersionRef.current = updated.version;
					serverFingerprintRef.current = computeFingerprint(currentTitle, currentSlug, currentMdx);
					lastAckSeqRef.current = targetSeq;
					inflightSeqRef.current = null;

					if (changeSeqRef.current === targetSeq) {
						setSaveStatus("저장됨");
						await deleteLocalBackup(`admin:${currentEntryId}`);
					} else {
						setSaveStatus("미저장 변경");
						triggerSave();
					}
				} else if (res.status === 409) {
					inflightSeqRef.current = null;
					setSaveStatus("충돌");
					const freshRes = await fetch(`/api/cms/v1/entries/${currentEntryId}`);
					if (freshRes.ok) {
						const freshData = await freshRes.json();
						setConflictData({
							server: freshData,
							local: { title: currentTitle, slug: currentSlug, mdx: currentMdx },
						});
					}
				} else {
					inflightSeqRef.current = null;
					setSaveStatus("오류");
				}
			}
		} catch {
			inflightSeqRef.current = null;
			setSaveStatus("오프라인");
		}
	}, [collection, entry]);

	// Trigger Save (2s idle / 10s maxWait)
	// biome-ignore lint/correctness/useExhaustiveDependencies: fingerprint helper is pure and stable
	const triggerSave = useCallback(
		(override?: { title?: string; slug?: string; mdx?: string }) => {
			if (override?.title !== undefined) titleRef.current = override.title;
			if (override?.slug !== undefined) slugRef.current = override.slug;
			if (override?.mdx !== undefined) mdxRef.current = override.mdx;

			const currentTitle = titleRef.current;
			const currentSlug = slugRef.current;
			const currentMdx = mdxRef.current;

			setSaveStatus("미저장 변경");
			changeSeqRef.current += 1;

			const activeKey = entryIdRef.current ? `admin:${entryIdRef.current}` : `admin:new:${collection}`;
			saveLocalBackup({
				key: activeKey,
				entryId: entryIdRef.current || "new",
				baseVersion: currentVersionRef.current,
				baseFingerprint: serverFingerprintRef.current,
				localFingerprint: computeFingerprint(currentTitle, currentSlug, currentMdx),
				snapshot: { title: currentTitle, slug: currentSlug || null, metadata: {}, mdx: currentMdx },
				changeSeq: changeSeqRef.current,
				savedAt: Date.now(),
			});

			if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
			idleTimerRef.current = setTimeout(() => {
				if (maxWaitTimerRef.current) {
					clearTimeout(maxWaitTimerRef.current);
					maxWaitTimerRef.current = null;
				}
				performSave();
			}, 2000);

			if (!maxWaitTimerRef.current) {
				maxWaitTimerRef.current = setTimeout(() => {
					maxWaitTimerRef.current = null;
					performSave();
				}, 10000);
			}
		},
		[collection, performSave],
	);

	// Title / Slug Handlers
	const handleTitleChange = (newTitle: string) => {
		setTitle(newTitle);
		titleRef.current = newTitle;
		if (!isSlugTouchedRef.current) {
			const autoSlug = slugify(newTitle);
			setSlug(autoSlug);
			slugRef.current = autoSlug;
			triggerSave({ title: newTitle, slug: autoSlug });
		} else {
			triggerSave({ title: newTitle });
		}
	};

	const handleSlugChange = (newSlug: string) => {
		setIsSlugTouched(true);
		isSlugTouchedRef.current = true;
		setSlug(newSlug);
		slugRef.current = newSlug;
		triggerSave({ slug: newSlug });
	};

	const handleRegenerateSlug = () => {
		const autoSlug = slugify(titleRef.current);
		setIsSlugTouched(false);
		isSlugTouchedRef.current = false;
		setSlug(autoSlug);
		slugRef.current = autoSlug;
		triggerSave({ slug: autoSlug });
	};

	useEffect(() => {
		if (!pendingBodyPosition || editorMode !== "source") return;
		const textarea = document.getElementById("cms-mdx-source") as HTMLTextAreaElement | null;
		if (!textarea) return;
		const lines = mdx.split("\n");
		const offset = lines.slice(0, pendingBodyPosition.line - 1).reduce((sum, line) => sum + line.length + 1, 0);
		const index = Math.min(mdx.length, offset + pendingBodyPosition.column - 1);
		textarea.focus();
		textarea.setSelectionRange(index, index);
		setPendingBodyPosition(undefined);
	}, [pendingBodyPosition, editorMode, mdx]);

	useEffect(() => {
		if (!pendingFieldPath || !isInspectorOpen) return;
		const control = document.getElementById(`cms-${pendingFieldPath}`);
		if (control) {
			control.focus();
			setPendingFieldPath(null);
		}
	}, [pendingFieldPath, isInspectorOpen]);

	const focusIssue = (issue: CmsIssue) => {
		if (issue.position || issue.path === "mdx" || issue.path === "frontmatter") {
			if (isNarrowScreen) setIsInspectorOpen(false);
			setPendingBodyPosition(issue.position ?? { line: 1, column: 1 });
			setEditorMode("source");
			return;
		}
		if (issue.path && ["title", "slug", "categoryId", "tagIds"].includes(issue.path)) {
			setPendingFieldPath(issue.path);
			setIsInspectorOpen(true);
		}
	};

	// Actions (Publish, Archive, Trash)
	const handlePublish = async () => {
		if (saveStatus === "충돌") {
			setActionFeedback({ type: "error", message: "편집 충돌을 해결한 후 발행할 수 있습니다." });
			return;
		}
		setPublishIssues([]);
		setActionFeedback(null);
		if (isSubmitting) return;
		setIsSubmitting(true);
		try {
			await performSave();
			if (inflightSeqRef.current !== null || changeSeqRef.current > lastAckSeqRef.current) {
				setActionFeedback({
					type: "error",
					message: "변경사항이 저장되지 않아 발행하지 않았습니다. 저장 상태를 확인하세요.",
				});
				return;
			}
			const activeId = entryIdRef.current;
			if (!activeId) {
				setActionFeedback({ type: "error", message: "초안을 저장한 후 발행할 수 있습니다." });
				return;
			}

			const res = await fetch(`/api/cms/v1/entries/${activeId}/publish`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ expectedVersion: currentVersionRef.current }),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				if (res.status === 409) {
					setSaveStatus("충돌");
					const freshRes = await fetch(`/api/cms/v1/entries/${activeId}`);
					if (freshRes.ok) {
						setConflictData({
							server: await freshRes.json(),
							local: { title: titleRef.current, slug: slugRef.current, mdx: mdxRef.current },
						});
						return;
					}
				}
				const issues = cmsApiIssues(err);
				setPublishIssues(issues);
				setActionFeedback({
					type: "error",
					message: issues.length ? "발행할 수 없습니다. 아래 문제를 수정하세요." : cmsApiErrorMessage(err, "발행 실패"),
				});
				return;
			}
			const published = await res.json();
			setEntry((prev) => (prev ? { ...prev, status: "published", version: published.version } : null));
			currentVersionRef.current = published.version;
			const warnings: CmsIssue[] = Array.isArray(published.warnings) ? published.warnings : [];
			if (warnings.length > 0) {
				toast.warning(`발행되었습니다. 이미지 경고 ${warnings.length}건`, {
					description: warnings.slice(0, 5).map(cmsIssueMessage).join("\n"),
					duration: 10000,
					action: warnings[0].position ? { label: "본문 이동", onClick: () => focusIssue(warnings[0]) } : undefined,
				});
			} else {
				toast.success("발행되었습니다.");
			}
		} catch (err) {
			setActionFeedback({ type: "error", message: err instanceof Error ? err.message : "발행 실패" });
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleScheduleSubmit = async () => {
		if (!scheduleInputDate || isSubmitting) return;
		if (saveStatus === "충돌") {
			setActionFeedback({ type: "error", message: "편집 충돌을 해결한 후 예약할 수 있습니다." });
			return;
		}
		setIsSubmitting(true);
		try {
			await performSave();
			if (inflightSeqRef.current !== null || changeSeqRef.current > lastAckSeqRef.current) {
				setActionFeedback({
					type: "error",
					message: "변경사항이 저장되지 않아 예약하지 않았습니다. 저장 상태를 확인하세요.",
				});
				return;
			}
			const activeId = entryIdRef.current;
			if (!activeId) {
				setActionFeedback({ type: "error", message: "초안을 저장한 후 예약할 수 있습니다." });
				return;
			}

			const res = await fetch(`/api/cms/v1/entries/${activeId}/schedule`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					expectedVersion: currentVersionRef.current,
					scheduledAt: new Date(scheduleInputDate).toISOString(),
				}),
			});
			if (res.ok) {
				setScheduleModalOpen(false);
				setActionFeedback({ type: "success", message: "예약 등록 완료" });
			} else {
				const err = await res.json().catch(() => ({}));
				setActionFeedback({ type: "error", message: cmsApiErrorMessage(err, "예약 실패") });
			}
		} catch (err) {
			setActionFeedback({ type: "error", message: err instanceof Error ? err.message : "예약 실패" });
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isLoading) {
		return <div className="p-8 text-neutral-500">문서를 불러오는 중...</div>;
	}

	return (
		<div className="flex h-screen w-full flex-col overflow-hidden bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
			<Toaster richColors closeButton position="bottom-right" />
			{actionFeedback && (
				<p
					role={actionFeedback.type === "error" ? "alert" : "status"}
					className="whitespace-pre-wrap border-b px-4 py-2 text-sm"
				>
					{actionFeedback.message}
				</p>
			)}
			{publishIssues.length > 0 && (
				<ul className="max-h-36 overflow-y-auto border-b px-4 py-2 text-sm" aria-label="발행 검증 문제">
					{publishIssues.map((issue) => (
						<li key={JSON.stringify(issue)}>
							<button type="button" onClick={() => focusIssue(issue)} className="text-left underline">
								{cmsIssueMessage(issue)} — 수정할 곳으로 이동
							</button>
						</li>
					))}
				</ul>
			)}
			{/* Top Header: Breadcrumb & Global Actions */}
			<header className="z-20 flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-neutral-200 border-b bg-white/90 px-3 py-2 backdrop-blur sm:h-12 sm:flex-nowrap sm:justify-between sm:px-5 sm:py-0 dark:border-neutral-800 dark:bg-neutral-950/90">
				<div className="flex items-center gap-2 text-xs">
					<Link href="/admin" className="text-neutral-400 transition hover:text-neutral-900 dark:hover:text-white">
						대시보드
					</Link>
					<span className="text-neutral-300 dark:text-neutral-700">/</span>
					<span className="text-neutral-500 capitalize">{collection}</span>
					<span className="text-neutral-300 dark:text-neutral-700">/</span>
					<span className="max-w-[200px] truncate font-semibold text-neutral-800 dark:text-neutral-200">
						{title || (mode === "new" ? "새 글 작성" : "제목 없음")}
					</span>
				</div>

				<div className="flex w-full min-w-0 items-center gap-3 overflow-x-auto whitespace-nowrap sm:w-auto">
					{/* Auto-save Status */}
					<div className="flex items-center gap-1.5 text-neutral-500 text-xs">
						<span
							className={`h-2 w-2 rounded-full ${
								saveStatus === "저장됨"
									? "bg-emerald-500"
									: saveStatus === "저장 중"
										? "animate-pulse bg-amber-500"
										: saveStatus === "충돌"
											? "bg-red-500"
											: "bg-neutral-400"
							}`}
						/>
						<span>{saveStatus}</span>
					</div>

					{/* MDX Mode Toggle */}
					<button
						type="button"
						onClick={() => setEditorMode(editorMode === "visual" ? "source" : "visual")}
						className="rounded border border-neutral-300 px-2.5 py-1 text-xs transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
					>
						{editorMode === "visual" ? "MDX 원문" : "시각 모드"}
					</button>

					{/* Template Selector (for post and memo) */}
					{(collection === "post" || collection === "memo") && (
						<div className="relative">
							<button
								type="button"
								onClick={handleOpenTemplateMenu}
								className="flex items-center gap-1 rounded border border-neutral-300 px-2.5 py-1 text-xs transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
							>
								<span>템플릿</span>
								<span className="text-[10px] text-neutral-400">▼</span>
							</button>

							{templateMenuOpen && (
								<div className="absolute top-full right-0 z-50 mt-1.5 w-56 rounded-lg border border-neutral-200 bg-white p-1.5 text-xs shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
									<div className="mb-1 border-neutral-100 border-b px-2 py-1 font-semibold text-[11px] text-neutral-400 dark:border-neutral-800">
										{collection} 템플릿
									</div>
									{isTemplatesLoading ? (
										<div className="px-2 py-3 text-center text-neutral-400">불러오는 중...</div>
									) : availableTemplates.length === 0 ? (
										<div className="px-2 py-3 text-center text-neutral-400">등록된 템플릿이 없습니다.</div>
									) : (
										<div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
											{availableTemplates.map((t) => (
												<button
													key={t.id}
													type="button"
													onClick={() => handleApplyTemplate(t.mdx)}
													className="w-full truncate rounded px-2 py-1.5 text-left font-medium text-neutral-800 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
												>
													{t.name}
												</button>
											))}
										</div>
									)}
									<div className="mt-1 border-neutral-100 border-t pt-1 dark:border-neutral-800">
										<Link
											href={"/admin/templates" as any}
											target="_blank"
											className="block w-full px-2 py-1 text-left text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
										>
											⚙ 템플릿 관리 화면으로 이동
										</Link>
									</div>
								</div>
							)}
						</div>
					)}

					{/* Publish Actions */}
					<div className="flex items-center gap-1.5 border-neutral-200 border-l pl-3 dark:border-neutral-800">
						<button
							id="cms-publish"
							type="button"
							onClick={handlePublish}
							disabled={isSubmitting}
							className="rounded bg-emerald-600 px-3 py-1 font-semibold text-white text-xs transition hover:bg-emerald-500 disabled:opacity-50"
						>
							{entry?.status === "published" ? "변경사항 발행" : "발행하기"}
						</button>
						<button
							type="button"
							onClick={() => setScheduleModalOpen(true)}
							disabled={isSubmitting}
							className="rounded border border-neutral-300 px-2.5 py-1 text-xs transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
						>
							예약
						</button>
						<button
							type="button"
							onClick={() => setIsInspectorOpen(!isInspectorOpen)}
							className="rounded border border-neutral-300 px-2.5 py-1 text-neutral-600 text-xs transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
						>
							{isInspectorOpen ? "속성 닫기" : "속성 열기"}
						</button>
					</div>
				</div>
			</header>

			{/* Main Split Body: Left Canvas & Right Inspector */}
			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				{/* Canvas Area */}
				<div className="h-full min-w-0 flex-1 overflow-y-auto" inert={isInspectorOpen && isNarrowScreen}>
					{editorMode === "visual" ? (
						<div className="flex h-full flex-col">
							{publishIssues.find((issue) => issue.path === "mdx" || Boolean(issue.position)) && (
								<button
									type="button"
									onClick={() =>
										focusIssue(publishIssues.find((issue) => issue.path === "mdx" || Boolean(issue.position))!)
									}
									className="border-b p-2 text-left text-red-600 text-sm underline"
								>
									{cmsIssueMessage(publishIssues.find((issue) => issue.path === "mdx" || Boolean(issue.position))!)} —
									본문으로 이동
								</button>
							)}
							<CmsEditor
								content={mdx}
								onChange={(newContent) => {
									setMdx(newContent);
									triggerSave({ mdx: newContent });
								}}
								onCompositionStart={() => {
									isComposingRef.current = true;
								}}
								onCompositionEnd={() => {
									isComposingRef.current = false;
									triggerSave();
								}}
							/>
						</div>
					) : (
						<div className="mx-auto flex h-full w-full max-w-3xl flex-col p-6">
							<textarea
								id="cms-mdx-source"
								aria-label="MDX 본문"
								aria-invalid={
									publishIssues.some((issue) => issue.path === "mdx" || Boolean(issue.position)) || undefined
								}
								aria-describedby={
									publishIssues.some((issue) => issue.path === "mdx" || Boolean(issue.position))
										? "cms-mdx-error"
										: undefined
								}
								value={mdx}
								onChange={(e) => {
									const val = e.target.value;
									setMdx(val);
									triggerSave({ mdx: val });
								}}
								placeholder="MDX 원문을 작성하세요..."
								className="w-full flex-1 resize-none bg-transparent p-4 font-mono text-sm outline-none"
							/>
							{publishIssues.some((issue) => issue.path === "mdx" || Boolean(issue.position)) && (
								<p id="cms-mdx-error" className="text-red-500 text-sm">
									{cmsIssueMessage(publishIssues.find((issue) => issue.path === "mdx" || Boolean(issue.position))!)}
								</p>
							)}
						</div>
					)}
				</div>

				{/* Right Inspector Panel */}
				{isInspectorOpen && (
					<div className="absolute inset-0 z-10 sm:static sm:inset-auto sm:w-80">
						<InspectorPanel
							publishIssues={publishIssues}
							collection={collection}
							title={title}
							slug={slug}
							isSlugTouched={isSlugTouched}
							publishDate={publishDate}
							description={description}
							seoTitle={seoTitle}
							seoDescription={seoDescription}
							canonicalUrl={canonicalUrl}
							categoryId={categoryId}
							tagIds={tagIds}
							onTitleChange={handleTitleChange}
							onSlugChange={handleSlugChange}
							onRegenerateSlug={handleRegenerateSlug}
							onPublishDateChange={setPublishDate}
							onDescriptionChange={(desc) => {
								setDescription(desc);
								triggerSave();
							}}
							onSeoTitleChange={(value) => {
								setSeoTitle(value);
								seoTitleRef.current = value;
								triggerSave();
							}}
							onSeoDescriptionChange={(value) => {
								setSeoDescription(value);
								seoDescriptionRef.current = value;
								triggerSave();
							}}
							onCanonicalUrlChange={(value) => {
								setCanonicalUrl(value);
								canonicalUrlRef.current = value;
								triggerSave();
							}}
							onCategoryIdChange={(newCatId) => {
								setCategoryId(newCatId);
								categoryIdRef.current = newCatId;
								triggerSave();
							}}
							onTagIdsChange={(newTagIds) => {
								setTagIds(newTagIds);
								tagIdsRef.current = newTagIds;
								triggerSave();
							}}
						/>
					</div>
				)}
			</div>

			<Dialog open={Boolean(recoveryPrompt)} onOpenChange={(open) => !open && setRecoveryPrompt(null)}>
				<DialogContent
					className="max-w-md"
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						document.getElementById("cms-publish")?.focus();
					}}
				>
					<DialogHeader>
						<DialogTitle>임시 저장된 로컬 복구본 발견</DialogTitle>
						<DialogDescription>서버에 저장되지 않은 브라우저 복구본을 불러오시겠습니까?</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<button
							type="button"
							onClick={async () => {
								if (recoveryPrompt) await deleteLocalBackup(recoveryPrompt.key);
								setRecoveryPrompt(null);
							}}
							className="rounded-md border px-4 py-2 text-sm"
						>
							서버 본문 유지
						</button>
						<button
							type="button"
							onClick={() => {
								if (!recoveryPrompt) return;
								const { title: recoveredTitle, slug: recoveredSlug, mdx: recoveredMdx } = recoveryPrompt.snapshot;
								setTitle(recoveredTitle);
								setSlug(recoveredSlug || "");
								setIsSlugTouched(true);
								isSlugTouchedRef.current = true;
								setMdx(recoveredMdx);
								setRecoveryPrompt(null);
								triggerSave({ title: recoveredTitle, slug: recoveredSlug || "", mdx: recoveredMdx });
							}}
							className="rounded-md border px-4 py-2 text-sm"
						>
							로컬 복구본 불러오기
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(conflictData)} onOpenChange={(open) => !open && setConflictData(null)}>
				<DialogContent
					className="max-h-[90vh] max-w-4xl overflow-y-auto"
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						document.getElementById("cms-publish")?.focus();
					}}
				>
					<DialogHeader>
						<DialogTitle>편집 충돌 발생 — 자동 저장 중단됨</DialogTitle>
						<DialogDescription>
							다른 세션에서 변경했습니다. 내 변경사항을 복사한 뒤 서버 최신본으로 다시 여세요.
						</DialogDescription>
					</DialogHeader>
					{conflictData && (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="space-y-2 rounded border p-4">
								<p className="font-semibold text-sm">내 로컬 변경사항</p>
								<button
									type="button"
									onClick={() => navigator.clipboard.writeText(conflictData.local.mdx)}
									className="text-sm underline"
								>
									내 본문 복사
								</button>
								<pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">{conflictData.local.mdx}</pre>
							</div>
							<div className="space-y-2 rounded border p-4">
								<p className="font-semibold text-sm">서버 최신본 (v{conflictData.server.version})</p>
								<button
									type="button"
									onClick={() => navigator.clipboard.writeText(conflictData.server.working.mdx)}
									className="text-sm underline"
								>
									서버 본문 복사
								</button>
								<pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">
									{conflictData.server.working.mdx}
								</pre>
							</div>
						</div>
					)}
					<DialogFooter>
						<button type="button" onClick={() => setConflictData(null)} className="rounded-md border px-4 py-2 text-sm">
							취소
						</button>
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="rounded-md border px-4 py-2 text-sm"
						>
							서버 최신본으로 새로고침
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={pendingTemplateMdx !== null} onOpenChange={(open) => !open && setPendingTemplateMdx(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>템플릿 적용</DialogTitle>
						<DialogDescription>현재 본문이 선택한 템플릿으로 교체됩니다. 계속하시겠습니까?</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<button
							type="button"
							onClick={() => setPendingTemplateMdx(null)}
							className="rounded-md border px-3 py-2 text-sm"
						>
							취소
						</button>
						<button
							type="button"
							onClick={() => pendingTemplateMdx !== null && applyTemplate(pendingTemplateMdx)}
							className="rounded-md border px-3 py-2 text-sm"
						>
							적용
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>발행 예약</DialogTitle>
						<DialogDescription>예약한 시각에 글을 발행합니다.</DialogDescription>
					</DialogHeader>
					<label htmlFor="schedule-date" className="text-sm">
						예약 일시 (서울 시간)
					</label>
					<input
						id="schedule-date"
						type="datetime-local"
						value={scheduleInputDate}
						onChange={(e) => setScheduleInputDate(e.target.value)}
						className="w-full rounded-md border bg-background p-2 text-sm"
					/>
					<DialogFooter>
						<button
							type="button"
							onClick={() => setScheduleModalOpen(false)}
							className="rounded-md border px-3 py-2 text-sm"
						>
							취소
						</button>
						<button type="button" onClick={handleScheduleSubmit} className="rounded-md border px-3 py-2 text-sm">
							예약 등록
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { CmsEditor } from "@/cms/editor/tiptap-editor";
import { EditorToggle } from "@/cms/editor/editor-toggle";
import { getLocalBackup, saveLocalBackup, deleteLocalBackup, type LocalBackupRecord } from "./[id]/edit/indexed-db";
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

export function EntryEditorShell({ mode, initialEntryId, collection = "post" }: EntryEditorShellProps) {
	const [persistedId, setPersistedId] = useState<string | null>(initialEntryId || null);
	const [entry, setEntry] = useState<EntryData | null>(null);
	const [isLoading, setIsLoading] = useState(mode === "edit");

	// Metadata Form State
	const [title, setTitle] = useState("");
	const [slug, setSlug] = useState("");
	const [isSlugTouched, setIsSlugTouched] = useState(false);
	const [publishDate, setPublishDate] = useState("");
	const [description, setDescription] = useState("");
	const [categoryId, setCategoryId] = useState<string | null>(null);
	const [tagIds, setTagIds] = useState<string[]>([]);
	const [isInspectorOpen, setIsInspectorOpen] = useState(true);

	const categoryIdRef = useRef<string | null>(null);
	const tagIdsRef = useRef<string[]>([]);

	// Editor State
	const [mdx, setMdx] = useState("");
	const [editorMode, setEditorMode] = useState<"visual" | "source">("visual");
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("저장됨");

	// Modals
	const [recoveryPrompt, setRecoveryPrompt] = useState<LocalBackupRecord | null>(null);
	const [conflictData, setConflictData] = useState<{ server: EntryData; local: { title: string; slug: string; mdx: string } } | null>(null);
	const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
	const [scheduleInputDate, setScheduleInputDate] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

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

	const handleApplyTemplate = (templateMdx: string) => {
		if (mdx.trim().length > 0) {
			const ok = window.confirm("현재 본문 내용이 선택한 템플릿으로 교체됩니다. 계속하시겠습니까?");
			if (!ok) return;
		}
		setMdx(templateMdx);
		mdxRef.current = templateMdx;
		triggerSave({ mdx: templateMdx });
		setTemplateMenuOpen(false);
	};

	// Autosave Refs
	const entryIdRef = useRef<string | null>(initialEntryId || null);
	const currentVersionRef = useRef(1);
	const changeSeqRef = useRef(0);
	const lastAckSeqRef = useRef(0);
	const inflightSeqRef = useRef<number | null>(null);
	const isComposingRef = useRef(false);
	const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
	const maxWaitTimerRef = useRef<NodeJS.Timeout | null>(null);

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
				const initialTitle = data.working.metadata?.title || "";
				const initialSlug = data.workingSlug || "";
				const initialMdx = data.working.mdx || "";

				setTitle(initialTitle);
				setSlug(initialSlug);
				setIsSlugTouched(true);
				setMdx(initialMdx);
				currentVersionRef.current = data.version;

				setDescription(data.working.metadata?.summary || "");
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

	// Inflight Worker: handles either initial POST or subsequent PATCH
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
				title: currentTitle || "제목 없음",
			};
			if (description.trim()) metadataToSave.summary = description.trim();
			if (categoryIdRef.current) metadataToSave.categoryId = categoryIdRef.current;
			else delete metadataToSave.categoryId;
			if (tagIdsRef.current.length > 0) metadataToSave.tagIds = tagIdsRef.current;
			else delete metadataToSave.tagIds;

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
					setPersistedId(created.id);
					setEntry(created);
					currentVersionRef.current = created.version;
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
	const triggerSave = useCallback((override?: { title?: string; slug?: string; mdx?: string }) => {
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
			baseFingerprint: "",
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
	}, [collection, performSave]);

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

	// Actions (Publish, Archive, Trash)
	const handlePublish = async () => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		try {
			await performSave();
			const activeId = entryIdRef.current;
			if (!activeId) return;

			const res = await fetch(`/api/cms/v1/entries/${activeId}/publish`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ expectedVersion: currentVersionRef.current }),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				alert(err.message || "발행 실패");
				return;
			}
			const published = await res.json();
			setEntry((prev) => (prev ? { ...prev, status: "published", version: published.version } : null));
			currentVersionRef.current = published.version;
			alert("발행되었습니다!");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleScheduleSubmit = async () => {
		if (!scheduleInputDate || isSubmitting) return;
		setIsSubmitting(true);
		try {
			await performSave();
			const activeId = entryIdRef.current;
			if (!activeId) return;

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
				alert("예약 등록 완료");
			} else {
				const err = await res.json().catch(() => ({}));
				alert(err.message || "예약 실패");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isLoading) {
		return <div className="p-8 text-neutral-500">문서를 불러오는 중...</div>;
	}

	return (
		<div className="flex flex-col h-screen w-full bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden">
			{/* Top Header: Breadcrumb & Global Actions */}
			<header className="h-12 shrink-0 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-5 bg-white/90 dark:bg-neutral-950/90 backdrop-blur z-20">
				<div className="flex items-center gap-2 text-xs">
					<Link href="/admin" className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
						대시보드
					</Link>
					<span className="text-neutral-300 dark:text-neutral-700">/</span>
					<span className="capitalize text-neutral-500">{collection}</span>
					<span className="text-neutral-300 dark:text-neutral-700">/</span>
					<span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]">
						{title || (mode === "new" ? "새 글 작성" : "제목 없음")}
					</span>
				</div>

				<div className="flex items-center gap-3">
					{/* Auto-save Status */}
					<div className="flex items-center gap-1.5 text-xs text-neutral-500">
						<span
							className={`w-2 h-2 rounded-full ${
								saveStatus === "저장됨"
									? "bg-emerald-500"
									: saveStatus === "저장 중"
										? "bg-amber-500 animate-pulse"
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
						className="px-2.5 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
					>
						{editorMode === "visual" ? "MDX 원문" : "시각 모드"}
					</button>

					{/* Template Selector (for post and memo) */}
					{(collection === "post" || collection === "memo") && (
						<div className="relative">
							<button
								type="button"
								onClick={handleOpenTemplateMenu}
								className="px-2.5 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center gap-1"
							>
								<span>템플릿</span>
								<span className="text-[10px] text-neutral-400">▼</span>
							</button>

							{templateMenuOpen && (
								<div className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl z-50 p-1.5 text-xs">
									<div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 mb-1">
										{collection} 템플릿
									</div>
									{isTemplatesLoading ? (
										<div className="px-2 py-3 text-center text-neutral-400">불러오는 중...</div>
									) : availableTemplates.length === 0 ? (
										<div className="px-2 py-3 text-center text-neutral-400">
											등록된 템플릿이 없습니다.
										</div>
									) : (
										<div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
											{availableTemplates.map((t) => (
												<button
													key={t.id}
													type="button"
													onClick={() => handleApplyTemplate(t.mdx)}
													className="w-full text-left px-2 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-neutral-800 dark:text-neutral-200 font-medium truncate"
												>
													{t.name}
												</button>
											))}
										</div>
									)}
									<div className="border-t border-neutral-100 dark:border-neutral-800 mt-1 pt-1">
										<Link
											href={"/admin/templates" as any}
											target="_blank"
											className="block w-full text-left px-2 py-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
										>
											⚙ 템플릿 관리 화면으로 이동
										</Link>
									</div>
								</div>
							)}
						</div>
					)}

					{/* Publish Actions */}
					<div className="flex items-center gap-1.5 border-l border-neutral-200 dark:border-neutral-800 pl-3">
						<button
							type="button"
							onClick={handlePublish}
							disabled={isSubmitting}
							className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition disabled:opacity-50"
						>
							{entry?.status === "published" ? "변경사항 발행" : "발행하기"}
						</button>
						<button
							type="button"
							onClick={() => setScheduleModalOpen(true)}
							disabled={isSubmitting}
							className="px-2.5 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition disabled:opacity-50"
						>
							예약
						</button>
						<button
							type="button"
							onClick={() => setIsInspectorOpen(!isInspectorOpen)}
							className="px-2.5 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-neutral-600 dark:text-neutral-400"
						>
							{isInspectorOpen ? "속성 닫기" : "속성 열기"}
						</button>
					</div>
				</div>
			</header>

			{/* Main Split Body: Left Canvas & Right Inspector */}
			<div className="flex-1 flex overflow-hidden">
				{/* Canvas Area */}
				<div className="flex-1 h-full overflow-y-auto">
					{editorMode === "visual" ? (
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
					) : (
						<div className="w-full max-w-3xl mx-auto p-6 h-full flex flex-col">
							<textarea
								value={mdx}
								onChange={(e) => {
									const val = e.target.value;
									setMdx(val);
									triggerSave({ mdx: val });
								}}
								placeholder="MDX 원문을 작성하세요..."
								className="w-full flex-1 font-mono text-sm p-4 bg-transparent outline-none resize-none"
							/>
						</div>
					)}
				</div>

				{/* Right Inspector Panel */}
				{isInspectorOpen && (
					<InspectorPanel
						collection={collection}
						title={title}
						slug={slug}
						isSlugTouched={isSlugTouched}
						publishDate={publishDate}
						description={description}
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
				)}
			</div>

			{/* Schedule Modal */}
			{scheduleModalOpen && (
				<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4">
						<h3 className="text-base font-bold">발행 예약</h3>
						<input
							type="datetime-local"
							value={scheduleInputDate}
							onChange={(e) => setScheduleInputDate(e.target.value)}
							className="w-full text-xs p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
						/>
						<div className="flex justify-end gap-2 pt-2">
							<button
								type="button"
								onClick={() => setScheduleModalOpen(false)}
								className="px-3 py-1.5 text-xs border rounded"
							>
								취소
							</button>
							<button
								type="button"
								onClick={handleScheduleSubmit}
								className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded font-medium"
							>
								예약 등록
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

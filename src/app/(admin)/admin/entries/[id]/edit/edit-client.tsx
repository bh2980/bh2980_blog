"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
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
import { cmsApiErrorMessage } from "../../../api-error-message";
import { deleteLocalBackup, getLocalBackup, type LocalBackupRecord, saveLocalBackup } from "./indexed-db";

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

export function EditEntryClient({ entryId }: { entryId: string }) {
	const [entry, setEntry] = useState<EntryData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Editor Form State
	const [title, setTitle] = useState("");
	const [slug, setSlug] = useState("");
	const [mdx, setMdx] = useState("");
	const [editorMode, setEditorMode] = useState<"visual" | "source">("source");
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("저장됨");

	// Dialogs & Conflict State
	const [recoveryPrompt, setRecoveryPrompt] = useState<LocalBackupRecord | null>(null);
	const [conflictData, setConflictData] = useState<{
		server: EntryData;
		local: { title: string; slug: string; mdx: string };
	} | null>(null);

	// Autosave Refs
	const changeSeqRef = useRef(0);
	const lastAckSeqRef = useRef(0);
	const inflightSeqRef = useRef<number | null>(null);
	const isComposingRef = useRef(false);
	const currentVersionRef = useRef(1);
	const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
	const maxWaitTimerRef = useRef<NodeJS.Timeout | null>(null);
	const baseFingerprintRef = useRef("");

	const editorToggleRef = useRef<EditorToggle | null>(null);

	const titleRef = useRef(title);
	titleRef.current = title;
	const slugRef = useRef(slug);
	slugRef.current = slug;
	const mdxRef = useRef(mdx);
	mdxRef.current = mdx;

	const computeFingerprint = (t: string, s: string, m: string) => {
		return `${t}:::${s}:::${m}`;
	};

	// Fetch Entry initially
	// biome-ignore lint/correctness/useExhaustiveDependencies: fingerprint helper is pure and stable
	useEffect(() => {
		let isMounted = true;
		async function load() {
			try {
				const res = await fetch(`/api/cms/v1/entries/${entryId}`);
				if (!res.ok) throw new Error("엔트리를 불러올 수 없습니다.");
				const data: EntryData = await res.json();
				if (!isMounted) return;

				setEntry(data);
				const initialTitle = data.working.metadata?.title || "";
				const initialSlug = data.workingSlug || "";
				const initialMdx = data.working.mdx || "";

				setTitle(initialTitle);
				setSlug(initialSlug);
				setMdx(initialMdx);
				currentVersionRef.current = data.version;

				const fp = computeFingerprint(initialTitle, initialSlug, initialMdx);
				baseFingerprintRef.current = fp;

				editorToggleRef.current = new EditorToggle(initialMdx);
				if (editorToggleRef.current.mode === "visual") {
					setEditorMode("visual");
				}

				// Check IndexedDB backup
				const backup = await getLocalBackup(`admin:${entryId}`);
				if (backup) {
					if (backup.baseFingerprint === fp && backup.localFingerprint !== fp) {
						setRecoveryPrompt(backup);
					} else if (backup.localFingerprint === fp) {
						await deleteLocalBackup(`admin:${entryId}`);
					}
				}
			} catch (err: any) {
				if (isMounted) setErrorMessage(err.message || "오류가 발생했습니다.");
			} finally {
				if (isMounted) setIsLoading(false);
			}
		}
		load();
		return () => {
			isMounted = false;
		};
	}, [entryId]);

	// Inflight Save Worker
	// biome-ignore lint/correctness/useExhaustiveDependencies: autosave worker and scheduler call each other through stable refs
	const performSave = useCallback(async () => {
		if (inflightSeqRef.current !== null) return; // 1 inflight rule
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

		const payload = {
			expectedVersion: currentVersionRef.current,
			slug: currentSlug || null,
			metadata: { ...(entry?.working.metadata || {}), title: currentTitle },
			mdx: currentMdx,
		};

		try {
			const res = await fetch(`/api/cms/v1/entries/${entryId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				const updated = await res.json();
				currentVersionRef.current = updated.version;
				lastAckSeqRef.current = targetSeq;
				inflightSeqRef.current = null;

				if (changeSeqRef.current === targetSeq) {
					setSaveStatus("저장됨");
					await deleteLocalBackup(`admin:${entryId}`);
				} else {
					setSaveStatus("미저장 변경");
					triggerSave();
				}
			} else if (res.status === 409) {
				const err = await res.json();
				inflightSeqRef.current = null;
				setSaveStatus("충돌");

				// Fetch fresh server copy for conflict resolution
				const freshRes = await fetch(`/api/cms/v1/entries/${entryId}`);
				if (freshRes.ok) {
					const freshData = await freshRes.json();
					setConflictData({
						server: freshData,
						local: { title: titleRef.current, slug: slugRef.current, mdx: mdxRef.current },
					});
				}
			} else {
				inflightSeqRef.current = null;
				setSaveStatus("오류");
			}
		} catch (err) {
			inflightSeqRef.current = null;
			setSaveStatus("오프라인");
		}
	}, [entryId, entry, title, slug, mdx]);

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

			// Save local IndexedDB backup immediately (within 500ms)
			const fp = computeFingerprint(currentTitle, currentSlug, currentMdx);
			saveLocalBackup({
				key: `admin:${entryId}`,
				entryId,
				baseVersion: currentVersionRef.current,
				baseFingerprint: baseFingerprintRef.current,
				localFingerprint: fp,
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
		[entryId, performSave],
	);

	// BeforeUnload Warning
	useEffect(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (saveStatus === "미저장 변경" || saveStatus === "저장 중" || saveStatus === "충돌") {
				e.preventDefault();
			}
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [saveStatus]);

	// Toggle Mode Handler
	const handleToggleMode = () => {
		if (!editorToggleRef.current) return;
		if (editorMode === "visual") {
			editorToggleRef.current.toggleToSource();
			setMdx(editorToggleRef.current.source);
			setEditorMode("source");
		} else {
			editorToggleRef.current.updateSource(mdx);
			editorToggleRef.current.toggleToVisual();
			if (editorToggleRef.current.mode === "visual") {
				setEditorMode("visual");
			} else {
				setActionFeedback({ type: "error", message: "MDX 원문에 구문 오류가 있어 시각 모드로 전환할 수 없습니다." });
			}
		}
	};

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
	const [confirmAction, setConfirmAction] = useState<"archive" | "trash" | null>(null);
	const [actionFeedback, setActionFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
	const [scheduleInputDate, setScheduleInputDate] = useState("");

	const handlePublish = async () => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		try {
			// First perform any pending auto-save
			await performSave();
			const res = await fetch(`/api/cms/v1/entries/${entryId}/publish`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ expectedVersion: currentVersionRef.current }),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				setActionFeedback({ type: "error", message: cmsApiErrorMessage(err, "발행에 실패했습니다.") });
				return;
			}
			const published = await res.json();
			setEntry((prev) => (prev ? { ...prev, status: "published", version: published.version } : null));
			currentVersionRef.current = published.version;
			const warnings = Array.isArray(published.warnings) ? published.warnings : [];
			if (warnings.length > 0) {
				const lines = warnings
					.slice(0, 5)
					.map(
						(warning: { code: string; message?: string }) =>
							`- ${warning.code}${warning.message ? `: ${warning.message}` : ""}`,
					)
					.join("\n");
				setActionFeedback({
					type: "success",
					message: `성공적으로 발행되었습니다. 이미지 경고 ${warnings.length}건:\n${lines}`,
				});
			} else {
				setActionFeedback({ type: "success", message: "성공적으로 발행되었습니다." });
			}
		} catch (err) {
			setActionFeedback({
				type: "error",
				message: err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleArchive = () => setConfirmAction("archive");

	const performArchive = async () => {
		setConfirmAction(null);
		setIsSubmitting(true);
		try {
			const res = await fetch(`/api/cms/v1/entries/${entryId}/archive`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ expectedVersion: currentVersionRef.current }),
			});
			if (!res.ok) throw new Error("보관 처리 실패");
			const archived = await res.json();
			setEntry((prev) => (prev ? { ...prev, status: "archived", version: archived.version } : null));
			currentVersionRef.current = archived.version;
			setActionFeedback({ type: "success", message: "보관 처리되었습니다." });
		} catch (err) {
			setActionFeedback({ type: "error", message: err instanceof Error ? err.message : "오류가 발생했습니다." });
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleTrash = () => setConfirmAction("trash");

	const performTrash = async () => {
		setConfirmAction(null);
		setIsSubmitting(true);
		try {
			const res = await fetch(`/api/cms/v1/entries/${entryId}?expectedVersion=${currentVersionRef.current}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("휴지통 이동 실패");
			window.location.href = "/admin";
		} catch (err) {
			setActionFeedback({ type: "error", message: err instanceof Error ? err.message : "오류가 발생했습니다." });
			setIsSubmitting(false);
		}
	};

	const handleScheduleSubmit = async () => {
		if (!scheduleInputDate) {
			setActionFeedback({ type: "error", message: "예약 일시를 선택해주세요." });
			return;
		}
		setIsSubmitting(true);
		try {
			await performSave();
			const res = await fetch(`/api/cms/v1/entries/${entryId}/schedule`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					expectedVersion: currentVersionRef.current,
					scheduledAt: new Date(scheduleInputDate).toISOString(),
				}),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				setActionFeedback({ type: "error", message: cmsApiErrorMessage(err, "예약 등록에 실패했습니다.") });
				return;
			}
			setScheduleModalOpen(false);
			setActionFeedback({ type: "success", message: "발행 예약이 완료되었습니다." });
		} catch (err) {
			setActionFeedback({ type: "error", message: err instanceof Error ? err.message : "오류가 발생했습니다." });
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isLoading) {
		return <div className="p-8 text-neutral-500">문서를 불러오는 중...</div>;
	}

	if (errorMessage || !entry) {
		return (
			<div className="p-8 text-red-500">
				<p>{errorMessage || "문서를 찾을 수 없습니다."}</p>
				<Link href="/admin" className="mt-4 inline-block text-blue-600 hover:underline">
					대시보드로 돌아가기
				</Link>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
			{actionFeedback && (
				<p
					role={actionFeedback.type === "error" ? "alert" : "status"}
					aria-live="polite"
					className="whitespace-pre-wrap border-b px-4 py-2 text-sm"
				>
					{actionFeedback.message}
				</p>
			)}
			{/* Header Navigation & Actions */}
			<header className="sticky top-0 z-10 flex items-center justify-between border-neutral-200 border-b bg-white/80 px-6 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
				<div className="flex items-center gap-4">
					<Link
						href="/admin"
						className="font-medium text-neutral-500 text-sm hover:text-neutral-900 dark:hover:text-white"
					>
						← 대시보드
					</Link>
					<span className="text-neutral-300 dark:text-neutral-700">|</span>
					<span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-xs uppercase dark:bg-neutral-800">
						{entry.collection}
					</span>
					<span className="font-mono text-neutral-400 text-xs">v{entry.version}</span>
				</div>

				<div className="flex items-center gap-3">
					{/* Auto-save Status Indicator */}
					<div className="flex items-center gap-1.5 text-xs">
						<span
							className={`h-2 w-2 rounded-full ${
								saveStatus === "저장됨"
									? "bg-green-500"
									: saveStatus === "저장 중"
										? "animate-pulse bg-amber-500"
										: saveStatus === "충돌"
											? "bg-red-500"
											: "bg-neutral-400"
							}`}
						/>
						<span className="font-medium text-neutral-600 dark:text-neutral-400">{saveStatus}</span>
					</div>

					{/* Editor Mode Toggle Button */}
					<button
						type="button"
						onClick={handleToggleMode}
						className="rounded-md border border-neutral-300 px-3 py-1 font-medium text-xs transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
					>
						{editorMode === "visual" ? "MDX 원문 보기" : "시각 에디터 보기"}
					</button>

					{/* Lifecycle & Publish Actions */}
					<div className="flex items-center gap-1.5 border-neutral-200 border-l pl-3 dark:border-neutral-800">
						<button
							type="button"
							onClick={handlePublish}
							disabled={isSubmitting}
							className="rounded-md bg-emerald-600 px-3 py-1 font-semibold text-white text-xs transition hover:bg-emerald-500 disabled:opacity-50"
						>
							{entry.status === "published" ? "변경사항 발행" : "발행하기"}
						</button>

						<button
							type="button"
							onClick={() => setScheduleModalOpen(true)}
							disabled={isSubmitting}
							className="rounded-md border border-neutral-300 px-2.5 py-1 font-medium text-xs transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
						>
							예약
						</button>

						{entry.status === "published" && (
							<button
								type="button"
								onClick={handleArchive}
								disabled={isSubmitting}
								className="rounded-md px-2.5 py-1 font-medium text-amber-600 text-xs transition hover:bg-amber-50 disabled:opacity-50 dark:hover:bg-amber-950/40"
							>
								보관
							</button>
						)}

						<button
							type="button"
							onClick={handleTrash}
							disabled={isSubmitting}
							className="rounded-md px-2.5 py-1 font-medium text-red-600 text-xs transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/40"
						>
							삭제
						</button>
					</div>
				</div>
			</header>

			{/* Main Content Area */}
			<div className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-6">
				{/* Title Field */}
				<input
					type="text"
					value={title}
					onChange={(e) => {
						const val = e.target.value;
						setTitle(val);
						triggerSave({ title: val });
					}}
					placeholder="제목을 입력하세요"
					className="w-full border-none bg-transparent font-bold text-3xl outline-none placeholder:text-neutral-400"
				/>

				{/* Slug Field */}
				<div className="flex items-center gap-2 border-neutral-200 border-b pb-4 text-neutral-500 text-sm dark:border-neutral-800">
					<span className="font-mono">slug:</span>
					<input
						type="text"
						value={slug}
						onChange={(e) => {
							const val = e.target.value;
							setSlug(val);
							triggerSave({ slug: val });
						}}
						placeholder="auto-generated-slug"
						className="flex-1 border-none bg-transparent font-mono text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-neutral-300"
					/>
				</div>

				{/* Editor View */}
				<div className="min-h-[500px] rounded-lg border border-neutral-200 bg-neutral-50/50 p-2 dark:border-neutral-800 dark:bg-neutral-900/50">
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
						<textarea
							value={mdx}
							onChange={(e) => {
								const val = e.target.value;
								setMdx(val);
								triggerSave({ mdx: val });
							}}
							onCompositionStart={() => {
								isComposingRef.current = true;
							}}
							onCompositionEnd={() => {
								isComposingRef.current = false;
								triggerSave();
							}}
							placeholder="MDX 본문을 작성하세요..."
							className="h-full min-h-[500px] w-full resize-y bg-transparent p-4 font-mono text-sm outline-none"
						/>
					)}
				</div>
			</div>

			<Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>{confirmAction === "archive" ? "글 보관" : "휴지통으로 이동"}</DialogTitle>
						<DialogDescription>
							{confirmAction === "archive"
								? "공개 블로그에서 즉시 비공개 처리됩니다."
								: "이 글을 휴지통으로 이동하시겠습니까?"}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<button
							type="button"
							onClick={() => setConfirmAction(null)}
							className="rounded-md border px-3 py-2 text-sm"
						>
							취소
						</button>
						<button
							type="button"
							disabled={isSubmitting}
							onClick={() => (confirmAction === "archive" ? void performArchive() : void performTrash())}
							className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
						>
							확인
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>발행 예약 등록</DialogTitle>
						<DialogDescription>
							지정한 미래 시각에 외부 실행기가 이 글을 자동으로 발행합니다. 예약 중에는 본문 편집이 잠깁니다.
						</DialogDescription>
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
							className="rounded-md border px-4 py-2 text-sm"
						>
							취소
						</button>
						<button
							type="button"
							onClick={handleScheduleSubmit}
							disabled={isSubmitting}
							className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
						>
							예약 완료
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(recoveryPrompt)} onOpenChange={(open) => !open && setRecoveryPrompt(null)}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>임시 저장된 로컬 복구본 발견</DialogTitle>
						<DialogDescription>
							서버에 아직 저장되지 않은 브라우저 임시 복구본이 있습니다. 복구본을 불러오시겠습니까?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<button
							type="button"
							onClick={async () => {
								await deleteLocalBackup(`admin:${entryId}`);
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
								setTitle(recoveryPrompt.snapshot.title);
								setSlug(recoveryPrompt.snapshot.slug || "");
								setMdx(recoveryPrompt.snapshot.mdx);
								setRecoveryPrompt(null);
								triggerSave();
							}}
							className="rounded-md border px-4 py-2 text-sm"
						>
							로컬 복구본 불러오기
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(conflictData)} onOpenChange={() => undefined}>
				<DialogContent showCloseButton={false} className="max-h-[90vh] max-w-4xl overflow-y-auto">
					<DialogHeader>
						<DialogTitle>편집 충돌 발생 (409 Conflict) — 덮어쓰기 금지됨</DialogTitle>
						<DialogDescription>
							{conflictData &&
								`다른 세션에서 v${conflictData.server.version}으로 수정했습니다. 데이터 유실 방지를 위해 자동 저장이 중단되었습니다. 내용을 복사한 뒤 서버 최신본으로 다시 여세요.`}
						</DialogDescription>
					</DialogHeader>
					{conflictData && (
						<div className="grid grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
							<div className="space-y-2 rounded border p-4">
								<div className="flex justify-between">
									<span className="font-semibold text-sm">내 로컬 변경사항</span>
									<button
										type="button"
										onClick={() => navigator.clipboard.writeText(conflictData.local.mdx)}
										className="text-sm underline"
									>
										본문 복사
									</button>
								</div>
								<pre className="max-h-60 overflow-y-auto whitespace-pre-wrap text-xs">{conflictData.local.mdx}</pre>
							</div>
							<div className="space-y-2 rounded border p-4">
								<div className="flex justify-between">
									<span className="font-semibold text-sm">서버 최신본 (v{conflictData.server.version})</span>
									<button
										type="button"
										onClick={() => navigator.clipboard.writeText(conflictData.server.working.mdx)}
										className="text-sm underline"
									>
										본문 복사
									</button>
								</div>
								<pre className="max-h-60 overflow-y-auto whitespace-pre-wrap text-xs">
									{conflictData.server.working.mdx}
								</pre>
							</div>
						</div>
					)}
					<DialogFooter>
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
		</div>
	);
}

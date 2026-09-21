"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useReducer, useCallback } from "react";
import { CmsEditor } from "@/cms/editor/tiptap-editor";
import { EditorToggle } from "@/cms/editor/editor-toggle";
import { getLocalBackup, saveLocalBackup, deleteLocalBackup, type LocalBackupRecord } from "./indexed-db";

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
	const [conflictData, setConflictData] = useState<{ server: EntryData; local: { title: string; slug: string; mdx: string } } | null>(null);

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
	const triggerSave = useCallback((override?: { title?: string; slug?: string; mdx?: string }) => {
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
	}, [entryId, performSave]);

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
				alert("MDX 원문에 구문 오류가 있어 시각 모드로 전환할 수 없습니다.");
			}
		}
	};

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
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
				alert(err.message || "발행에 실패했습니다.");
				return;
			}
			const published = await res.json();
			setEntry((prev) => (prev ? { ...prev, status: "published", version: published.version } : null));
			currentVersionRef.current = published.version;
			alert("성공적으로 발행되었습니다!");
		} catch (err) {
			alert("네트워크 오류가 발생했습니다.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleArchive = async () => {
		if (!confirm("이 글을 보관하시겠습니까? 공개 블로그에서 즉시 비공개 처리됩니다.")) return;
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
			alert("보관 처리되었습니다.");
		} catch (err) {
			alert("오류가 발생했습니다.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleTrash = async () => {
		if (!confirm("이 글을 휴지통으로 이동하시겠습니까?")) return;
		setIsSubmitting(true);
		try {
			const res = await fetch(`/api/cms/v1/entries/${entryId}?expectedVersion=${currentVersionRef.current}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("휴지통 이동 실패");
			alert("휴지통으로 이동되었습니다.");
			window.location.href = "/admin";
		} catch (err) {
			alert("오류가 발생했습니다.");
			setIsSubmitting(false);
		}
	};

	const handleScheduleSubmit = async () => {
		if (!scheduleInputDate) {
			alert("예약 일시를 선택해주세요.");
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
				alert(err.message || "예약 등록에 실패했습니다.");
				return;
			}
			setScheduleModalOpen(false);
			alert("발행 예약이 완료되었습니다.");
		} catch (err) {
			alert("오류가 발생했습니다.");
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
		<div className="flex flex-col min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
			{/* Header Navigation & Actions */}
			<header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur px-6 py-3">
				<div className="flex items-center gap-4">
					<Link href="/admin" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
						← 대시보드
					</Link>
					<span className="text-neutral-300 dark:text-neutral-700">|</span>
					<span className="text-xs px-2 py-0.5 rounded-full font-mono bg-neutral-100 dark:bg-neutral-800 uppercase">
						{entry.collection}
					</span>
					<span className="text-xs font-mono text-neutral-400">v{entry.version}</span>
				</div>

				<div className="flex items-center gap-3">
					{/* Auto-save Status Indicator */}
					<div className="flex items-center gap-1.5 text-xs">
						<span
							className={`w-2 h-2 rounded-full ${
								saveStatus === "저장됨"
									? "bg-green-500"
									: saveStatus === "저장 중"
										? "bg-amber-500 animate-pulse"
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
						className="px-3 py-1 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
					>
						{editorMode === "visual" ? "MDX 원문 보기" : "시각 에디터 보기"}
					</button>

					{/* Lifecycle & Publish Actions */}
					<div className="flex items-center gap-1.5 border-l pl-3 border-neutral-200 dark:border-neutral-800">
						<button
							type="button"
							onClick={handlePublish}
							disabled={isSubmitting}
							className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition disabled:opacity-50"
						>
							{entry.status === "published" ? "변경사항 발행" : "발행하기"}
						</button>

						<button
							type="button"
							onClick={() => setScheduleModalOpen(true)}
							disabled={isSubmitting}
							className="px-2.5 py-1 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition disabled:opacity-50"
						>
							예약
						</button>

						{entry.status === "published" && (
							<button
								type="button"
								onClick={handleArchive}
								disabled={isSubmitting}
								className="px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md transition disabled:opacity-50"
							>
								보관
							</button>
						)}

						<button
							type="button"
							onClick={handleTrash}
							disabled={isSubmitting}
							className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition disabled:opacity-50"
						>
							삭제
						</button>
					</div>
				</div>
			</header>

			{/* Main Content Area */}
			<div className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
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
					className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-neutral-400"
				/>

				{/* Slug Field */}
				<div className="flex items-center gap-2 text-sm text-neutral-500 border-b border-neutral-200 dark:border-neutral-800 pb-4">
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
						className="flex-1 font-mono bg-transparent border-none outline-none text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400"
					/>
				</div>

				{/* Editor View */}
				<div className="min-h-[500px] border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 bg-neutral-50/50 dark:bg-neutral-900/50">
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
							className="w-full h-full min-h-[500px] font-mono text-sm p-4 bg-transparent outline-none resize-y"
						/>
					)}
				</div>
			</div>

			{/* Schedule Modal */}
			{scheduleModalOpen && (
				<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
					<div className="bg-white dark:bg-neutral-900 rounded-lg max-w-sm w-full p-6 shadow-xl border border-neutral-200 dark:border-neutral-800 space-y-4">
						<h3 className="text-lg font-bold">발행 예약 등록</h3>
						<p className="text-sm text-neutral-600 dark:text-neutral-400">
							지정한 미래 시각에 외부 실행기가 이 글을 자동으로 발행합니다. 예약 중에는 본문 편집이 잠깁니다.
						</p>
						<div>
							<label className="block text-xs font-medium text-neutral-500 mb-1">예약 일시 (서울 시간)</label>
							<input
								type="datetime-local"
								value={scheduleInputDate}
								onChange={(e) => setScheduleInputDate(e.target.value)}
								className="w-full text-sm p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
							/>
						</div>
						<div className="flex justify-end gap-3 pt-2">
							<button
								type="button"
								onClick={() => setScheduleModalOpen(false)}
								className="px-4 py-2 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
							>
								취소
							</button>
							<button
								type="button"
								onClick={handleScheduleSubmit}
								disabled={isSubmitting}
								className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
							>
								예약 완료
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Recovery Dialog */}
			{recoveryPrompt && (
				<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
					<div className="bg-white dark:bg-neutral-900 rounded-lg max-w-md w-full p-6 shadow-xl border border-neutral-200 dark:border-neutral-800 space-y-4">
						<h3 className="text-lg font-bold">임시 저장된 로컬 복구본 발견</h3>
						<p className="text-sm text-neutral-600 dark:text-neutral-400">
							서버에 아직 저장되지 않은 브라우저 임시 복구본이 있습니다. 복구본을 불러오시겠습니까?
						</p>
						<div className="flex justify-end gap-3 pt-2">
							<button
								type="button"
								onClick={async () => {
									await deleteLocalBackup(`admin:${entryId}`);
									setRecoveryPrompt(null);
								}}
								className="px-4 py-2 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
							>
								서버 본문 유지
							</button>
							<button
								type="button"
								onClick={() => {
									setTitle(recoveryPrompt.snapshot.title);
									setSlug(recoveryPrompt.snapshot.slug || "");
									setMdx(recoveryPrompt.snapshot.mdx);
									setRecoveryPrompt(null);
									triggerSave();
								}}
								className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
							>
								로컬 복구본 불러오기
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Conflict Resolution Modal (No overwrite, copy & compare) */}
			{conflictData && (
				<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
					<div className="bg-white dark:bg-neutral-900 rounded-lg max-w-4xl w-full p-6 shadow-2xl border border-red-300 dark:border-red-900 space-y-4 max-h-[90vh] flex flex-col">
						<div className="flex justify-between items-center border-b pb-3">
							<h3 className="text-lg font-bold text-red-600">편집 충돌 발생 (409 Conflict)</h3>
							<span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">덮어쓰기 금지됨</span>
						</div>
						<p className="text-sm text-neutral-600 dark:text-neutral-400">
							다른 세션 또는 사용자가 이 문서를 수정하여 새 버전(v{conflictData.server.version})을 발행/저장했습니다. 데이터 유실을 방지하기 위해 자동 저장이 중단되었습니다. 내용을 복사한 뒤 서버 최신본으로 다시 열어주세요.
						</p>

						<div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto">
							<div className="border border-neutral-200 dark:border-neutral-800 rounded p-4 space-y-2">
								<div className="flex justify-between items-center">
									<span className="font-bold text-sm">내 로컬 변경사항</span>
									<button
										type="button"
										onClick={() => navigator.clipboard.writeText(conflictData.local.mdx)}
										className="text-xs text-blue-600 hover:underline"
									>
										본문 복사
									</button>
								</div>
								<div className="text-xs font-mono bg-neutral-50 dark:bg-neutral-950 p-2 rounded max-h-60 overflow-y-auto whitespace-pre-wrap">
									{conflictData.local.mdx}
								</div>
							</div>

							<div className="border border-neutral-200 dark:border-neutral-800 rounded p-4 space-y-2">
								<div className="flex justify-between items-center">
									<span className="font-bold text-sm">서버 최신본 (v{conflictData.server.version})</span>
									<button
										type="button"
										onClick={() => navigator.clipboard.writeText(conflictData.server.working.mdx)}
										className="text-xs text-blue-600 hover:underline"
									>
										본문 복사
									</button>
								</div>
								<div className="text-xs font-mono bg-neutral-50 dark:bg-neutral-950 p-2 rounded max-h-60 overflow-y-auto whitespace-pre-wrap">
									{conflictData.server.working.mdx}
								</div>
							</div>
						</div>

						<div className="flex justify-end gap-3 pt-4 border-t">
							<button
								type="button"
								onClick={() => {
									window.location.reload();
								}}
								className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-black rounded hover:opacity-90"
							>
								서버 최신본으로 새로고침
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

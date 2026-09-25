"use client";

import { Check, FileText, LayoutTemplate, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BodyTemplate } from "@/cms/adapters/postgres/content-store";
import { CmsEditor } from "@/cms/editor/tiptap-editor";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { AdminSidebar } from "../admin-sidebar";

export function TemplateManager() {
	const [templates, setTemplates] = useState<BodyTemplate[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filterCollection, setFilterCollection] = useState<string>("all");

	// Editor state for selected/new template
	const [activeTemplate, setActiveTemplate] = useState<Partial<BodyTemplate> | null>(null);
	const [editName, setEditName] = useState("");
	const [editForCollection, setEditForCollection] = useState<"post" | "memo">("memo");
	const [editMdx, setEditMdx] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState<BodyTemplate | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const fetchTemplates = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/cms/v1/templates");
			if (!res.ok) throw new Error("템플릿 목록을 불러올 수 없습니다.");
			const data = await res.json();
			setTemplates(data.templates || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "불러오기 실패");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchTemplates();
	}, [fetchTemplates]);

	const handleSelectTemplate = (t: BodyTemplate) => {
		setActiveTemplate(t);
		setEditName(t.name);
		setEditForCollection(t.forCollection);
		setEditMdx(t.mdx);
		setSaveError(null);
	};

	const handleOpenNew = () => {
		setActiveTemplate({
			name: "",
			forCollection: filterCollection === "post" ? "post" : "memo",
			mdx: "## 서론\n\n내용을 입력하세요.\n\n## 본론\n\n- 항목 1\n- 항목 2\n\n## 결론\n\n마무리 요약.",
		});
		setEditName("");
		setEditForCollection(filterCollection === "post" ? "post" : "memo");
		setEditMdx("## 서론\n\n내용을 입력하세요.\n\n## 본론\n\n- 항목 1\n- 항목 2\n\n## 결론\n\n마무리 요약.");
		setSaveError(null);
	};

	const handleCloseEditor = () => {
		setActiveTemplate(null);
		setSaveError(null);
	};

	const handleSave = async () => {
		if (!editName.trim()) {
			setSaveError("템플릿 이름을 입력해주세요.");
			return;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			if (activeTemplate?.id) {
				// PATCH update
				const res = await fetch(`/api/cms/v1/templates/${activeTemplate.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: editName.trim(),
						forCollection: editForCollection,
						mdx: editMdx,
						expectedVersion: activeTemplate.version,
					}),
				});
				if (!res.ok) {
					const errData = await res.json().catch(() => ({}));
					throw new Error(errData.message || "수정 저장에 실패했습니다.");
				}
				const updated = await res.json();
				setActiveTemplate(updated);
			} else {
				// POST create
				const res = await fetch("/api/cms/v1/templates", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: editName.trim(),
						forCollection: editForCollection,
						mdx: editMdx,
					}),
				});
				if (!res.ok) {
					const errData = await res.json().catch(() => ({}));
					throw new Error(errData.message || "생성에 실패했습니다.");
				}
				const created = await res.json();
				setActiveTemplate(created);
			}
			await fetchTemplates();
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "오류가 발생했습니다.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = (template: BodyTemplate, event: React.MouseEvent) => {
		event.stopPropagation();
		setDeleteError(null);
		setPendingDelete(template);
	};

	const confirmDelete = async () => {
		const template = pendingDelete;
		if (!template) return;
		setPendingDelete(null);
		try {
			const res = await fetch(`/api/cms/v1/templates/${template.id}?expectedVersion=${template.version}`, {
				method: "DELETE",
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				setDeleteError(errData.message || "삭제에 실패했습니다.");
				return;
			}
			if (activeTemplate?.id === template.id) setActiveTemplate(null);
			await fetchTemplates();
		} catch (err) {
			setDeleteError(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
		}
	};

	const filtered = templates.filter((t) => {
		if (filterCollection === "all") return true;
		return t.forCollection === filterCollection;
	});

	return (
		<>
			<div className="flex h-screen w-full overflow-hidden bg-neutral-950 text-neutral-200">
				{/* 1단: 공통 글로벌 어드민 사이드바 */}
				<AdminSidebar activeNav="templates" />

				<div className="flex flex-1 flex-col overflow-hidden">
					{/* 상단 글로벌 헤더 */}
					<header className="flex h-14 items-center justify-between border-neutral-800 border-b bg-neutral-900/40 px-6">
						<div className="flex items-center gap-3">
							<Link href="/admin" className="font-medium text-neutral-400 text-xs transition hover:text-white">
								대시보드
							</Link>
							<span className="text-neutral-600">/</span>
							<h1 className="flex items-center gap-2 font-semibold text-sm text-white">
								<LayoutTemplate className="h-4 w-4 text-emerald-400" />
								<span>본문 템플릿 관리</span>
							</h1>
							<span className="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-400 text-xs">
								총 {templates.length}개
							</span>
						</div>
						<button
							type="button"
							onClick={handleOpenNew}
							className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1.5 font-semibold text-neutral-950 text-xs shadow-sm transition hover:bg-neutral-200"
						>
							<Plus className="h-3.5 w-3.5" />
							<span>새 템플릿 만들기</span>
						</button>
					</header>

					{error && (
						<p role="alert" className="border-neutral-800 border-b px-4 py-2 text-sm">
							{error}
						</p>
					)}
					{deleteError && (
						<p role="alert" className="border-neutral-800 border-b px-4 py-2 text-sm">
							{deleteError}
						</p>
					)}
					{/* 2단 + 3단 본문 작업 영역 */}
					<div className="flex flex-1 overflow-hidden">
						{/* 2단: 템플릿 목록 패널 */}
						<div className="flex w-80 flex-shrink-0 flex-col border-neutral-800 border-r bg-neutral-900/20">
							{/* 필터 탭 */}
							<div className="flex gap-1 border-neutral-800 border-b p-2.5 text-xs">
								<button
									type="button"
									onClick={() => setFilterCollection("all")}
									className={`flex-1 rounded-md py-1.5 font-medium transition ${
										filterCollection === "all"
											? "bg-neutral-800 font-semibold text-white"
											: "text-neutral-400 hover:bg-neutral-800/40 hover:text-white"
									}`}
								>
									전체
								</button>
								<button
									type="button"
									onClick={() => setFilterCollection("memo")}
									className={`flex-1 rounded-md py-1.5 font-medium transition ${
										filterCollection === "memo"
											? "bg-neutral-800 font-semibold text-emerald-400"
											: "text-neutral-400 hover:bg-neutral-800/40 hover:text-white"
									}`}
								>
									메모용
								</button>
								<button
									type="button"
									onClick={() => setFilterCollection("post")}
									className={`flex-1 rounded-md py-1.5 font-medium transition ${
										filterCollection === "post"
											? "bg-neutral-800 font-semibold text-blue-400"
											: "text-neutral-400 hover:bg-neutral-800/40 hover:text-white"
									}`}
								>
									포스트용
								</button>
							</div>

							{/* 템플릿 리스트 */}
							<div className="flex-1 divide-y divide-neutral-800/40 overflow-y-auto">
								{isLoading ? (
									<div className="p-8 text-center text-neutral-500 text-xs">불러오는 중...</div>
								) : filtered.length === 0 ? (
									<div className="p-8 text-center text-neutral-500 text-xs">등록된 템플릿이 없습니다.</div>
								) : (
									filtered.map((t) => {
										const isSelected = activeTemplate?.id === t.id;
										return (
											// biome-ignore lint/a11y/useSemanticElements: row contains a nested delete button
											<div
												key={t.id}
												role="button"
												tabIndex={0}
												onClick={() => handleSelectTemplate(t)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault();
														handleSelectTemplate(t);
													}
												}}
												className={`group flex cursor-pointer items-center justify-between p-4 transition ${
													isSelected
														? "border-emerald-500 border-l-2 bg-neutral-800/90 pl-[14px] text-white"
														: "text-neutral-300 hover:bg-neutral-800/40"
												}`}
											>
												<div className="flex min-w-0 flex-col gap-1.5 pr-2">
													<span className="truncate font-medium text-sm">{t.name}</span>
													<div className="flex items-center gap-2 text-neutral-500 text-xs">
														<span
															className={`rounded px-1.5 py-0.5 font-semibold text-[10px] uppercase ${
																t.forCollection === "post"
																	? "border border-blue-800/60 bg-blue-950 text-blue-400"
																	: "border border-emerald-800/60 bg-emerald-950 text-emerald-400"
															}`}
														>
															{t.forCollection}
														</span>
														<span className="text-[11px]">{new Date(t.updatedAt).toLocaleDateString("ko-KR")}</span>
													</div>
												</div>
												<button
													type="button"
													onClick={(e) => handleDelete(t, e)}
													className="rounded p-1.5 text-neutral-500 opacity-0 transition hover:bg-neutral-700 hover:text-red-400 group-hover:opacity-100"
													aria-label={`템플릿 삭제: ${t.name}`}
													title="템플릿 삭제"
												>
													<Trash2 className="h-4 w-4" />
												</button>
											</div>
										);
									})
								)}
							</div>
						</div>

						{/* 3단: 템플릿 에디터 패널 (게시글 에디터와 동일한 꽉 찬 풀 캔버스) */}
						<div className="flex flex-1 flex-col overflow-hidden bg-neutral-950">
							{activeTemplate ? (
								<div className="flex h-full flex-1 flex-col overflow-hidden">
									{/* 에디터 상단 메타 바 */}
									<div className="flex items-center justify-between border-neutral-800 border-b bg-neutral-900/30 px-8 py-3.5">
										<div className="flex max-w-2xl flex-1 items-center gap-3">
											<Input
												type="text"
												aria-label="템플릿 이름"
												value={editName}
												onChange={(e) => setEditName(e.target.value)}
												placeholder="템플릿 이름 (예: 알고리즘 풀이 메모)"
												className="h-auto w-full min-w-0 flex-1 rounded-md border-neutral-700 bg-neutral-900 px-3.5 py-1.5 font-medium text-sm text-white placeholder-neutral-500 shadow-none transition focus:border-neutral-400 focus:outline-none focus-visible:border-neutral-400 focus-visible:ring-0 dark:bg-neutral-900"
											/>
											<NativeSelect
												aria-label="대상 컬렉션"
												value={editForCollection}
												onChange={(e) => setEditForCollection(e.target.value as "post" | "memo")}
												className="h-auto cursor-pointer rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 pr-9 font-medium text-neutral-200 text-xs shadow-none transition focus:border-neutral-400 focus:outline-none focus-visible:border-neutral-400 focus-visible:ring-0 dark:bg-neutral-900 dark:hover:bg-neutral-900"
											>
												<option value="memo">메모용 (memo)</option>
												<option value="post">포스트용 (post)</option>
											</NativeSelect>
											<span className="hidden text-neutral-500 text-xs sm:inline">본문 MDX 골격</span>
										</div>

										<div className="flex items-center gap-2">
											<button
												type="button"
												onClick={handleCloseEditor}
												className="rounded-md px-3 py-1.5 text-neutral-400 text-xs transition hover:bg-neutral-800 hover:text-white"
											>
												닫기
											</button>
											<button
												type="button"
												disabled={isSaving}
												onClick={handleSave}
												className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 font-semibold text-white text-xs shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
											>
												<Save className="h-3.5 w-3.5" />
												<span>{isSaving ? "저장 중..." : activeTemplate.id ? "수정 완료" : "생성하기"}</span>
											</button>
										</div>
									</div>

									{saveError && (
										<div className="border-red-800/80 border-b bg-red-950/60 px-8 py-2 text-red-300 text-xs">
											{saveError}
										</div>
									)}

									{/* 꽉 찬 CmsEditor 캔버스: 조잡한 외곽 상자를 없애고 에디터가 전체 높이를 유려하게 채움 */}
									<div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-neutral-950">
										<CmsEditor content={editMdx} onChange={(next) => setEditMdx(next)} />
									</div>
								</div>
							) : (
								/* 템플릿 미선택 Empty State */
								<div className="flex flex-1 flex-col items-center justify-center bg-neutral-950 p-8 text-center">
									<div className="flex max-w-md flex-col items-center rounded-2xl border border-neutral-800/80 bg-neutral-900/60 p-8 shadow-lg">
										<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800 text-emerald-400">
											<LayoutTemplate className="h-6 w-6" />
										</div>
										<h2 className="mb-1.5 font-semibold text-base text-white">
											본문 템플릿을 선택하거나 새로 만드세요
										</h2>
										<p className="mb-6 text-neutral-400 text-xs leading-relaxed">
											좌측 목록에서 기존 템플릿을 선택해 수정하거나, 새 템플릿을 생성해 글 작성 시 빠르게 적용할 수
											있습니다.
										</p>
										<button
											type="button"
											onClick={handleOpenNew}
											className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-semibold text-neutral-950 text-xs shadow transition hover:bg-neutral-200"
										>
											<Plus className="h-4 w-4" />
											<span>새 템플릿 만들기</span>
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
			<Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>템플릿 삭제</DialogTitle>
						<DialogDescription>
							&apos;{pendingDelete?.name}&apos; 템플릿을 삭제하시겠습니까? 이 템플릿으로 작성된 글에는 영향이 없습니다.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<button
							type="button"
							onClick={() => setPendingDelete(null)}
							className="rounded-md border px-3 py-2 text-sm"
						>
							취소
						</button>
						<button type="button" onClick={() => void confirmDelete()} className="rounded-md border px-3 py-2 text-sm">
							삭제
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

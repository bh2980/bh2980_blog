"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
	LayoutTemplate,
	FileText,
	Plus,
	Trash2,
	Check,
	Save,
	X,
	Sparkles,
} from "lucide-react";
import type { BodyTemplate } from "@/cms/adapters/postgres/content-store";
import { CmsEditor } from "@/cms/editor/tiptap-editor";
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

	const fetchTemplates = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/cms/v1/templates");
			if (!res.ok) throw new Error("템플릿 목록을 불러올 수 없습니다.");
			const data = await res.json();
			setTemplates(data.templates || []);
		} catch (err: any) {
			setError(err.message || "불러오기 실패");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchTemplates();
	}, []);

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
		} catch (err: any) {
			setSaveError(err.message || "오류가 발생했습니다.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (t: BodyTemplate, e: React.MouseEvent) => {
		e.stopPropagation();
		if (!window.confirm(`'${t.name}' 템플릿을 삭제하시겠습니까?\n이미 이 템플릿으로 작성된 글에는 영향을 주지 않습니다.`)) {
			return;
		}

		try {
			const res = await fetch(`/api/cms/v1/templates/${t.id}?expectedVersion=${t.version}`, {
				method: "DELETE",
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				alert(errData.message || "삭제에 실패했습니다.");
				return;
			}
			if (activeTemplate?.id === t.id) {
				setActiveTemplate(null);
			}
			await fetchTemplates();
		} catch (err: any) {
			alert(err.message || "삭제 중 오류가 발생했습니다.");
		}
	};

	const filtered = templates.filter((t) => {
		if (filterCollection === "all") return true;
		return t.forCollection === filterCollection;
	});

	return (
		<div className="flex h-screen w-full overflow-hidden bg-neutral-950 text-neutral-200">
			{/* 1단: 공통 글로벌 어드민 사이드바 */}
			<AdminSidebar activeNav="templates" />

			<div className="flex flex-1 flex-col overflow-hidden">
				{/* 상단 글로벌 헤더 */}
				<header className="flex h-14 items-center justify-between border-b border-neutral-800 px-6 bg-neutral-900/40">
					<div className="flex items-center gap-3">
						<Link
							href="/admin"
							className="text-xs font-medium text-neutral-400 hover:text-white transition"
						>
							대시보드
						</Link>
						<span className="text-neutral-600">/</span>
						<h1 className="text-sm font-semibold text-white flex items-center gap-2">
							<LayoutTemplate className="h-4 w-4 text-emerald-400" />
							<span>본문 템플릿 관리</span>
						</h1>
						<span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
							총 {templates.length}개
						</span>
					</div>
					<button
						type="button"
						onClick={handleOpenNew}
						className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition shadow-sm"
					>
						<Plus className="h-3.5 w-3.5" />
						<span>새 템플릿 만들기</span>
					</button>
				</header>

				{/* 2단 + 3단 본문 작업 영역 */}
				<div className="flex flex-1 overflow-hidden">
					{/* 2단: 템플릿 목록 패널 */}
					<div className="w-80 border-r border-neutral-800 flex flex-col bg-neutral-900/20 flex-shrink-0">
						{/* 필터 탭 */}
						<div className="flex border-b border-neutral-800 p-2.5 gap-1 text-xs">
							<button
								type="button"
								onClick={() => setFilterCollection("all")}
								className={`flex-1 rounded-md py-1.5 font-medium transition ${
									filterCollection === "all"
										? "bg-neutral-800 text-white font-semibold"
										: "text-neutral-400 hover:text-white hover:bg-neutral-800/40"
								}`}
							>
								전체
							</button>
							<button
								type="button"
								onClick={() => setFilterCollection("memo")}
								className={`flex-1 rounded-md py-1.5 font-medium transition ${
									filterCollection === "memo"
										? "bg-neutral-800 text-emerald-400 font-semibold"
										: "text-neutral-400 hover:text-white hover:bg-neutral-800/40"
								}`}
							>
								메모용
							</button>
							<button
								type="button"
								onClick={() => setFilterCollection("post")}
								className={`flex-1 rounded-md py-1.5 font-medium transition ${
									filterCollection === "post"
										? "bg-neutral-800 text-blue-400 font-semibold"
										: "text-neutral-400 hover:text-white hover:bg-neutral-800/40"
								}`}
							>
								포스트용
							</button>
						</div>

						{/* 템플릿 리스트 */}
						<div className="flex-1 overflow-y-auto divide-y divide-neutral-800/40">
							{isLoading ? (
								<div className="p-8 text-center text-xs text-neutral-500">불러오는 중...</div>
							) : filtered.length === 0 ? (
								<div className="p-8 text-center text-xs text-neutral-500">
									등록된 템플릿이 없습니다.
								</div>
							) : (
								filtered.map((t) => {
									const isSelected = activeTemplate?.id === t.id;
									return (
										<div
											key={t.id}
											onClick={() => handleSelectTemplate(t)}
											className={`group flex items-center justify-between p-4 cursor-pointer transition ${
												isSelected
													? "bg-neutral-800/90 text-white border-l-2 border-emerald-500 pl-[14px]"
													: "hover:bg-neutral-800/40 text-neutral-300"
											}`}
										>
											<div className="flex flex-col gap-1.5 min-w-0 pr-2">
												<span className="font-medium text-sm truncate">{t.name}</span>
												<div className="flex items-center gap-2 text-xs text-neutral-500">
													<span
														className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-semibold ${
															t.forCollection === "post"
																? "bg-blue-950 text-blue-400 border border-blue-800/60"
																: "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
														}`}
													>
														{t.forCollection}
													</span>
													<span className="text-[11px]">
														{new Date(t.updatedAt).toLocaleDateString("ko-KR")}
													</span>
												</div>
											</div>
											<button
												type="button"
												onClick={(e) => handleDelete(t, e)}
												className="opacity-0 group-hover:opacity-100 rounded p-1.5 text-neutral-500 hover:bg-neutral-700 hover:text-red-400 transition"
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
					<div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden">
						{activeTemplate ? (
							<div className="flex-1 flex flex-col h-full overflow-hidden">
								{/* 에디터 상단 메타 바 */}
								<div className="flex items-center justify-between border-b border-neutral-800 px-8 py-3.5 bg-neutral-900/30">
									<div className="flex items-center gap-3 flex-1 max-w-2xl">
										<input
											type="text"
											value={editName}
											onChange={(e) => setEditName(e.target.value)}
											placeholder="템플릿 이름 (예: 알고리즘 풀이 메모)"
											className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3.5 py-1.5 text-sm font-medium text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400 transition"
										/>
										<select
											value={editForCollection}
											onChange={(e) =>
												setEditForCollection(e.target.value as "post" | "memo")
											}
											className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 focus:outline-none focus:border-neutral-400 transition cursor-pointer"
										>
											<option value="memo">메모용 (memo)</option>
											<option value="post">포스트용 (post)</option>
										</select>
										<span className="text-xs text-neutral-500 hidden sm:inline">
											본문 MDX 골격
										</span>
									</div>

									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={handleCloseEditor}
											className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
										>
											닫기
										</button>
										<button
											type="button"
											disabled={isSaving}
											onClick={handleSave}
											className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50 shadow-sm"
										>
											<Save className="h-3.5 w-3.5" />
											<span>{isSaving ? "저장 중..." : activeTemplate.id ? "수정 완료" : "생성하기"}</span>
										</button>
									</div>
								</div>

								{saveError && (
									<div className="bg-red-950/60 border-b border-red-800/80 px-8 py-2 text-xs text-red-300">
										{saveError}
									</div>
								)}

								{/* 꽉 찬 CmsEditor 캔버스: 조잡한 외곽 상자를 없애고 에디터가 전체 높이를 유려하게 채움 */}
								<div className="flex-1 min-h-0 overflow-y-auto bg-neutral-950 flex flex-col">
									<CmsEditor
										content={editMdx}
										onChange={(next) => setEditMdx(next)}
									/>
								</div>
							</div>
						) : (
							/* 템플릿 미선택 Empty State */
							<div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-neutral-950">
								<div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-8 max-w-md flex flex-col items-center shadow-lg">
									<div className="h-12 w-12 rounded-xl bg-neutral-800 flex items-center justify-center text-emerald-400 mb-4">
										<LayoutTemplate className="h-6 w-6" />
									</div>
									<h2 className="text-base font-semibold text-white mb-1.5">
										본문 템플릿을 선택하거나 새로 만드세요
									</h2>
									<p className="text-xs text-neutral-400 leading-relaxed mb-6">
										좌측 목록에서 기존 템플릿을 선택해 수정하거나, 새 템플릿을 생성해 글 작성 시 빠르게 적용할 수 있습니다.
									</p>
									<button
										type="button"
										onClick={handleOpenNew}
										className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition shadow"
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
	);
}

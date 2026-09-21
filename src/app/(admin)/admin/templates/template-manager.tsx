"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BodyTemplate } from "@/cms/adapters/postgres/content-store";
import { CmsEditor } from "@/cms/editor/tiptap-editor";

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
			if (!res.ok) throw new Error("템플릿 목록을 불러오지 못했습니다.");
			const data = await res.json();
			setTemplates(data.items || []);
		} catch (err: any) {
			setError(err.message || "오류가 발생했습니다.");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchTemplates();
	}, []);

	const handleOpenNew = () => {
		setActiveTemplate({ id: undefined, version: 1 });
		setEditName("");
		setEditForCollection("memo");
		setEditMdx("## 문제\n\n\n## 풀이\n\n");
		setSaveError(null);
	};

	const handleSelectTemplate = (t: BodyTemplate) => {
		setActiveTemplate(t);
		setEditName(t.name);
		setEditForCollection(t.forCollection);
		setEditMdx(t.mdx);
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
			if (!activeTemplate?.id) {
				// Create
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
					if (res.status === 409) {
						throw new Error("동일한 컬렉션에 같은 이름의 템플릿이 이미 존재합니다.");
					}
					throw new Error(errData.message || "템플릿 생성 실패");
				}
				const created = await res.json();
				await fetchTemplates();
				setActiveTemplate(created);
			} else {
				// Update
				const res = await fetch(`/api/cms/v1/templates/${activeTemplate.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						expectedVersion: activeTemplate.version,
						name: editName.trim(),
						forCollection: editForCollection,
						mdx: editMdx,
					}),
				});
				if (!res.ok) {
					const errData = await res.json().catch(() => ({}));
					if (res.status === 409) {
						throw new Error("다른 곳에서 이미 수정되었습니다. 최신 버전을 다시 불러와주세요.");
					}
					throw new Error(errData.message || "템플릿 수정 실패");
				}
				const updated = await res.json();
				await fetchTemplates();
				setActiveTemplate(updated);
			}
		} catch (err: any) {
			setSaveError(err.message || "저장 중 오류가 발생했습니다.");
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
		<div className="flex h-screen w-full flex-col bg-neutral-950 text-neutral-200">
			{/* Top Header */}
			<header className="flex h-14 items-center justify-between border-b border-neutral-800 px-6">
				<div className="flex items-center gap-4">
					<Link
						href="/admin"
						className="text-xs font-medium text-neutral-400 hover:text-white transition"
					>
						← 대시보드로 돌아가기
					</Link>
					<span className="text-neutral-700">/</span>
					<h1 className="text-base font-semibold text-white">본문 템플릿 관리</h1>
					<span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
						총 {templates.length}개
					</span>
				</div>
				<button
					type="button"
					onClick={handleOpenNew}
					className="rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition"
				>
					+ 새 템플릿 만들기
				</button>
			</header>

			{/* Main Workspace: Left List + Right Editor */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left List Panel */}
				<div className="w-80 border-r border-neutral-800 flex flex-col bg-neutral-900/30">
					{/* Filter tabs */}
					<div className="flex border-b border-neutral-800 p-2 gap-1 text-xs">
						<button
							type="button"
							onClick={() => setFilterCollection("all")}
							className={`flex-1 rounded py-1.5 font-medium transition ${
								filterCollection === "all"
									? "bg-neutral-800 text-white"
									: "text-neutral-400 hover:text-white"
							}`}
						>
							전체
						</button>
						<button
							type="button"
							onClick={() => setFilterCollection("memo")}
							className={`flex-1 rounded py-1.5 font-medium transition ${
								filterCollection === "memo"
									? "bg-neutral-800 text-white"
									: "text-neutral-400 hover:text-white"
							}`}
						>
							메모용
						</button>
						<button
							type="button"
							onClick={() => setFilterCollection("post")}
							className={`flex-1 rounded py-1.5 font-medium transition ${
								filterCollection === "post"
									? "bg-neutral-800 text-white"
									: "text-neutral-400 hover:text-white"
							}`}
						>
							포스트용
						</button>
					</div>

					{/* Template items list */}
					<div className="flex-1 overflow-y-auto divide-y divide-neutral-800/40">
						{isLoading ? (
							<div className="p-6 text-center text-xs text-neutral-500">불러오는 중...</div>
						) : filtered.length === 0 ? (
							<div className="p-6 text-center text-xs text-neutral-500">
								등록된 템플릿이 없습니다.
							</div>
						) : (
							filtered.map((t) => {
								const isSelected = activeTemplate?.id === t.id;
								return (
									<div
										key={t.id}
										onClick={() => handleSelectTemplate(t)}
										className={`group flex items-center justify-between p-3.5 cursor-pointer transition ${
											isSelected
												? "bg-neutral-800/80 text-white"
												: "hover:bg-neutral-800/40 text-neutral-300"
										}`}
									>
										<div className="flex flex-col gap-1 min-w-0 pr-2">
											<span className="font-medium text-sm truncate">{t.name}</span>
											<div className="flex items-center gap-2 text-xs text-neutral-500">
												<span
													className={`rounded px-1.5 py-0.2 text-[10px] uppercase font-semibold ${
														t.forCollection === "post"
															? "bg-blue-950 text-blue-400 border border-blue-800/50"
															: "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
													}`}
												>
													{t.forCollection}
												</span>
												<span>{new Date(t.updatedAt).toLocaleDateString("ko-KR")}</span>
											</div>
										</div>
										<button
											type="button"
											onClick={(e) => handleDelete(t, e)}
											className="opacity-0 group-hover:opacity-100 rounded p-1 text-neutral-500 hover:bg-neutral-700 hover:text-red-400 transition"
											title="템플릿 삭제"
										>
											<svg
												className="w-4 h-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth="2"
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										</button>
									</div>
								);
							})
						)}
					</div>
				</div>

				{/* Right Detail / Editor Panel */}
				<div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden">
					{activeTemplate ? (
						<div className="flex-1 flex flex-col overflow-hidden">
							{/* Editor Top Toolbar */}
							<div className="flex items-center justify-between border-b border-neutral-800 px-6 py-3 bg-neutral-900/40">
								<div className="flex items-center gap-3 flex-1 max-w-xl">
									<input
										type="text"
										value={editName}
										onChange={(e) => setEditName(e.target.value)}
										placeholder="템플릿 이름 (예: 알고리즘 풀이)"
										className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-600 placeholder-neutral-500"
									/>
									<select
										value={editForCollection}
										onChange={(e) =>
											setEditForCollection(e.target.value as "post" | "memo")
										}
										className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 focus:outline-none focus:border-neutral-600"
									>
										<option value="memo">메모용 (memo)</option>
										<option value="post">포스트용 (post)</option>
									</select>
								</div>

								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={handleCloseEditor}
										className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition whitespace-nowrap"
									>
										닫기
									</button>
									<button
										type="button"
										disabled={isSaving}
										onClick={handleSave}
										className="rounded-md bg-white px-4 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition disabled:opacity-50 whitespace-nowrap"
									>
										{isSaving ? "저장 중..." : activeTemplate.id ? "수정 완료" : "생성하기"}
									</button>
								</div>
							</div>

							{saveError && (
								<div className="bg-red-950/60 border-b border-red-800/80 px-6 py-2 text-xs text-red-300">
									{saveError}
								</div>
							)}

							{/* CmsEditor Component */}
							<div className="flex-1 overflow-y-auto p-6">
								<div className="mx-auto max-w-3xl">
									<div className="mb-2 text-xs text-neutral-500">
										새 글을 작성할 때 삽입될 기본 본문(MDX 골격)을 작성하세요.
									</div>
									<div className="min-h-[500px] rounded-lg border border-neutral-800 bg-neutral-900/20 p-4">
										<CmsEditor
											content={editMdx}
											onChange={(next) => setEditMdx(next)}
										/>
									</div>
								</div>
							</div>
						</div>
					) : (
						<div className="flex-1 flex flex-col items-center justify-center text-neutral-500 text-sm">
							<p>좌측 목록에서 템플릿을 선택하거나</p>
							<p className="mt-1">우측 상단의 '+ 새 템플릿 만들기'를 눌러주세요.</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

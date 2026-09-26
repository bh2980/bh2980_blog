"use client";

import {
	AlertCircle,
	Check,
	CheckCircle,
	Copy,
	ExternalLink,
	File,
	FileText,
	RefreshCw,
	Search,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadImageFile } from "@/cms/editor/upload-helper";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AdminMobileNavigation } from "../admin-mobile-navigation";
import { AdminSidebar } from "../admin-sidebar";

interface MediaItem {
	id: string;
	status: string;
	filename: string;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
	storageKey: string | null;
	publicUrl: string | null;
	createdAt: string;
	referencesCount: number;
	references: {
		entryId: string;
		title: string | null;
		collection: string;
		state: "working" | "published";
	}[];
}

export function MediaLibrary() {
	const [items, setItems] = useState<MediaItem[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [usedFilter, setUsedFilter] = useState<"all" | "used" | "unused">("all");
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [isLoading, setIsLoading] = useState(false);
	const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadPercent, setUploadPercent] = useState(0);
	const [copiedUrl, setCopiedUrl] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState<MediaItem | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);

	const fetchMedia = useCallback(async () => {
		setIsLoading(true);
		setDeleteError(null);
		try {
			const query = new URLSearchParams();
			if (search.trim()) query.set("search", search.trim());
			if (usedFilter !== "all") query.set("used", usedFilter);
			if (typeFilter !== "all") query.set("mimeType", typeFilter);
			query.set("page", String(page));
			query.set("pageSize", "30");

			const res = await fetch(`/api/cms/v1/media?${query.toString()}`);
			if (!res.ok) throw new Error("Failed to load media assets");
			const data = await res.json();
			setItems(data.items || []);
			setTotal(data.total || 0);

			// Refresh selectedMedia if open
			if (selectedMedia) {
				const refreshed = data.items.find((m: MediaItem) => m.id === selectedMedia.id);
				if (refreshed) setSelectedMedia(refreshed);
			}
		} catch (err: any) {
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	}, [search, usedFilter, typeFilter, page, selectedMedia]);

	useEffect(() => {
		const timer = setTimeout(() => {
			fetchMedia();
		}, 200);
		return () => clearTimeout(timer);
	}, [fetchMedia]);

	const handleFileUpload = async (files: FileList | null) => {
		if (!files || files.length === 0) return;
		setIsUploading(true);
		setUploadPercent(0);
		setUploadError(null);

		try {
			for (let i = 0; i < files.length; i++) {
				await uploadImageFile(files[i], (pct) => setUploadPercent(pct));
			}
			await fetchMedia();
		} catch (err) {
			setUploadError(`업로드 실패: ${err instanceof Error ? err.message : "오류가 발생했습니다."}`);
		} finally {
			setIsUploading(false);
			setUploadPercent(0);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const handleDelete = async () => {
		const media = pendingDelete;
		if (!media) return;
		setPendingDelete(null);
		try {
			const res = await fetch(`/api/cms/v1/media/${media.id}`, {
				method: "DELETE",
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message || "Failed to delete");
			}
			setSelectedMedia(null);
			await fetchMedia();
		} catch (err) {
			setDeleteError(`삭제 실패: ${err instanceof Error ? err.message : "오류가 발생했습니다."}`);
		}
	};

	const formatSize = (bytes: number | null) => {
		if (!bytes) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopiedUrl(true);
		setTimeout(() => setCopiedUrl(false), 2000);
	};

	return (
		<div className="flex h-screen overflow-hidden bg-neutral-950 text-neutral-100">
			<div className="hidden lg:flex">
				<AdminSidebar activeNav="media" />
			</div>
			<div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-neutral-950 text-neutral-200">
				{/* Top Header & Actions */}
				<div className="flex flex-wrap items-center justify-between gap-4 border-neutral-800 border-b bg-neutral-900/50 p-4">
					<div className="flex min-w-0 items-center gap-3">
						<div className="lg:hidden">
							<AdminMobileNavigation>
								{(close) => <AdminSidebar activeNav="media" onNavigate={close} />}
							</AdminMobileNavigation>
						</div>
						<Link href="/admin" className="font-medium text-neutral-400 text-xs transition hover:text-white">
							대시보드
						</Link>
						<span className="text-neutral-600">/</span>
						<h1 className="font-semibold text-lg text-white">미디어 라이브러리</h1>
						<span className="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-400 text-xs">총 {total}개</span>
					</div>

					<div className="flex items-center gap-2">
						<input
							type="file"
							ref={fileInputRef}
							multiple
							accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
							className="hidden"
							onChange={(e) => handleFileUpload(e.target.files)}
						/>
						<Button
							type="button"
							size="sm"
							onClick={() => fileInputRef.current?.click()}
							disabled={isUploading}
							className="gap-1.5 bg-blue-600 text-white text-xs hover:bg-blue-500"
						>
							<Upload className="h-3.5 w-3.5" />
							{isUploading ? `업로드 중 (${uploadPercent}%)` : "파일 업로드"}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => fetchMedia()}
							aria-label="미디어 목록 새로고침"
							className="h-8 w-8 border-neutral-700 p-0 text-neutral-400 hover:text-white"
						>
							<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
						</Button>
					</div>
				</div>

				{uploadError && (
					<p role="alert" className="border-neutral-800 border-b px-4 py-2 text-sm">
						{uploadError}
					</p>
				)}
				{/* Search & Filter Bar */}
				<div className="flex flex-wrap items-center gap-3 border-neutral-800/80 border-b bg-neutral-900/20 p-4 text-xs">
					<div className="relative min-w-[200px] max-w-sm flex-1">
						<Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-neutral-500" />
						<Input
							aria-label="파일명 검색"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="파일명 검색..."
							className="h-8 border-neutral-800 bg-neutral-900 pl-8 text-neutral-200 text-xs"
						/>
					</div>

					{/* Usage Filter */}
					<div className="flex items-center rounded-md border border-neutral-800 bg-neutral-900 p-0.5">
						<button
							type="button"
							onClick={() => setUsedFilter("all")}
							className={`rounded px-2.5 py-1 text-xs transition ${
								usedFilter === "all"
									? "bg-neutral-800 font-medium text-white"
									: "text-neutral-400 hover:text-neutral-300"
							}`}
						>
							전체
						</button>
						<button
							type="button"
							onClick={() => setUsedFilter("used")}
							className={`rounded px-2.5 py-1 text-xs transition ${
								usedFilter === "used"
									? "bg-neutral-800 font-medium text-white"
									: "text-neutral-400 hover:text-neutral-300"
							}`}
						>
							사용 중
						</button>
						<button
							type="button"
							onClick={() => setUsedFilter("unused")}
							className={`rounded px-2.5 py-1 text-xs transition ${
								usedFilter === "unused"
									? "bg-neutral-800 font-medium text-amber-300"
									: "text-neutral-400 hover:text-neutral-300"
							}`}
						>
							미사용 (고아)
						</button>
					</div>

					{/* Type Filter */}
					<div className="flex items-center rounded-md border border-neutral-800 bg-neutral-900 p-0.5">
						<button
							type="button"
							onClick={() => setTypeFilter("all")}
							className={`rounded px-2.5 py-1 text-xs transition ${
								typeFilter === "all"
									? "bg-neutral-800 font-medium text-white"
									: "text-neutral-400 hover:text-neutral-300"
							}`}
						>
							모든 형식
						</button>
						<button
							type="button"
							onClick={() => setTypeFilter("image/")}
							className={`rounded px-2.5 py-1 text-xs transition ${
								typeFilter === "image/"
									? "bg-neutral-800 font-medium text-white"
									: "text-neutral-400 hover:text-neutral-300"
							}`}
						>
							이미지
						</button>
					</div>
				</div>

				{/* Main Grid & Side Details Split */}
				<div className="flex flex-1 overflow-hidden">
					{/* Media Grid */}
					<div className="flex-1 overflow-y-auto p-6">
						{items.length === 0 ? (
							<div className="flex h-64 flex-col items-center justify-center gap-2 text-neutral-500">
								<FileText className="h-8 w-8 stroke-[1.5]" />
								<p className="text-sm">조건에 맞는 미디어가 없습니다</p>
							</div>
						) : (
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
								{items.map((media) => {
									const isSelected = selectedMedia?.id === media.id;
									const isUsed = media.referencesCount > 0;

									return (
										// biome-ignore lint/a11y/useSemanticElements: card layout uses button semantics without button reset churn
										<div
											key={media.id}
											role="button"
											tabIndex={0}
											onClick={() => {
												setSelectedMedia(media);
												setDeleteError(null);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													setSelectedMedia(media);
													setDeleteError(null);
												}
											}}
											className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-neutral-900/60 transition-all hover:border-neutral-600 ${
												isSelected ? "border-blue-500 ring-2 ring-blue-500/30" : "border-neutral-800"
											}`}
										>
											{/* Media Thumbnail */}
											<div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-neutral-950">
												{media.publicUrl && media.mimeType?.startsWith("image/") ? (
													// biome-ignore lint/a11y/useAltText: preview thumbnail
													<img
														src={media.publicUrl}
														alt={media.filename}
														className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
														loading="lazy"
													/>
												) : (
													<File className="h-10 w-10 text-neutral-600" />
												)}

												{/* Usage Badge overlay */}
												<div className="absolute top-1.5 right-1.5">
													{isUsed ? (
														<span className="flex items-center gap-1 rounded border border-blue-500/30 bg-neutral-900/80 px-1.5 py-0.5 font-medium text-[10px] text-blue-300 backdrop-blur">
															<CheckCircle className="h-2.5 w-2.5 text-blue-400" />
															{media.referencesCount}
														</span>
													) : (
														<span className="flex items-center gap-1 rounded border border-amber-500/30 bg-neutral-900/80 px-1.5 py-0.5 font-medium text-[10px] text-amber-300 backdrop-blur">
															미사용
														</span>
													)}
												</div>
											</div>

											{/* Filename & Info */}
											<div className="flex flex-col gap-0.5 p-2">
												<span className="truncate font-medium text-neutral-200 text-xs" title={media.filename}>
													{media.filename}
												</span>
												<div className="flex items-center justify-between text-[10px] text-neutral-500">
													<span>{formatSize(media.byteSize)}</span>
													<span>{media.width && media.height ? `${media.width}×${media.height}` : ""}</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* Right Side Inspector Panel */}
					{selectedMedia && (
						<aside className="flex w-80 flex-col overflow-y-auto border-neutral-800 border-l bg-neutral-900/90 backdrop-blur">
							{/* Panel Header */}
							<div className="flex items-center justify-between border-neutral-800 border-b p-4">
								<span className="font-semibold text-neutral-400 text-xs uppercase tracking-wider">
									미디어 상세 정보
								</span>
								<button
									type="button"
									aria-label="미디어 상세 정보 닫기"
									onClick={() => setSelectedMedia(null)}
									className="text-neutral-400 hover:text-white"
								>
									<X className="h-4 w-4" />
								</button>
							</div>

							{/* Preview */}
							<div className="flex flex-col gap-4 p-4">
								<div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
									{selectedMedia.publicUrl && selectedMedia.mimeType?.startsWith("image/") ? (
										// biome-ignore lint/a11y/useAltText: details preview
										<img
											src={selectedMedia.publicUrl}
											alt={selectedMedia.filename}
											className="max-h-full max-w-full object-contain"
										/>
									) : (
										<File className="h-12 w-12 text-neutral-600" />
									)}
								</div>

								{/* Public URL copy */}
								{selectedMedia.publicUrl && (
									<div className="flex items-center gap-2">
										<Input
											readOnly
											value={selectedMedia.publicUrl}
											className="h-7 flex-1 truncate border-neutral-800 bg-neutral-950 font-mono text-neutral-400 text-xs"
										/>
										<Button
											type="button"
											variant="outline"
											size="sm"
											aria-label={copiedUrl ? "미디어 주소 복사됨" : "미디어 주소 복사"}
											className="h-7 border-neutral-800 px-2 hover:text-white"
											onClick={() => copyToClipboard(selectedMedia.publicUrl!)}
										>
											{copiedUrl ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
										</Button>
										<a
											href={selectedMedia.publicUrl}
											aria-label={`새 탭에서 열기: ${selectedMedia.filename}`}
											target="_blank"
											rel="noreferrer"
											className="p-1.5 text-neutral-400 hover:text-white"
										>
											<ExternalLink className="h-3.5 w-3.5" />
										</a>
									</div>
								)}

								{/* Metadata List */}
								<div className="space-y-2 border-neutral-800 border-t border-b py-3 text-xs">
									<div className="flex justify-between">
										<span className="text-neutral-500">파일명</span>
										<span
											className="max-w-[170px] truncate font-medium text-neutral-300"
											title={selectedMedia.filename}
										>
											{selectedMedia.filename}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-neutral-500">MIME 형식</span>
										<span className="font-mono text-[11px] text-neutral-300">
											{selectedMedia.mimeType || "알 수 없음"}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-neutral-500">파일 크기</span>
										<span className="text-neutral-300">{formatSize(selectedMedia.byteSize)}</span>
									</div>
									{selectedMedia.width && selectedMedia.height && (
										<div className="flex justify-between">
											<span className="text-neutral-500">해상도</span>
											<span className="text-neutral-300">
												{selectedMedia.width} × {selectedMedia.height} px
											</span>
										</div>
									)}
									<div className="flex justify-between">
										<span className="text-neutral-500">업로드 일시</span>
										<span className="text-neutral-300">
											{new Date(selectedMedia.createdAt).toLocaleDateString("ko-KR", {
												year: "numeric",
												month: "short",
												day: "numeric",
											})}
										</span>
									</div>
								</div>

								{/* Usage Section */}
								<div className="flex flex-col gap-2">
									<div className="flex items-center justify-between">
										<span className="font-semibold text-neutral-400 text-xs">
											사용처 ({selectedMedia.referencesCount})
										</span>
										{selectedMedia.referencesCount === 0 && (
											<span className="rounded border border-amber-800/40 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-400">
												어느 글에서도 쓰이지 않음
											</span>
										)}
									</div>

									{selectedMedia.referencesCount > 0 ? (
										<div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
											{selectedMedia.references.map((ref) => (
												<a
													key={`${ref.entryId}-${ref.state}`}
													href={`/admin/entries/${ref.entryId}/edit`}
													className="flex flex-col gap-0.5 rounded border border-neutral-800 bg-neutral-950 p-2 text-xs transition hover:bg-neutral-800/80"
												>
													<span className="truncate font-medium text-neutral-200">{ref.title || "(제목 없는 글)"}</span>
													<div className="flex items-center justify-between text-[10px] text-neutral-500">
														<span>컬렉션: {ref.collection}</span>
														<span className={ref.state === "published" ? "text-green-400" : "text-amber-400"}>
															{ref.state === "published" ? "발행본" : "작업 초안"}
														</span>
													</div>
												</a>
											))}
										</div>
									) : (
										<p className="text-neutral-500 text-xs">
											이 이미지는 본문에서 제거되었거나 아직 참조되지 않은 고아 미디어입니다. 안전하게 삭제할 수
											있습니다.
										</p>
									)}
								</div>

								{/* Delete Error Notification */}
								{deleteError && (
									<div
										role="alert"
										className="flex items-start gap-1.5 rounded border border-red-800/60 bg-red-950/50 p-2.5 text-red-300 text-xs"
									>
										<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
										<span>{deleteError}</span>
									</div>
								)}

								{/* Actions */}
								<div className="flex flex-col gap-2 border-neutral-800 border-t pt-2">
									<Button
										type="button"
										variant="destructive"
										size="sm"
										disabled={selectedMedia.referencesCount > 0}
										onClick={() => setPendingDelete(selectedMedia)}
										className="w-full gap-1.5 text-xs disabled:opacity-50"
									>
										<Trash2 className="h-3.5 w-3.5" />
										{selectedMedia.referencesCount > 0 ? "사용 중 (삭제 불가)" : "미디어 영구 삭제"}
									</Button>
									{selectedMedia.referencesCount > 0 && (
										<p className="text-center text-[10px] text-neutral-500">
											글 본문에서 미디어 참조를 먼저 제거해야 삭제할 수 있습니다.
										</p>
									)}
								</div>
							</div>
						</aside>
					)}
				</div>
			</div>
			<Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>미디어 영구 삭제</DialogTitle>
						<DialogDescription>&apos;{pendingDelete?.filename}&apos; 미디어를 영구 삭제하시겠습니까?</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<button
							type="button"
							onClick={() => setPendingDelete(null)}
							className="rounded-md border px-3 py-2 text-sm"
						>
							취소
						</button>
						<button type="button" onClick={() => void handleDelete()} className="rounded-md border px-3 py-2 text-sm">
							삭제
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
	Search,
	Upload,
	Trash2,
	ExternalLink,
	FileText,
	AlertCircle,
	CheckCircle,
	File,
	RefreshCw,
	X,
	Copy,
	Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadImageFile } from "@/cms/editor/upload-helper";

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
	}, [search, usedFilter, typeFilter, page, selectedMedia?.id]);

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

		try {
			for (let i = 0; i < files.length; i++) {
				await uploadImageFile(files[i], (pct) => setUploadPercent(pct));
			}
			await fetchMedia();
		} catch (err: any) {
			alert(`업로드 실패: ${err.message}`);
		} finally {
			setIsUploading(false);
			setUploadPercent(0);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const handleDelete = async (media: MediaItem) => {
		if (media.referencesCount > 0) {
			setDeleteError(`이 미디어는 현재 ${media.referencesCount}개의 글에서 사용 중이므로 삭제할 수 없습니다.`);
			return;
		}

		if (!confirm(`'${media.filename}' 미디어를 영구 삭제하시겠습니까?`)) {
			return;
		}

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
		} catch (err: any) {
			setDeleteError(`삭제 실패: ${err.message}`);
		}
	};

	const formatSize = (bytes: number | null) => {
		if (!bytes) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopiedUrl(true);
		setTimeout(() => setCopiedUrl(false), 2000);
	};

	return (
		<div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-950 text-neutral-200">
			{/* Top Header & Actions */}
			<div className="border-b border-neutral-800 p-4 bg-neutral-900/50 flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<h1 className="text-lg font-semibold text-white">미디어 라이브러리</h1>
					<span className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">
						총 {total}개
					</span>
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
						className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs"
					>
						<Upload className="h-3.5 w-3.5" />
						{isUploading ? `업로드 중 (${uploadPercent}%)` : "파일 업로드"}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => fetchMedia()}
						className="h-8 w-8 p-0 border-neutral-700 text-neutral-400 hover:text-white"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
					</Button>
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className="p-4 border-b border-neutral-800/80 bg-neutral-900/20 flex flex-wrap items-center gap-3 text-xs">
				<div className="relative flex-1 min-w-[200px] max-w-sm">
					<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="파일명 검색..."
						className="pl-8 h-8 text-xs bg-neutral-900 border-neutral-800 text-neutral-200"
					/>
				</div>

				{/* Usage Filter */}
				<div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-md p-0.5">
					<button
						type="button"
						onClick={() => setUsedFilter("all")}
						className={`px-2.5 py-1 rounded text-xs transition ${
							usedFilter === "all" ? "bg-neutral-800 text-white font-medium" : "text-neutral-400 hover:text-neutral-300"
						}`}
					>
						전체
					</button>
					<button
						type="button"
						onClick={() => setUsedFilter("used")}
						className={`px-2.5 py-1 rounded text-xs transition ${
							usedFilter === "used" ? "bg-neutral-800 text-white font-medium" : "text-neutral-400 hover:text-neutral-300"
						}`}
					>
						사용 중
					</button>
					<button
						type="button"
						onClick={() => setUsedFilter("unused")}
						className={`px-2.5 py-1 rounded text-xs transition ${
							usedFilter === "unused" ? "bg-neutral-800 text-amber-300 font-medium" : "text-neutral-400 hover:text-neutral-300"
						}`}
					>
						미사용 (고아)
					</button>
				</div>

				{/* Type Filter */}
				<div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-md p-0.5">
					<button
						type="button"
						onClick={() => setTypeFilter("all")}
						className={`px-2.5 py-1 rounded text-xs transition ${
							typeFilter === "all" ? "bg-neutral-800 text-white font-medium" : "text-neutral-400 hover:text-neutral-300"
						}`}
					>
						모든 형식
					</button>
					<button
						type="button"
						onClick={() => setTypeFilter("image/")}
						className={`px-2.5 py-1 rounded text-xs transition ${
							typeFilter === "image/" ? "bg-neutral-800 text-white font-medium" : "text-neutral-400 hover:text-neutral-300"
						}`}
					>
						이미지
					</button>
				</div>
			</div>

			{/* Main Grid & Side Details Split */}
			<div className="flex-1 flex overflow-hidden">
				{/* Media Grid */}
				<div className="flex-1 p-6 overflow-y-auto">
					{items.length === 0 ? (
						<div className="h-64 flex flex-col items-center justify-center text-neutral-500 gap-2">
							<FileText className="h-8 w-8 stroke-[1.5]" />
							<p className="text-sm">조건에 맞는 미디어가 없습니다</p>
						</div>
					) : (
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
							{items.map((media) => {
								const isSelected = selectedMedia?.id === media.id;
								const isUsed = media.referencesCount > 0;

								return (
									<div
										key={media.id}
										onClick={() => {
											setSelectedMedia(media);
											setDeleteError(null);
										}}
										className={`group relative flex flex-col rounded-lg border overflow-hidden cursor-pointer transition-all bg-neutral-900/60 hover:border-neutral-600 ${
											isSelected ? "border-blue-500 ring-2 ring-blue-500/30" : "border-neutral-800"
										}`}
									>
										{/* Media Thumbnail */}
										<div className="aspect-square w-full bg-neutral-950 flex items-center justify-center overflow-hidden relative">
											{media.publicUrl && media.mimeType?.startsWith("image/") ? (
												// biome-ignore lint/a11y/useAltText: preview thumbnail
												<img
													src={media.publicUrl}
													alt={media.filename}
													className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
													loading="lazy"
												/>
											) : (
												<File className="h-10 w-10 text-neutral-600" />
											)}

											{/* Usage Badge overlay */}
											<div className="absolute top-1.5 right-1.5">
												{isUsed ? (
													<span className="text-[10px] bg-neutral-900/80 text-blue-300 border border-blue-500/30 backdrop-blur px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
														<CheckCircle className="h-2.5 w-2.5 text-blue-400" />
														{media.referencesCount}
													</span>
												) : (
													<span className="text-[10px] bg-neutral-900/80 text-amber-300 border border-amber-500/30 backdrop-blur px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
														미사용
													</span>
												)}
											</div>
										</div>

										{/* Filename & Info */}
										<div className="p-2 flex flex-col gap-0.5">
											<span className="text-xs text-neutral-200 font-medium truncate" title={media.filename}>
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
					<aside className="w-80 border-l border-neutral-800 bg-neutral-900/90 backdrop-blur flex flex-col overflow-y-auto">
						{/* Panel Header */}
						<div className="p-4 border-b border-neutral-800 flex items-center justify-between">
							<span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">미디어 상세 정보</span>
							<button
								type="button"
								onClick={() => setSelectedMedia(null)}
								className="text-neutral-400 hover:text-white"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						{/* Preview */}
						<div className="p-4 flex flex-col gap-4">
							<div className="w-full aspect-video bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-center overflow-hidden">
								{selectedMedia.publicUrl && selectedMedia.mimeType?.startsWith("image/") ? (
									// biome-ignore lint/a11y/useAltText: details preview
									<img
										src={selectedMedia.publicUrl}
										alt={selectedMedia.filename}
										className="max-w-full max-h-full object-contain"
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
										className="h-7 text-xs bg-neutral-950 border-neutral-800 font-mono text-neutral-400 flex-1 truncate"
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-7 px-2 border-neutral-800 hover:text-white"
										onClick={() => copyToClipboard(selectedMedia.publicUrl!)}
									>
										{copiedUrl ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
									</Button>
									<a
										href={selectedMedia.publicUrl}
										target="_blank"
										rel="noreferrer"
										className="p-1.5 text-neutral-400 hover:text-white"
									>
										<ExternalLink className="h-3.5 w-3.5" />
									</a>
								</div>
							)}

							{/* Metadata List */}
							<div className="space-y-2 text-xs border-t border-b border-neutral-800 py-3">
								<div className="flex justify-between">
									<span className="text-neutral-500">파일명</span>
									<span className="text-neutral-300 font-medium truncate max-w-[170px]" title={selectedMedia.filename}>
										{selectedMedia.filename}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-neutral-500">MIME 형식</span>
									<span className="text-neutral-300 font-mono text-[11px]">{selectedMedia.mimeType || "알 수 없음"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-neutral-500">파일 크기</span>
									<span className="text-neutral-300">{formatSize(selectedMedia.byteSize)}</span>
								</div>
								{selectedMedia.width && selectedMedia.height && (
									<div className="flex justify-between">
										<span className="text-neutral-500">해상도</span>
										<span className="text-neutral-300">{selectedMedia.width} × {selectedMedia.height} px</span>
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
									<span className="text-xs font-semibold text-neutral-400">사용처 ({selectedMedia.referencesCount})</span>
									{selectedMedia.referencesCount === 0 && (
										<span className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.5 rounded">
											어느 글에서도 쓰이지 않음
										</span>
									)}
								</div>

								{selectedMedia.referencesCount > 0 ? (
									<div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
										{selectedMedia.references.map((ref, idx) => (
											<a
												key={`${ref.entryId}-${ref.state}-${idx}`}
												href={`/admin/entries/${ref.entryId}/edit`}
												className="p-2 rounded bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 text-xs flex flex-col gap-0.5 transition"
											>
												<span className="text-neutral-200 font-medium truncate">
													{ref.title || "(제목 없는 글)"}
												</span>
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
									<p className="text-xs text-neutral-500">
										이 이미지는 본문에서 제거되었거나 아직 참조되지 않은 고아 미디어입니다. 안전하게 삭제할 수 있습니다.
									</p>
								)}
							</div>

							{/* Delete Error Notification */}
							{deleteError && (
								<div className="p-2.5 rounded bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-start gap-1.5">
									<AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
									<span>{deleteError}</span>
								</div>
							)}

							{/* Actions */}
							<div className="pt-2 border-t border-neutral-800 flex flex-col gap-2">
								<Button
									type="button"
									variant="destructive"
									size="sm"
									disabled={selectedMedia.referencesCount > 0}
									onClick={() => handleDelete(selectedMedia)}
									className="gap-1.5 text-xs w-full disabled:opacity-50"
								>
									<Trash2 className="h-3.5 w-3.5" />
									{selectedMedia.referencesCount > 0 ? "사용 중 (삭제 불가)" : "미디어 영구 삭제"}
								</Button>
								{selectedMedia.referencesCount > 0 && (
									<p className="text-[10px] text-neutral-500 text-center">
										글 본문에서 미디어 참조를 먼저 제거해야 삭제할 수 있습니다.
									</p>
								)}
							</div>
						</div>
					</aside>
				)}
			</div>
		</div>
	);
}

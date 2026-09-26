"use client";

import { Copy, File, RefreshCw, Upload, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { formatBytes, prepareUpload, uploadImageFile } from "@/cms/editor/upload-helper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { parseSeoulDateTimeInput } from "@/libs/contents/published-at";
import { cmsFetch, errorText } from "../admin-api";
import { AdminMobileNavigation } from "../admin-mobile-navigation";
import { AdminSidebar } from "../admin-sidebar";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";

interface MediaItem {
	id: string;
	status: "ready" | "deleting" | "pending" | "failed";
	filename: string;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
	publicUrl: string | null;
	original: { mimeType: string | null; byteSize: number | null; width: number | null; height: number | null } | null;
	defaultAlt: string;
	defaultCaption: string;
	createdAt: string;
	referencesCount: number;
	references: { entryId: string; title: string | null; collection: string; state: "working" | "published" }[];
}

const PAGE_SIZE = 30;
const TYPE_OPTIONS = [
	{ value: "", label: "모든 형식" },
	{ value: "image/jpeg", label: "JPEG" },
	{ value: "image/png", label: "PNG" },
	{ value: "image/webp", label: "WebP" },
	{ value: "image/gif", label: "GIF" },
	{ value: "image/avif", label: "AVIF" },
];

const controlClass = "h-8 rounded-md border border-neutral-800 bg-neutral-900 px-2 text-neutral-200 text-xs";

/** 미디어 라이브러리(§7.3). 썸네일 목록, 파일명 검색, 형식·업로드일·사용 여부 필터, 최신 업로드순. */
export function MediaLibrary() {
	const altId = useId();
	const captionId = useId();
	const [items, setItems] = useState<MediaItem[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [used, setUsed] = useState<"all" | "used" | "unused">("all");
	const [mimeType, setMimeType] = useState("");
	const [uploadedFrom, setUploadedFrom] = useState("");
	const [uploadedTo, setUploadedTo] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [optimize, setOptimize] = useState(false);
	const [upload, setUpload] = useState<{ current: number; total: number; percent: number } | null>(null);
	const [message, setMessage] = useState<{ type: "error" | "status"; text: string } | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const [draft, setDraft] = useState({ alt: "", caption: "" });
	const fileInputRef = useRef<HTMLInputElement>(null);
	const selected = items.find((item) => item.id === selectedId) ?? null;

	const fetchMedia = useCallback(async () => {
		setIsLoading(true);
		try {
			const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), used });
			if (search.trim()) query.set("search", search.trim());
			if (mimeType) query.set("mimeType", mimeType);
			const from = uploadedFrom && parseSeoulDateTimeInput(`${uploadedFrom}T00:00`);
			const to = uploadedTo && parseSeoulDateTimeInput(`${uploadedTo}T23:59`);
			if (from) query.set("uploadedFrom", from);
			if (to) query.set("uploadedTo", new Date(Date.parse(to) + 59_999).toISOString());
			const data = await cmsFetch<{ items: MediaItem[]; total: number }>(`/api/cms/v1/media?${query.toString()}`);
			setItems(data.items);
			setTotal(data.total);
		} catch (error) {
			setMessage({ type: "error", text: errorText(error, "미디어를 불러오지 못했습니다.") });
		} finally {
			setIsLoading(false);
		}
	}, [page, used, search, mimeType, uploadedFrom, uploadedTo]);

	useEffect(() => {
		const timer = setTimeout(() => void fetchMedia(), 200);
		return () => clearTimeout(timer);
	}, [fetchMedia]);

	// 선택이 바뀔 때만 편집 초안을 채운다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by selected id
	useEffect(() => {
		if (selected) setDraft({ alt: selected.defaultAlt, caption: selected.defaultCaption });
	}, [selected?.id]);

	const handleFiles = async (files: FileList | null) => {
		if (!files?.length) return;
		setMessage(null);
		const list = Array.from(files);
		try {
			for (const [index, file] of list.entries()) {
				setUpload({ current: index + 1, total: list.length, percent: 0 });
				const prepared = await prepareUpload(file, { optimize });
				await uploadImageFile(prepared, (percent) => setUpload({ current: index + 1, total: list.length, percent }));
			}
			setMessage({ type: "status", text: `${list.length}개 파일을 올렸습니다.` });
			setPage(1);
			await fetchMedia();
		} catch (error) {
			// 실패한 업로드는 사용 가능 상태가 되지 않는다. 같은 파일로 다시 시도할 수 있다(§7.2).
			setMessage({
				type: "error",
				text: `업로드 실패: ${errorText(error, "오류가 발생했습니다.")} 다시 시도할 수 있습니다.`,
			});
		} finally {
			setUpload(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const deleteMedia = async (media: MediaItem) => {
		try {
			await cmsFetch(`/api/cms/v1/media/${media.id}`, { method: "DELETE", fallback: "삭제하지 못했습니다." });
			setSelectedId(null);
			setMessage({ type: "status", text: `'${media.filename}'을(를) 삭제했습니다.` });
		} catch (error) {
			setMessage({ type: "error", text: errorText(error, "삭제하지 못했습니다.") });
		}
		await fetchMedia();
	};

	const saveDefaults = async () => {
		if (!selected) return;
		try {
			await cmsFetch(`/api/cms/v1/media/${selected.id}`, {
				method: "PATCH",
				json: { defaultAlt: draft.alt, defaultCaption: draft.caption },
			});
			setMessage({ type: "status", text: "기본 설명을 저장했습니다. 이미 작성한 본문은 바뀌지 않습니다." });
			await fetchMedia();
		} catch (error) {
			setMessage({ type: "error", text: errorText(error, "저장하지 못했습니다.") });
		}
	};

	const cleanup = async () => {
		try {
			const result = await cmsFetch<{ removed: number; failed: string[] }>("/api/cms/v1/media/cleanup", {
				method: "POST",
				json: {},
			});
			setMessage({
				type: result.failed.length ? "error" : "status",
				text: `24시간 지난 미완료 업로드 ${result.removed}개를 정리했습니다.${result.failed.length ? ` ${result.failed.length}개는 다음에 다시 시도합니다.` : ""}`,
			});
		} catch (error) {
			setMessage({ type: "error", text: errorText(error, "정리하지 못했습니다.") });
		}
	};

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	return (
		<div className="flex h-screen overflow-hidden bg-neutral-950 text-neutral-100">
			<div className="hidden lg:flex">
				<AdminSidebar activeNav="media" />
			</div>
			<main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
				<header className="flex flex-wrap items-center justify-between gap-3 border-neutral-800 border-b bg-neutral-900/50 p-4">
					<div className="flex items-center gap-3">
						<div className="lg:hidden">
							<AdminMobileNavigation>
								{(close) => <AdminSidebar activeNav="media" onNavigate={close} />}
							</AdminMobileNavigation>
						</div>
						<h1 className="font-semibold text-lg text-white">미디어</h1>
						<span className="text-neutral-400 text-xs">총 {total}개</span>
					</div>
					<div className="flex flex-wrap items-center gap-2 text-xs">
						<label className="flex items-center gap-1.5 text-neutral-300">
							<input type="checkbox" checked={optimize} onChange={(event) => setOptimize(event.target.checked)} />
							웹용 최적화 (원본도 보관)
						</label>
						<input
							ref={fileInputRef}
							type="file"
							multiple
							hidden
							accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
							onChange={(event) => void handleFiles(event.target.files)}
						/>
						<Button
							type="button"
							size="sm"
							disabled={upload !== null}
							onClick={() => fileInputRef.current?.click()}
							className="gap-1.5 text-xs"
						>
							<Upload className="h-3.5 w-3.5" aria-hidden />
							{upload ? `업로드 중 ${upload.current}/${upload.total} (${upload.percent}%)` : "파일 업로드"}
						</Button>
						<Button type="button" size="sm" variant="outline" className="text-xs" onClick={() => void cleanup()}>
							미완료 업로드 정리
						</Button>
						<Button type="button" size="sm" variant="outline" aria-label="새로고침" onClick={() => void fetchMedia()}>
							<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
						</Button>
					</div>
				</header>

				{message && (
					<p
						role={message.type === "error" ? "alert" : "status"}
						className="border-neutral-800 border-b px-4 py-2 text-sm"
					>
						{message.text}
					</p>
				)}

				<div className="flex flex-wrap items-center gap-2 border-neutral-800 border-b p-3 text-xs">
					<Input
						aria-label="파일명 검색"
						value={search}
						placeholder="파일명 검색"
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
						className={`${controlClass} w-56`}
					/>
					<NativeSelect
						aria-label="형식"
						value={mimeType}
						onChange={(event) => {
							setMimeType(event.target.value);
							setPage(1);
						}}
						className={`${controlClass} pr-8`}
					>
						{TYPE_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</NativeSelect>
					<NativeSelect
						aria-label="사용 여부"
						value={used}
						onChange={(event) => {
							setUsed(event.target.value as typeof used);
							setPage(1);
						}}
						className={`${controlClass} pr-8`}
					>
						<option value="all">사용 여부 전체</option>
						<option value="used">사용 중</option>
						<option value="unused">미사용</option>
					</NativeSelect>
					<label className="flex items-center gap-1 text-neutral-400">
						업로드일
						<input
							type="date"
							aria-label="업로드일 시작"
							value={uploadedFrom}
							onChange={(event) => {
								setUploadedFrom(event.target.value);
								setPage(1);
							}}
							className={controlClass}
						/>
						~
						<input
							type="date"
							aria-label="업로드일 끝"
							value={uploadedTo}
							onChange={(event) => {
								setUploadedTo(event.target.value);
								setPage(1);
							}}
							className={controlClass}
						/>
					</label>
				</div>

				<div className="flex min-h-0 flex-1 overflow-hidden">
					<div className="flex-1 overflow-y-auto p-6">
						{items.length === 0 ? (
							<p className="py-16 text-center text-neutral-500 text-sm">
								{isLoading ? "불러오는 중..." : "조건에 맞는 미디어가 없습니다."}
							</p>
						) : (
							<ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
								{items.map((media) => (
									<li key={media.id}>
										<button
											type="button"
											aria-pressed={selectedId === media.id}
											onClick={() => setSelectedId(media.id)}
											className={`flex w-full flex-col overflow-hidden rounded-lg border bg-neutral-900/60 text-left ${
												selectedId === media.id
													? "border-blue-500 ring-2 ring-blue-500/30"
													: "border-neutral-800 hover:border-neutral-600"
											}`}
										>
											<span className="relative flex aspect-square items-center justify-center bg-neutral-950">
												{media.publicUrl ? (
													// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
													<img src={media.publicUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
												) : (
													<File className="h-10 w-10 text-neutral-600" aria-hidden />
												)}
												<span className="absolute top-1.5 right-1.5 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[10px]">
													{media.status === "deleting"
														? "삭제 중"
														: media.referencesCount > 0
															? `사용 ${media.referencesCount}`
															: "미사용"}
												</span>
											</span>
											<span className="truncate p-2 text-neutral-200 text-xs">{media.filename}</span>
										</button>
									</li>
								))}
							</ul>
						)}
						<nav aria-label="페이지 이동" className="mt-4 flex items-center justify-end gap-2 text-xs">
							<Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
								이전
							</Button>
							<span>
								{page} / {totalPages}
							</span>
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={page >= totalPages}
								onClick={() => setPage(page + 1)}
							>
								다음
							</Button>
						</nav>
					</div>

					{selected && (
						<aside
							aria-label="미디어 상세"
							className="flex w-80 flex-col gap-4 overflow-y-auto border-neutral-800 border-l bg-neutral-900/90 p-4 text-xs"
						>
							<div className="flex items-center justify-between">
								<h2 className="font-semibold text-neutral-300">미디어 상세</h2>
								<button type="button" aria-label="상세 닫기" onClick={() => setSelectedId(null)}>
									<X className="h-4 w-4" />
								</button>
							</div>
							{selected.publicUrl && (
								// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
								<img
									src={selected.publicUrl}
									alt=""
									className="max-h-48 rounded border border-neutral-800 object-contain"
								/>
							)}
							<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
								<dt className="text-neutral-500">파일명</dt>
								<dd className="truncate" title={selected.filename}>
									{selected.filename}
								</dd>
								<dt className="text-neutral-500">형식</dt>
								<dd>{selected.mimeType ?? "—"}</dd>
								<dt className="text-neutral-500">공개용</dt>
								<dd>
									{selected.width}×{selected.height} · {formatBytes(selected.byteSize ?? 0)}
								</dd>
								{selected.original && (
									<>
										<dt className="text-neutral-500">원본</dt>
										<dd>
											{selected.original.width}×{selected.original.height} ·{" "}
											{formatBytes(selected.original.byteSize ?? 0)} · {selected.original.mimeType}
										</dd>
									</>
								)}
								<dt className="text-neutral-500">업로드</dt>
								<dd>{new Date(selected.createdAt).toLocaleString("ko-KR")}</dd>
								<dt className="text-neutral-500">미디어 ID</dt>
								<dd className="flex items-center gap-1">
									<code className="truncate">{selected.id}</code>
									<button
										type="button"
										aria-label="미디어 ID 복사"
										onClick={() => void navigator.clipboard.writeText(selected.id)}
									>
										<Copy className="h-3 w-3" />
									</button>
								</dd>
							</dl>

							<form
								className="space-y-2 border-neutral-800 border-t pt-3"
								onSubmit={(event) => {
									event.preventDefault();
									void saveDefaults();
								}}
							>
								<p className="text-neutral-500">본문에 삽입할 때 복사되는 기본값입니다.</p>
								<label htmlFor={altId} className="block font-medium">
									기본 대체 텍스트
								</label>
								<Input
									id={altId}
									value={draft.alt}
									onChange={(event) => setDraft({ ...draft, alt: event.target.value })}
									className="h-7 text-xs"
								/>
								<label htmlFor={captionId} className="block font-medium">
									기본 캡션
								</label>
								<Input
									id={captionId}
									value={draft.caption}
									onChange={(event) => setDraft({ ...draft, caption: event.target.value })}
									className="h-7 text-xs"
								/>
								<Button
									type="submit"
									size="sm"
									variant="outline"
									disabled={selected.status !== "ready"}
									className="text-xs"
								>
									기본값 저장
								</Button>
							</form>

							<section className="space-y-1.5 border-neutral-800 border-t pt-3">
								<h3 className="font-semibold text-neutral-400">사용처 ({selected.referencesCount})</h3>
								{selected.references.map((reference) => (
									<a
										key={`${reference.entryId}-${reference.state}`}
										href={`/admin/entries/${reference.entryId}/edit`}
										className="block rounded border border-neutral-800 p-2 hover:bg-neutral-800/80"
									>
										{reference.title || "(제목 없음)"} · {reference.state === "published" ? "공개본" : "초안"}
									</a>
								))}
								{selected.referencesCount === 0 && <p className="text-neutral-500">초안·공개본에서 쓰이지 않습니다.</p>}
							</section>

							<Button
								type="button"
								variant="destructive"
								size="sm"
								disabled={selected.referencesCount > 0}
								onClick={() =>
									setConfirm({
										title: selected.status === "deleting" ? "삭제 다시 시도" : "미디어 삭제",
										description: `'${selected.filename}' 파일을 삭제합니다. 템플릿이나 해석하지 못한 초안에서 쓰이면 삭제가 보류됩니다.`,
										confirmLabel: "삭제",
										destructive: true,
										onConfirm: () => deleteMedia(selected),
									})
								}
								className="text-xs"
							>
								{selected.referencesCount > 0
									? "사용 중이라 삭제할 수 없음"
									: selected.status === "deleting"
										? "삭제 다시 시도"
										: "삭제"}
							</Button>
						</aside>
					)}
				</div>
			</main>
			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
		</div>
	);
}

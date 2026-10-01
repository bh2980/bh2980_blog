"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, File, FileArchive, FileText, FileType, RefreshCw, Upload, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ALLOWED_IMAGE_MIME_TYPES, FILE_ACCEPT, fileTypeFor, isImageMime } from "@/cms/core/api";
import { type FileKind, fileKindOf, fileTypeLabel, formatFileSize } from "@/cms/core/file-display";
import { formatBytes, prepareUpload, uploadAttachment, uploadImageFile } from "@/cms/editor/upload-helper";
import { type SlotRequest, SlotScope } from "@/cms/slots/slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { parseSeoulDateTimeInput } from "@/libs/contents/published-at";
import { cn } from "@/utils/cn";
import { cmsFetch, errorText } from "../admin-api";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { AdminShell } from "../shared/admin-shell";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { DateRangePicker } from "../shared/date-range-picker";
import { useDebounced } from "../shared/use-debounced";

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
const KIND_OPTIONS = [
	{ value: "all", label: "모든 형식" },
	{ value: "image", label: "이미지" },
	{ value: "file", label: "파일" },
];

const UPLOAD_ACCEPT = `${ALLOWED_IMAGE_MIME_TYPES.join(",")},${FILE_ACCEPT}`;
const FILE_ICONS: Record<FileKind, typeof FileText> = { pdf: FileType, archive: FileArchive, text: FileText };

const MEDIA_KEY = ["cms", "media"] as const;

interface MediaPage {
	items: MediaItem[];
	total: number;
}

const isImageFile = (file: File) => isImageMime(file.type);

const USED_OPTIONS = [
	{ value: "all", label: "사용 여부 전체" },
	{ value: "used", label: "사용 중" },
	{ value: "unused", label: "미사용" },
];

/** 이미지가 아닌 파일의 타일. 형식 아이콘과 형식 이름을 보인다. */
function FileTile({ media }: { media: MediaItem }) {
	const Icon = FILE_ICONS[fileKindOf(media.mimeType)];
	return (
		<span className="flex flex-col items-center gap-1.5 text-muted-foreground">
			<Icon className="size-10" aria-hidden />
			<span className="font-medium text-[10px]">{fileTypeLabel(media.filename, media.mimeType)}</span>
		</span>
	);
}

async function copyPublicUrl(url: string) {
	try {
		await navigator.clipboard.writeText(url);
		toast.success("주소를 복사했습니다.");
	} catch {
		toast.error("복사하지 못했습니다.");
	}
}

/** 새 이름에 원래 파일의 확장자를 붙인다(추천 이름은 확장자 없이 온다). 이미 같은 확장자면 그대로 둔다. */
function withExtension(name: string, original: string): string {
	const extension = /\.[A-Za-z0-9]{1,8}$/.exec(original)?.[0]?.toLowerCase() ?? "";
	return extension && !name.toLowerCase().endsWith(extension) ? `${name}${extension}` : name;
}

/** 미디어 라이브러리(§7.3). 썸네일 목록, 파일명 검색, 형식·업로드일·사용 여부 필터, 최신 업로드순. */
export function MediaLibrary() {
	const altId = useId();
	const captionId = useId();
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [used, setUsed] = useState<"all" | "used" | "unused">("all");
	const [kind, setKind] = useState<"all" | "image" | "file">("all");
	const [uploadedFrom, setUploadedFrom] = useState("");
	const [uploadedTo, setUploadedTo] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [optimize, setOptimize] = useState(false);
	const [upload, setUpload] = useState<{ current: number; total: number; percent: number } | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const [draft, setDraft] = useState({ alt: "", caption: "" });
	const fileInputRef = useRef<HTMLInputElement>(null);

	// 조건을 바꾸는 동안에도 이전 줄을 남겨(`keepPreviousData`) 자리 표시로 깜빡이지 않는다. 자리 표시는 캐시가 없을 때만 보인다.
	const query = useMemo(() => {
		const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), used });
		if (search.trim()) params.set("search", search.trim());
		if (kind !== "all") params.set("kind", kind);
		const from = uploadedFrom && parseSeoulDateTimeInput(`${uploadedFrom}T00:00`);
		const to = uploadedTo && parseSeoulDateTimeInput(`${uploadedTo}T23:59`);
		if (from) params.set("uploadedFrom", from);
		if (to) params.set("uploadedTo", new Date(Date.parse(to) + 59_999).toISOString());
		return params.toString();
	}, [page, used, search, kind, uploadedFrom, uploadedTo]);
	const debouncedQuery = useDebounced(query, 200);
	const mediaQuery = useQuery({
		queryKey: [...MEDIA_KEY, debouncedQuery],
		queryFn: ({ signal }) => cmsFetch<MediaPage>(`/api/cms/v1/media?${debouncedQuery}`, { signal }),
		placeholderData: keepPreviousData,
	});
	const items = mediaQuery.data?.items ?? [];
	const total = mediaQuery.data?.total ?? 0;
	const selected = items.find((item) => item.id === selectedId) ?? null;
	const selectedIsImage = isImageMime(selected?.mimeType);

	const loadError = mediaQuery.error;
	useEffect(() => {
		if (loadError) toast.error(errorText(loadError, "미디어를 불러오지 못했습니다."));
	}, [loadError]);

	/** 목록을 뒤에서 다시 받는다. 지금 보이는 줄은 그대로 둔다. */
	const invalidateMedia = () => queryClient.invalidateQueries({ queryKey: MEDIA_KEY });

	// 선택이 바뀔 때만 편집 초안을 채운다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by selected id
	useEffect(() => {
		if (selected) setDraft({ alt: selected.defaultAlt, caption: selected.defaultCaption });
	}, [selected?.id]);

	const handleFiles = async (files: FileList | null) => {
		if (!files?.length) return;
		const list: File[] = [];
		for (const file of Array.from(files)) {
			if (isImageFile(file) || fileTypeFor(file.name)) list.push(file);
			else toast.error(`'${file.name}'은(는) 올릴 수 없는 형식입니다.`);
		}
		if (list.length === 0) {
			if (fileInputRef.current) fileInputRef.current.value = "";
			return;
		}
		try {
			for (const [index, file] of list.entries()) {
				const onProgress = (percent: number) => setUpload({ current: index + 1, total: list.length, percent });
				setUpload({ current: index + 1, total: list.length, percent: 0 });
				if (isImageFile(file)) {
					const prepared = await prepareUpload(file, { optimize });
					await uploadImageFile(prepared, onProgress);
				} else {
					await uploadAttachment(file, onProgress);
				}
			}
			toast.success(`${list.length}개 파일을 올렸습니다.`);
			setPage(1);
			await invalidateMedia();
		} catch (error) {
			// 실패한 업로드는 사용 가능 상태가 되지 않는다. 같은 파일로 다시 시도할 수 있다(§7.2).
			toast.error(`업로드 실패: ${errorText(error, "오류가 발생했습니다.")} 다시 시도할 수 있습니다.`);
		} finally {
			setUpload(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const deleteMedia = async (media: MediaItem) => {
		// 목록에서 먼저 빼고 요청한다. 실패하면 되돌리고, 끝나면 서버 값으로 맞춘다.
		await queryClient.cancelQueries({ queryKey: MEDIA_KEY });
		const snapshots = queryClient.getQueriesData<MediaPage>({ queryKey: MEDIA_KEY });
		queryClient.setQueriesData<MediaPage>({ queryKey: MEDIA_KEY }, (data) =>
			data?.items.some((item) => item.id === media.id)
				? { items: data.items.filter((item) => item.id !== media.id), total: Math.max(0, data.total - 1) }
				: data,
		);
		setSelectedId((current) => (current === media.id ? null : current));
		try {
			await cmsFetch(`/api/cms/v1/media/${media.id}`, { method: "DELETE", fallback: "삭제하지 못했습니다." });
			toast.success(`'${media.filename}'을(를) 삭제했습니다.`);
		} catch (error) {
			for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
			toast.error(errorText(error, "삭제하지 못했습니다."));
		} finally {
			void invalidateMedia();
		}
	};

	const saveDefaults = async () => {
		if (!selected) return;
		try {
			await cmsFetch(`/api/cms/v1/media/${selected.id}`, {
				method: "PATCH",
				json: { defaultAlt: draft.alt, defaultCaption: draft.caption },
			});
			toast.success("기본 설명을 저장했습니다. 이미 작성한 본문은 바뀌지 않습니다.");
			await invalidateMedia();
		} catch (error) {
			toast.error(errorText(error, "저장하지 못했습니다."));
		}
	};

	const rename = async (media: MediaItem, filename: string) => {
		try {
			await cmsFetch(`/api/cms/v1/media/${media.id}`, { method: "PATCH", json: { filename } });
			toast.success(`이름을 '${filename}'(으)로 바꿨습니다.`);
			await invalidateMedia();
		} catch (error) {
			toast.error(errorText(error, "이름을 바꾸지 못했습니다."));
		}
	};

	/** 미디어 파일 자리. 이미지 내용을 보고 이름·기본 설명을 추천한다. */
	const mediaSlot = (
		media: MediaItem,
		target: "filename" | "defaultAlt" | "defaultCaption",
		apply: (value: string) => void,
	): SlotRequest => ({
		slot: "media",
		target,
		scope: media.id,
		disabled: media.status !== "ready" || !isImageMime(media.mimeType),
		getContext: () => ({
			mediaId: media.id,
			filename: media.filename,
			current: target === "filename" ? media.filename : target === "defaultAlt" ? draft.alt : draft.caption,
		}),
		apply,
	});

	const cleanup = async () => {
		try {
			const result = await cmsFetch<{ removed: number; failed: string[] }>("/api/cms/v1/media/cleanup", {
				method: "POST",
				json: {},
			});
			const text = `24시간 지난 미완료 업로드 ${result.removed}개를 정리했습니다.${result.failed.length ? ` ${result.failed.length}개는 다음에 다시 시도합니다.` : ""}`;
			if (result.failed.length) toast.error(text);
			else toast.success(text);
			void invalidateMedia();
		} catch (error) {
			toast.error(errorText(error, "정리하지 못했습니다."));
		}
	};

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const requestDelete = (media: MediaItem) =>
		setConfirm({
			title: media.status === "deleting" ? "삭제 다시 시도" : "미디어 삭제",
			description: `'${media.filename}' 파일을 삭제합니다. 템플릿이나 해석하지 못한 초안에서 쓰이면 삭제가 보류됩니다.`,
			confirmLabel: "삭제",
			destructive: true,
			onConfirm: () => deleteMedia(media),
		});

	/** 미디어 타일의 오른쪽 클릭·`⋯` 메뉴(v2 A2). */
	const mediaMenu = (media: MediaItem): MenuAction[] => [
		{ kind: "item", label: "상세 보기", onSelect: () => setSelectedId(media.id) },
		{
			kind: "sub",
			label: "사용처",
			emptyLabel: "초안·공개본에서 쓰이지 않습니다",
			items: media.references.map((reference) => ({
				kind: "item" as const,
				label: `${reference.title || "(제목 없음)"} · ${reference.state === "published" ? "공개본" : "초안"}`,
				onSelect: () => window.location.assign(`/admin/entries/${reference.entryId}/edit`),
			})),
		},
		{ kind: "separator" },
		{
			kind: "item",
			label: "삭제",
			destructive: true,
			disabled: media.referencesCount > 0,
			onSelect: () => requestDelete(media),
		},
	];

	const setFilter = (apply: () => void) => {
		apply();
		setPage(1);
	};

	return (
		<AdminShell
			title={
				<span>
					미디어 <span className="font-normal text-muted-foreground text-xs">총 {total}개</span>
				</span>
			}
			sidebar={{ activeNav: "media" }}
			headerActions={
				<div className="flex flex-wrap items-center gap-2">
					<Label className="font-normal text-muted-foreground text-xs">
						<Checkbox checked={optimize} onCheckedChange={(checked) => setOptimize(checked === true)} />
						웹용 최적화
					</Label>
					<input
						ref={fileInputRef}
						type="file"
						multiple
						hidden
						accept={UPLOAD_ACCEPT}
						onChange={(event) => void handleFiles(event.target.files)}
					/>
					<Button type="button" size="sm" disabled={upload !== null} onClick={() => fileInputRef.current?.click()}>
						<Upload aria-hidden />
						{upload ? `업로드 중 ${upload.current}/${upload.total} (${upload.percent}%)` : "파일 업로드"}
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={() => void cleanup()}>
						미완료 업로드 정리
					</Button>
					<Button
						type="button"
						size="icon-sm"
						variant="outline"
						aria-label="새로고침"
						onClick={() => void mediaQuery.refetch()}
					>
						<RefreshCw className={cn(mediaQuery.isFetching && "animate-spin")} aria-hidden />
					</Button>
				</div>
			}
		>
			<div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 lg:px-6">
				<Input
					type="search"
					aria-label="파일명 검색"
					value={search}
					placeholder="파일명 검색"
					onChange={(event) => setFilter(() => setSearch(event.target.value))}
					className="h-8 w-56"
				/>
				<Select
					value={kind}
					items={KIND_OPTIONS}
					onValueChange={(value) => value && setFilter(() => setKind(value as typeof kind))}
				>
					<SelectTrigger size="sm" aria-label="형식">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{KIND_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={used}
					items={USED_OPTIONS}
					onValueChange={(value) => value && setFilter(() => setUsed(value as typeof used))}
				>
					<SelectTrigger size="sm" aria-label="사용 여부">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{USED_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<DateRangePicker
					label="업로드일"
					from={uploadedFrom}
					to={uploadedTo}
					onChange={(from, to) =>
						setFilter(() => {
							setUploadedFrom(from);
							setUploadedTo(to);
						})
					}
				/>
			</div>

			<div className="flex min-h-0 flex-1 overflow-hidden">
				<div className="flex-1 overflow-y-auto p-4 lg:p-6">
					{items.length === 0 ? (
						mediaQuery.isPending ? (
							<ul aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
								{Array.from({ length: 6 }, (_, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: 자리표시
									<li key={index}>
										<Skeleton className="aspect-square w-full rounded-lg" />
									</li>
								))}
							</ul>
						) : (
							<Empty className="py-16">
								<EmptyHeader>
									<EmptyTitle>조건에 맞는 미디어가 없습니다.</EmptyTitle>
								</EmptyHeader>
							</Empty>
						)
					) : (
						<ul
							className={cn(
								"grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6",
								mediaQuery.isPlaceholderData && "opacity-60",
							)}
						>
							{items.map((media) => (
								<ActionContextMenu key={media.id} actions={mediaMenu(media)} trigger={<li className="relative" />}>
									<Button
										variant="outline"
										type="button"
										aria-pressed={selectedId === media.id}
										onClick={() => setSelectedId(media.id)}
										onKeyDown={(event) => {
											if (event.key === "Delete" && media.referencesCount === 0) {
												event.preventDefault();
												requestDelete(media);
											}
										}}
										className={cn(
											"h-auto w-full flex-col items-stretch gap-0 overflow-hidden rounded-lg bg-card p-0 text-left font-normal",
											selectedId === media.id ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/30",
										)}
									>
										<span className="relative flex aspect-square items-center justify-center bg-muted">
											{!isImageMime(media.mimeType) ? (
												<FileTile media={media} />
											) : media.publicUrl ? (
												// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
												<img src={media.publicUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
											) : (
												<File className="size-10 text-muted-foreground" aria-hidden />
											)}
											<Badge variant="secondary" className="absolute top-1.5 left-1.5 text-[10px]">
												{media.status === "deleting"
													? "삭제 중"
													: media.referencesCount > 0
														? `사용 ${media.referencesCount}`
														: "미사용"}
											</Badge>
										</span>
										<span className="truncate p-2 text-xs">{media.filename}</span>
									</Button>
									<MoreActionsButton
										actions={mediaMenu(media)}
										label={`'${media.filename}' 작업`}
										className="absolute top-1 right-1 size-7 bg-background/80"
									/>
								</ActionContextMenu>
							))}
						</ul>
					)}
					<nav aria-label="페이지 이동" className="mt-4 flex items-center justify-end gap-2 text-xs">
						<Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
							이전
						</Button>
						<span className="tabular-nums">
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
						className="flex w-80 flex-col gap-4 overflow-y-auto border-l bg-card p-4 text-xs"
					>
						<div className="flex items-center justify-between">
							<h2 className="font-semibold text-sm">미디어 상세</h2>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label="상세 닫기"
								onClick={() => setSelectedId(null)}
							>
								<X aria-hidden />
							</Button>
						</div>
						{selectedIsImage && selected.publicUrl && (
							// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
							<img src={selected.publicUrl} alt="" className="max-h-48 rounded border object-contain" />
						)}
						<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
							<dt className="text-muted-foreground">파일명</dt>
							<SlotScope
								key={`filename-${selected.id}`}
								request={mediaSlot(
									selected,
									"filename",
									(stem) => void rename(selected, withExtension(stem, selected.filename)),
								)}
							>
								{({ trigger, panel }) => (
									<>
										<dd className="flex min-w-0 items-center gap-1">
											<span className="truncate" title={selected.filename}>
												{selected.filename}
											</span>
											{selectedIsImage && trigger}
										</dd>
										{panel && <dd className="col-span-2">{panel}</dd>}
									</>
								)}
							</SlotScope>
							<dt className="text-muted-foreground">형식</dt>
							<dd>
								{selectedIsImage ? (selected.mimeType ?? "—") : fileTypeLabel(selected.filename, selected.mimeType)}
							</dd>
							{selectedIsImage ? (
								<>
									<dt className="text-muted-foreground">공개용</dt>
									<dd>
										{selected.width}×{selected.height} · {formatBytes(selected.byteSize ?? 0)}
									</dd>
								</>
							) : (
								<>
									<dt className="text-muted-foreground">크기</dt>
									<dd>{formatFileSize(selected.byteSize ?? 0)}</dd>
								</>
							)}
							{selectedIsImage && selected.original && (
								<>
									<dt className="text-muted-foreground">원본</dt>
									<dd>
										{selected.original.width}×{selected.original.height} ·{" "}
										{formatBytes(selected.original.byteSize ?? 0)} · {selected.original.mimeType}
									</dd>
								</>
							)}
							<dt className="text-muted-foreground">업로드</dt>
							<dd>{new Date(selected.createdAt).toLocaleString("ko-KR")}</dd>
							{selected.publicUrl && (
								<>
									<dt className="text-muted-foreground">주소</dt>
									<dd>
										<Button
											type="button"
											variant="outline"
											size="xs"
											onClick={() => void copyPublicUrl(selected.publicUrl as string)}
										>
											<Copy aria-hidden />
											주소 복사
										</Button>
									</dd>
								</>
							)}
							<dt className="text-muted-foreground">미디어 ID</dt>
							<dd className="flex items-center gap-1">
								<code className="truncate">{selected.id}</code>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									aria-label="미디어 ID 복사"
									onClick={() => void navigator.clipboard.writeText(selected.id)}
								>
									<Copy aria-hidden />
								</Button>
							</dd>
						</dl>

						{selectedIsImage && (
							<>
								<Separator />
								<form
									className="space-y-3"
									onSubmit={(event) => {
										event.preventDefault();
										void saveDefaults();
									}}
								>
									<FieldDescription>본문에 삽입할 때 복사되는 기본값입니다.</FieldDescription>
									<SlotScope
										key={`alt-${selected.id}`}
										request={mediaSlot(selected, "defaultAlt", (alt) => setDraft((current) => ({ ...current, alt })))}
									>
										{({ trigger, panel }) => (
											<Field>
												<div className="flex items-center justify-between gap-2">
													<FieldLabel htmlFor={altId}>기본 대체 텍스트</FieldLabel>
													{trigger}
												</div>
												<Input
													id={altId}
													value={draft.alt}
													onChange={(event) => setDraft({ ...draft, alt: event.target.value })}
													className="h-8"
												/>
												{panel}
											</Field>
										)}
									</SlotScope>
									<SlotScope
										key={`caption-${selected.id}`}
										request={mediaSlot(selected, "defaultCaption", (caption) =>
											setDraft((current) => ({ ...current, caption })),
										)}
									>
										{({ trigger, panel }) => (
											<Field>
												<div className="flex items-center justify-between gap-2">
													<FieldLabel htmlFor={captionId}>기본 캡션</FieldLabel>
													{trigger}
												</div>
												<Input
													id={captionId}
													value={draft.caption}
													onChange={(event) => setDraft({ ...draft, caption: event.target.value })}
													className="h-8"
												/>
												{panel}
											</Field>
										)}
									</SlotScope>
									<Button type="submit" size="sm" variant="outline" disabled={selected.status !== "ready"}>
										기본값 저장
									</Button>
								</form>
							</>
						)}

						<Separator />
						<section className="space-y-1.5">
							<h3 className="font-semibold text-muted-foreground">사용처 ({selected.referencesCount})</h3>
							{selected.references.map((reference) => (
								<a
									key={`${reference.entryId}-${reference.state}`}
									href={`/admin/entries/${reference.entryId}/edit`}
									className="block rounded border p-2 hover:bg-accent"
								>
									{reference.title || "(제목 없음)"} · {reference.state === "published" ? "공개본" : "초안"}
								</a>
							))}
							{selected.referencesCount === 0 && (
								<p className="text-muted-foreground">초안·공개본에서 쓰이지 않습니다.</p>
							)}
						</section>

						<Button
							type="button"
							variant="destructive"
							size="sm"
							disabled={selected.referencesCount > 0}
							onClick={() => requestDelete(selected)}
						>
							{selected.status === "deleting" ? "삭제 다시 시도" : "삭제"}
						</Button>
					</aside>
				)}
			</div>
			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
		</AdminShell>
	);
}

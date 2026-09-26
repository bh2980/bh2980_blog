"use client";

import Link from "next/link";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { COLLECTIONS } from "@/cms/core/collections";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cmsFetch } from "../admin-api";
import { AdminSidebar, type AdminSidebarProps } from "../admin-sidebar";

interface AdminNavContextValue {
	/** 모든 컬렉션의 휴지통 항목 수. 불러오기 전이면 null. */
	trashCount: number | null;
	refreshTrashCount: () => void;
}

const AdminNavContext = createContext<AdminNavContextValue | null>(null);

/** 사이드바 휴지통 배지를 다시 계산한다(휴지통 이동·복원·영구 삭제 뒤에 부른다). */
export const useAdminNav = (): AdminNavContextValue =>
	useContext(AdminNavContext) ?? { trashCount: null, refreshTrashCount: () => {} };

async function countTrash(): Promise<number> {
	const totals = await Promise.all(
		COLLECTIONS.map(async (collection) => {
			const query = new URLSearchParams({ collection, status: "trashed", pageSize: "25" });
			const data = await cmsFetch<{ total: number }>(`/api/cms/v1/entries?${query.toString()}`);
			return data.total;
		}),
	);
	return totals.reduce((sum, total) => sum + total, 0);
}

/** 휴지통 배지 상태. 화면의 목록 로직도 이 값을 갱신해야 해서 셸보다 바깥에 둔다. */
export function AdminNavProvider({ children }: { children: ReactNode }) {
	const [trashCount, setTrashCount] = useState<number | null>(null);
	const refreshTrashCount = useCallback(() => {
		countTrash()
			.then(setTrashCount)
			.catch(() => setTrashCount(null));
	}, []);
	useEffect(() => refreshTrashCount(), [refreshTrashCount]);
	const nav = useMemo(() => ({ trashCount, refreshTrashCount }), [trashCount, refreshTrashCount]);
	return <AdminNavContext.Provider value={nav}>{children}</AdminNavContext.Provider>;
}

/**
 * 목록·미디어·템플릿·휴지통 화면이 함께 쓰는 틀(§3.1). 왼쪽은 shadcn Sidebar(좁은 화면에서는 시트),
 * 오른쪽 위에는 사이드바 열기·화면 제목·테마 전환을 둔다. 편집 화면은 Cmd/Ctrl+B(굵게)와 겹치지 않도록 쓰지 않는다.
 */
export function AdminShell({
	title,
	sidebar,
	headerActions,
	children,
}: {
	title: ReactNode;
	sidebar: AdminSidebarProps;
	headerActions?: ReactNode;
	children: ReactNode;
}) {
	const nav = useContext(AdminNavContext);
	if (!nav) {
		return (
			<AdminNavProvider>
				<AdminShell title={title} sidebar={sidebar} headerActions={headerActions}>
					{children}
				</AdminShell>
			</AdminNavProvider>
		);
	}

	return (
		<SidebarProvider className="h-svh overflow-hidden">
			<AdminSidebar {...sidebar} trashCount={nav.trashCount} />
			<SidebarInset className="min-w-0 overflow-hidden">
				<header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
					<SidebarTrigger aria-label="사이드바 열고 닫기" />
					<Separator orientation="vertical" className="mr-1 data-vertical:h-4" />
					<div className="min-w-0 flex-1 truncate font-medium text-sm">{title}</div>
					{headerActions}
					<Link href="/" className="rounded-md px-2 py-1 text-muted-foreground text-xs hover:text-foreground">
						블로그
					</Link>
					<ThemeToggle />
				</header>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

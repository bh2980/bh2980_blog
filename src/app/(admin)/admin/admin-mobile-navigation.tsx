"use client";

import { Menu } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface AdminMobileNavigationProps {
	children: (onNavigate: () => void) => ReactNode;
}

export function AdminMobileNavigation({ children }: AdminMobileNavigationProps) {
	const [open, setOpen] = useState(false);
	const close = () => setOpen(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger
				render={<Button type="button" variant="ghost" size="icon" aria-label="관리자 메뉴 열기" aria-expanded={open} />}
			>
				<Menu aria-hidden="true" className="h-5 w-5" />
			</SheetTrigger>
			<SheetContent side="left" className="w-64 max-w-[85vw] p-0">
				<SheetHeader className="sr-only">
					<SheetTitle>관리자 메뉴</SheetTitle>
					<SheetDescription>관리자 섹션으로 이동합니다.</SheetDescription>
				</SheetHeader>
				{children(close)}
			</SheetContent>
		</Sheet>
	);
}

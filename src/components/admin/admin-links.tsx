import type { Route } from "next";
import Link from "next/link";
import {
	type KeystaticMode,
	getKeystaticAdminHomePath,
	getKeystaticMemoEditPath,
	getKeystaticPostEditPath,
} from "@/libs/admin/keystatic-url";
import { cn } from "@/utils/cn";

type AdminHeaderLinkProps = {
	canManage: boolean;
	className?: string;
};

type AdminEditLinkProps = {
	canManage: boolean;
	collection: "post" | "memo";
	slug: string;
	mode?: KeystaticMode;
	className?: string;
	children?: React.ReactNode;
};

export const AdminHeaderLink = ({ canManage, className }: AdminHeaderLinkProps) => {
	if (!canManage) return null;

	const href = getKeystaticAdminHomePath() as Route;

	return (
		<Link href={href} className={cn(className)}>
			관리자
		</Link>
	);
};

export const AdminEditLink = ({
	canManage,
	collection,
	slug,
	mode = "github",
	className,
	children = "수정",
}: AdminEditLinkProps) => {
	if (!canManage) return null;

	const href = (
		collection === "post"
			? getKeystaticPostEditPath(slug, { mode })
			: getKeystaticMemoEditPath(slug, { mode })
	) as Route;

	return (
		<Link href={href} className={cn(className)}>
			{children}
		</Link>
	);
};

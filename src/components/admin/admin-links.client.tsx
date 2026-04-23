"use client";

import type { ComponentProps } from "react";
import { useAdminContext } from "./admin-context.client";
import { AdminEditLink, AdminHeaderLink } from "./admin-links";

type AdminHeaderLinkClientProps = Omit<ComponentProps<typeof AdminHeaderLink>, "canManage">;

type AdminEditLinkClientProps = Omit<ComponentProps<typeof AdminEditLink>, "canManage" | "mode">;

export const AdminHeaderLinkClient = (props: AdminHeaderLinkClientProps) => {
	const { canManage } = useAdminContext();

	return <AdminHeaderLink {...props} canManage={canManage} />;
};

export const AdminEditLinkClient = (props: AdminEditLinkClientProps) => {
	const { canManage, keystaticMode } = useAdminContext();

	return <AdminEditLink {...props} canManage={canManage} mode={keystaticMode} />;
};

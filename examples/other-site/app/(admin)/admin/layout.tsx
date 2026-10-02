import { CmsAdminLayout } from "@bh2980/cms-admin/next";
import type { ReactNode } from "react";

export { cmsAdminMetadata as metadata } from "@bh2980/cms-admin/next";

export default function AdminLayout({ children }: { children: ReactNode }) {
	return <CmsAdminLayout>{children}</CmsAdminLayout>;
}

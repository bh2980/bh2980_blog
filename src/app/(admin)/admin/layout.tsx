import "@/app/globals.css";
import { CmsAdminLayout } from "@bh2980/cms-admin/next";
import type { ReactNode } from "react";
import { BlogAdminComponents } from "@/cms.admin";

export { cmsAdminMetadata as metadata } from "@bh2980/cms-admin/next";

/** 관리자 화면(`@bh2980/cms-admin`). 이 블로그의 편집기 미리보기 컴포넌트를 넣는다. */
export default function AdminLayout({ children }: { children: ReactNode }) {
	return (
		<CmsAdminLayout>
			<BlogAdminComponents>{children}</BlogAdminComponents>
		</CmsAdminLayout>
	);
}

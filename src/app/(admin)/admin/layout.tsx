import "@/app/globals.css";
import { CmsAdminLayout } from "@monti-cms/admin/next";
import type { ReactNode } from "react";

export { cmsAdminMetadata as metadata } from "@monti-cms/admin/next";

/** 관리자 화면(`@monti-cms/admin`). 편집기 미리보기(Mermaid·차트)는 블록 확장이 그린다. */
export default function AdminLayout({ children }: { children: ReactNode }) {
	return <CmsAdminLayout>{children}</CmsAdminLayout>;
}

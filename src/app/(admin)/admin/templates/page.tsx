import { redirect } from "next/navigation";
import { auth, isAllowedAdminId, isDevAuthBypassEnabled } from "@/cms/adapters/auth";
import { TemplateManager } from "./template-manager";

export default async function AdminTemplatesPage() {
	if (!isDevAuthBypassEnabled()) {
		const session = await auth();

		if (!session?.user?.githubId || !isAllowedAdminId(session.user.githubId)) {
			redirect("/admin/login");
		}
	}

	return <TemplateManager />;
}

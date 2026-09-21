import { redirect } from "next/navigation";
import { auth, isAllowedAdminId, isDevAuthBypassEnabled } from "@/cms/adapters/auth";
import { MediaLibrary } from "./media-library";

export default async function AdminMediaPage() {
	if (!isDevAuthBypassEnabled()) {
		const session = await auth();

		if (!session?.user?.githubId || !isAllowedAdminId(session.user.githubId)) {
			redirect("/admin/login");
		}
	}

	return <MediaLibrary />;
}

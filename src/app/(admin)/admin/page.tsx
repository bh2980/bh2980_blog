import { redirect } from "next/navigation";
import { auth, isAllowedAdminId } from "@/cms/adapters/auth";
import { AdminClientDashboard } from "./admin-dashboard";

export default async function AdminPage() {
	const session = await auth();

	if (!session?.user?.githubId || !isAllowedAdminId(session.user.githubId)) {
		redirect("/admin/login");
	}

	return <AdminClientDashboard />;
}

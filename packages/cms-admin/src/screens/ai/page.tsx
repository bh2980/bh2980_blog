import { requireAdminPage } from "../require-admin";
import { AiManager } from "./ai-manager";

export default async function AdminAiPage() {
	await requireAdminPage();
	return <AiManager />;
}

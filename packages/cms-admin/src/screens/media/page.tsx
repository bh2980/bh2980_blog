import { requireAdminPage } from "../require-admin";
import { MediaLibrary } from "./media-library";

export default async function AdminMediaPage() {
	await requireAdminPage();
	return <MediaLibrary />;
}

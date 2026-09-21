import { authGateway } from "@/cms/adapters/auth";
import { MediaLibrary } from "./media-library";

export default async function AdminMediaPage() {
	await authGateway.verifyAdmin();
	return <MediaLibrary />;
}

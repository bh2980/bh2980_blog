import { isCmsMediaConfigured } from "@bh2980/cms/runtime";
import { Empty, EmptyHeader, EmptyTitle } from "../../ui/empty";
import { MEDIA_NOT_CONFIGURED } from "../api-error-message";
import { requireAdminPage } from "../require-admin";
import { AdminShell } from "../shared/admin-shell";
import { MediaLibrary } from "./media-library";

export default async function AdminMediaPage() {
	await requireAdminPage();
	if (!isCmsMediaConfigured()) {
		return (
			<AdminShell title="미디어" sidebar={{ activeNav: "media" }}>
				<Empty className="py-16">
					<EmptyHeader>
						<EmptyTitle>{MEDIA_NOT_CONFIGURED}</EmptyTitle>
					</EmptyHeader>
				</Empty>
			</AdminShell>
		);
	}
	return <MediaLibrary />;
}

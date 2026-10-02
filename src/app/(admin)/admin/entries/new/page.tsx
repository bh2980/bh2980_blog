import { isCollection } from "@/cms/core/collections";
import { isUuid } from "@/cms/core/ids";
import { requireAdminPage } from "../../require-admin";
import { EntryEditorShell } from "../entry-editor-shell";

interface PageProps {
	searchParams: Promise<{ collection?: string; folder?: string }>;
}

export default async function NewEntryPage({ searchParams }: PageProps) {
	const auth = await requireAdminPage();
	const { collection, folder } = await searchParams;

	return (
		<EntryEditorShell
			mode="new"
			collection={isCollection(collection) ? collection : "post"}
			adminId={auth.userId}
			folderId={isUuid(folder) ? folder : null}
		/>
	);
}

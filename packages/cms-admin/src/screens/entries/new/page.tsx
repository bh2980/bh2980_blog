import { DEFAULT_COLLECTION, isCollection, isUuid } from "@bh2980/cms/client";
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
			collection={isCollection(collection) ? collection : DEFAULT_COLLECTION}
			adminId={auth.userId}
			folderId={isUuid(folder) ? folder : null}
		/>
	);
}

import { DEFAULT_COLLECTION, isCollection } from "@bh2980/cms/core/collections";
import { isUuid } from "@bh2980/cms/core/ids";
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

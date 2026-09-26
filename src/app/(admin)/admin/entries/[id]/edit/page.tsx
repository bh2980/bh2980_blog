import { requireAdminPage } from "../../../require-admin";
import { EntryEditorShell } from "../../entry-editor-shell";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function EditEntryPage({ params }: PageProps) {
	const auth = await requireAdminPage();
	const { id } = await params;

	return <EntryEditorShell mode="edit" initialEntryId={id} adminId={auth.userId} />;
}

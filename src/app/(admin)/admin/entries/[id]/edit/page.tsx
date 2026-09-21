import { authGateway } from "@/cms/adapters/auth";
import { EntryEditorShell } from "../../entry-editor-shell";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function EditEntryPage({ params }: PageProps) {
	await authGateway.verifyAdmin();
	const { id } = await params;

	return <EntryEditorShell mode="edit" initialEntryId={id} />;
}

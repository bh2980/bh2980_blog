import { authGateway } from "@/cms/adapters/auth";
import { EntryEditorShell } from "../entry-editor-shell";

interface PageProps {
	searchParams: Promise<{ collection?: string }>;
}

export default async function NewEntryPage({ searchParams }: PageProps) {
	await authGateway.verifyAdmin();
	const { collection } = await searchParams;

	return <EntryEditorShell mode="new" collection={collection || "post"} />;
}

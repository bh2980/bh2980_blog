import { authGateway } from "@/cms/adapters/auth";
import { EditEntryClient } from "./edit-client";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function EditEntryPage({ params }: PageProps) {
	await authGateway.verifyAdmin();
	const { id } = await params;

	return <EditEntryClient entryId={id} />;
}

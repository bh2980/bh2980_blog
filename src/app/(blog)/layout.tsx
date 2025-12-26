import { cookies, draftMode } from "next/headers";
import { Fragment } from "react";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { isEnabled } = await draftMode();

	const ck = await cookies();
	const branch = ck.get("ks-branch")?.value;

	return (
		<Fragment>
			{children}
			{isEnabled && (
				<div className="fixed inset-x-0 bottom-0 z-50">
					<div className="mx-auto mb-4 max-w-5xl rounded-lg border border-yellow-300 bg-yellow-50/90 px-4 py-3 text-yellow-900 shadow dark:border-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-100">
						<div className="flex items-center justify-between gap-3">
							<div className="text-sm">Draft mode {`(branch: ${branch || "unknown"})`}</div>
							<form method="POST" action="/preview/end">
								<button
									className="rounded-md bg-yellow-600 px-3 py-1.5 text-sm text-white hover:bg-yellow-700"
									type="submit"
								>
									End preview
								</button>
							</form>
						</div>
					</div>
				</div>
			)}
		</Fragment>
	);
}

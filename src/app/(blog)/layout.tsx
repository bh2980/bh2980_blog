import { cookies, draftMode } from "next/headers";
import { Fragment } from "react";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { isEnabled } = await draftMode();
	const branch = (await cookies()).get("branch")?.value;

	return (
		<Fragment>
			{children}
			{isEnabled && (
				<div className="fixed bottom-0 inset-x-0 z-50">
					<div className="mx-auto max-w-5xl px-4 py-3 mb-4 rounded-lg border bg-yellow-50/90 text-yellow-900 border-yellow-300 shadow dark:bg-yellow-900/40 dark:text-yellow-100 dark:border-yellow-700">
						<div className="flex items-center justify-between gap-3">
							<div className="text-sm">Draft mode {`(branch: ${branch})`}</div>
							<form method="POST" action="/preview/end">
								<button
									className="px-3 py-1.5 text-sm rounded-md bg-yellow-600 text-white hover:bg-yellow-700"
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

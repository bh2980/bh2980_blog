export default function Footer() {
	return (
		<footer className="border-slate-200 border-t bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
			<div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
				<div className="text-center text-slate-600 dark:text-slate-400">
					<p>{`© ${new Date().getFullYear()} bh2980's blog. All rights reserved.`}</p>
				</div>
			</div>
		</footer>
	);
}

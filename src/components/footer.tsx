export default function Footer() {
	return (
		<footer className="border-gray-200 border-t bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
			<div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
				<div className="text-center text-gray-600 dark:text-gray-400">
					<p>{`© ${new Date().getFullYear()} bh2980's blog. All rights reserved.`}</p>
				</div>
			</div>
		</footer>
	);
}

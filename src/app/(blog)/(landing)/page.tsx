import Link from "next/link";

export default function Home() {
	return (
		<div className="flex flex-1 items-center justify-center">
			<section className="text-center">
				<h1 className="mb-4 font-bold text-4xl text-gray-900 dark:text-gray-100">안녕하세요, bh2980입니다 👋</h1>
				<p className="mx-auto mb-8 max-w-2xl text-gray-600 text-xl dark:text-gray-300">
					개발하면서 배운 것들과 경험을 공유하는 공간입니다.
				</p>
				<Link
					href="/posts"
					className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
				>
					블로그 둘러보기
				</Link>
			</section>
		</div>
	);
}

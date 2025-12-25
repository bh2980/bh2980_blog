import Link from "next/link";

export default function Home() {
	return (
		<div className="flex-1 flex justify-center items-center">
			<section className="text-center">
				<h1 className="text-4xl font-bold text-gray-900 mb-4 dark:text-gray-100">안녕하세요, bh2980입니다 👋</h1>
				<p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto dark:text-gray-300">
					개발하면서 배운 것들과 경험을 공유하는 공간입니다.
				</p>
				<Link
					href="/posts"
					className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors dark:bg-blue-700 dark:hover:bg-blue-800"
				>
					블로그 둘러보기
				</Link>
			</section>
		</div>
	);
}

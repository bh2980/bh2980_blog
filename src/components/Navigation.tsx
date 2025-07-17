import Link from "next/link";

export default function Navigation() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            href="/"
            className="text-xl font-bold text-gray-900 hover:text-gray-700"
          >
            bh2980's blog
          </Link>
          <div className="flex space-x-8">
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              홈
            </Link>
            <Link
              href="/series"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              묶음글
            </Link>
            <Link
              href="/blog"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              블로그
            </Link>
            <Link
              href="/memo"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              메모장
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

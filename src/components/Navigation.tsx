import Link from "next/link";
import SearchBar from "./SearchBar";

export default function Navigation() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            href="/"
            className="text-xl font-bold text-gray-900 hover:text-gray-700"
          >
            bh2980's blog
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <div className="flex space-x-6">
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
            <SearchBar />
          </div>

          {/* 모바일에서는 간단한 메뉴만 */}
          <div className="md:hidden flex space-x-4">
            <Link
              href="/search"
              className="text-gray-600 hover:text-gray-900"
              aria-label="검색"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

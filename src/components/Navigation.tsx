"use client";

import Link from "next/link";
import { useState } from "react";
import SearchBar from "./SearchBar";

export default function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 dark:bg-gray-950 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            href="/"
            className="text-xl font-bold text-gray-900 hover:text-gray-700 dark:text-gray-100 dark:hover:text-gray-300"
          >
            bh2980's blog
          </Link>

          {/* 데스크톱 메뉴 */}
          <div className="hidden md:flex items-center space-x-8">
            <div className="flex space-x-6">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900 font-medium dark:text-gray-300 dark:hover:text-gray-100"
              >
                홈
              </Link>
              <Link
                href="/series"
                className="text-gray-600 hover:text-gray-900 font-medium dark:text-gray-300 dark:hover:text-gray-100"
              >
                묶음글
              </Link>
              <Link
                href="/posts"
                className="text-gray-600 hover:text-gray-900 font-medium dark:text-gray-300 dark:hover:text-gray-100"
              >
                블로그
              </Link>
              <Link
                href="/memo"
                className="text-gray-600 hover:text-gray-900 font-medium dark:text-gray-300 dark:hover:text-gray-100"
              >
                메모장
              </Link>
            </div>
            <SearchBar />
          </div>

          {/* 모바일 메뉴 버튼 */}
          <div className="md:hidden flex items-center space-x-3">
            <Link
              href="/search"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
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
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              aria-label="메뉴"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* 모바일 드롭다운 메뉴 */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 dark:border-gray-800">
            <div className="flex flex-col space-y-3">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900 font-medium px-3 py-2 dark:text-gray-300 dark:hover:text-gray-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                홈
              </Link>
              <Link
                href="/series"
                className="text-gray-600 hover:text-gray-900 font-medium px-3 py-2 dark:text-gray-300 dark:hover:text-gray-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                묶음글
              </Link>
              <Link
                href="/posts"
                className="text-gray-600 hover:text-gray-900 font-medium px-3 py-2 dark:text-gray-300 dark:hover:text-gray-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                블로그
              </Link>
              <Link
                href="/memo"
                className="text-gray-600 hover:text-gray-900 font-medium px-3 py-2 dark:text-gray-300 dark:hover:text-gray-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                메모장
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

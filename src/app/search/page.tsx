"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { searchContent, type SearchResult } from "@/lib/search";

import { type Memo } from "@/content";

const INITIAL_DISPLAY_COUNT = 3;

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<SearchResult>({
    posts: [],
    series: [],
    memos: [],
    totalCount: 0,
  });
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [showAllSeries, setShowAllSeries] = useState(false);
  const [showAllMemos, setShowAllMemos] = useState(false);

  // URL 검색 파라미터에서 쿼리 가져오기
  useEffect(() => {
    const urlQuery = searchParams.get("q") || "";
    setQuery(urlQuery);
    setSearchInput(urlQuery);
    if (urlQuery) {
      const searchResults = searchContent(urlQuery);
      setResults(searchResults);
    } else {
      setResults({
        posts: [],
        series: [],
        memos: [],
        totalCount: 0,
      });
    }
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const displayedPosts = showAllPosts
    ? results.posts
    : results.posts.slice(0, INITIAL_DISPLAY_COUNT);
  const displayedSeries = showAllSeries
    ? results.series
    : results.series.slice(0, INITIAL_DISPLAY_COUNT);
  const displayedMemos = showAllMemos
    ? results.memos
    : results.memos.slice(0, INITIAL_DISPLAY_COUNT);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 dark:text-gray-100">
          검색 🔍
        </h1>
        <p className="text-lg text-gray-600 mb-6 dark:text-gray-300">
          찾고 있는 게시글, 메모를 검색해보세요.
        </p>

        {/* 검색창 */}
        <form onSubmit={handleSearch} className="relative max-w-md">
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="검색어를 입력하세요..."
              className="w-full px-4 py-3 pl-12 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:focus:ring-blue-600"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
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
            </div>
          </div>
        </form>
      </div>

      {/* 검색 결과 */}
      {query && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              "{query}" 검색 결과
            </h2>
            <span className="text-gray-500 dark:text-gray-400">
              총 {results.totalCount}개 결과
            </span>
          </div>

          {results.totalCount === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33l-.46.46a3 3 0 11-4.24-4.24l.46-.46A7.962 7.962 0 0115 12z"
                  />
                </svg>
              </div>
              <p className="text-lg text-gray-500 mb-2 dark:text-gray-400">
                검색 결과가 없습니다
              </p>
              <p className="text-gray-400 dark:text-gray-500">
                다른 키워드로 다시 시도해보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {/* 게시글 결과 */}
              {results.posts.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      게시글 ({results.posts.length})
                    </h3>
                    {results.posts.length > INITIAL_DISPLAY_COUNT && (
                      <button
                        onClick={() => setShowAllPosts(!showAllPosts)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium dark:text-blue-500 dark:hover:text-blue-600"
                      >
                        {showAllPosts
                          ? "접기"
                          : `${
                              results.posts.length - INITIAL_DISPLAY_COUNT
                            }개 더 보기`}
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {displayedPosts.map((post) => (
                      <Link
                        key={post.slug}
                        href={`/posts/${post.slug}`}
                        className="block"
                      >
                        <article className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md hover:border-gray-300 transition-all dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {post.category}
                            </span>
                            <p className="text-gray-600 text-sm dark:text-gray-400">
                              {new Date(post.createdAt).toLocaleDateString(
                                "ko-KR"
                              )}
                            </p>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-2 dark:text-gray-100">
                            {post.title}
                          </h4>
                          <p className="text-gray-700 mb-4 dark:text-gray-300">
                            {post.excerpt}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {post.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </article>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* 시리즈 결과 */}
              {results.series.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      묶음글 ({results.series.length})
                    </h3>
                    {results.series.length > INITIAL_DISPLAY_COUNT && (
                      <button
                        onClick={() => setShowAllSeries(!showAllSeries)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium dark:text-blue-500 dark:hover:text-blue-600"
                      >
                        {showAllSeries
                          ? "접기"
                          : `${
                              results.series.length - INITIAL_DISPLAY_COUNT
                            }개 더 보기`}
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {displayedSeries.map((seriesItem) => (
                      <article
                        key={seriesItem.slug}
                        className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow dark:bg-gray-900 dark:border-gray-800"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full dark:bg-indigo-900/30 dark:text-indigo-400">
                            묶음글
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {seriesItem.postSlugs.length}개 게시글
                          </span>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2 dark:text-gray-100">
                          <Link
                            href="/series"
                            className="hover:text-indigo-600 dark:hover:text-indigo-500"
                          >
                            {seriesItem.title}
                          </Link>
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300">
                          {seriesItem.description}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* 메모 결과 */}
              {results.memos.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      메모 ({results.memos.length})
                    </h3>
                    {results.memos.length > INITIAL_DISPLAY_COUNT && (
                      <button
                        onClick={() => setShowAllMemos(!showAllMemos)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium dark:text-blue-500 dark:hover:text-blue-600"
                      >
                        {showAllMemos
                          ? "접기"
                          : `${
                              results.memos.length - INITIAL_DISPLAY_COUNT
                            }개 더 보기`}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {displayedMemos.map((memo) => (
                      <Link
                        key={memo.slug}
                        href={`/memo/${memo.slug}`}
                        className="block"
                      >
                        <article className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all flex flex-col h-full dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {memo.category}
                            </span>
                            <time className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(memo.createdAt).toLocaleDateString(
                                "ko-KR",
                                {
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                            </time>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex-1 dark:text-gray-100">
                            {memo.title}
                          </h4>
                          <p className="text-xs text-gray-600 mb-3 line-clamp-2 dark:text-gray-300">
                            {memo.excerpt}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {memo.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400"
                              >
                                #{tag}
                              </span>
                            ))}
                            {memo.tags.length > 2 && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                +{memo.tags.length - 2}
                              </span>
                            )}
                          </div>
                        </article>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* 검색어가 없을 때 */}
      {!query && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-16 w-16"
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
          </div>
          <p className="text-lg text-gray-500 mb-2 dark:text-gray-400">
            검색어를 입력해주세요
          </p>
          <p className="text-gray-400 dark:text-gray-500">
            상단 검색창에서 원하는 내용을 검색할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}

function SearchFallback() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 dark:text-gray-100">
          검색 🔍
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">검색 중...</p>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchContent />
    </Suspense>
  );
}

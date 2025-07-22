"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { searchContent, type SearchResult } from "@/lib/search";
import { categoryLabels, type Memo } from "@/lib/memos";

const INITIAL_DISPLAY_COUNT = 3;

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({
    posts: [],
    series: [],
    memos: [],
    totalCount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [showAllSeries, setShowAllSeries] = useState(false);
  const [showAllMemos, setShowAllMemos] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    setQuery(q);

    if (q) {
      setIsLoading(true);
      const searchResults = searchContent(q);
      setResults(searchResults);
      setIsLoading(false);
      // 새 검색 시 "더 보기" 상태 초기화
      setShowAllPosts(false);
      setShowAllSeries(false);
      setShowAllMemos(false);
    } else {
      setResults({
        posts: [],
        series: [],
        memos: [],
        totalCount: 0,
      });
    }
  }, [searchParams]);

  const getCategoryBadgeColor = (category: Memo["category"]) => {
    const colors = {
      algorithm: "bg-green-100 text-green-800",
      "css-battle": "bg-purple-100 text-purple-800",
      typescript: "bg-blue-100 text-blue-800",
      etc: "bg-gray-100 text-gray-800",
    };
    return colors[category];
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const searchQuery = formData.get("q") as string;

    if (searchQuery.trim()) {
      window.history.pushState(
        {},
        "",
        `/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      setQuery(searchQuery.trim());
      setIsLoading(true);
      const searchResults = searchContent(searchQuery.trim());
      setResults(searchResults);
      setIsLoading(false);
      // 새 검색 시 "더 보기" 상태 초기화
      setShowAllPosts(false);
      setShowAllSeries(false);
      setShowAllMemos(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 페이지 제목 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">검색 🔍</h1>
        
        {/* 모바일용 검색창 */}
        <form onSubmit={handleSearch} className="relative max-w-2xl md:hidden">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="포스트, 묶음글, 메모를 검색해보세요..."
            className="w-full px-6 py-4 pl-12 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        </form>
      </div>

      {/* 검색 결과 */}
      {query && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              "{query}" 검색 결과
            </h2>
            <span className="text-gray-500">
              총 {results.totalCount}개 결과
            </span>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">검색 중...</p>
            </div>
          ) : results.totalCount === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">검색 결과가 없습니다.</p>
              <p className="text-gray-400 mt-2">다른 키워드로 검색해보세요.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {/* 포스트 결과 */}
              {results.posts.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      블로그 포스트 ({results.posts.length})
                    </h3>
                    {results.posts.length > INITIAL_DISPLAY_COUNT && (
                      <button
                        onClick={() => setShowAllPosts(!showAllPosts)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                      <article
                        key={post.slug}
                        className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                      >
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                          <Link
                            href={`/posts/${post.slug}`}
                            className="hover:text-blue-600"
                          >
                            {post.title}
                          </Link>
                        </h4>
                        <p className="text-gray-600 text-sm mb-3">
                          {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                        </p>
                        <p className="text-gray-700 mb-4">{post.excerpt}</p>
                        <div className="flex flex-wrap gap-2">
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* 시리즈 결과 */}
              {results.series.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      묶음글 ({results.series.length})
                    </h3>
                    {results.series.length > INITIAL_DISPLAY_COUNT && (
                      <button
                        onClick={() => setShowAllSeries(!showAllSeries)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                        className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                            묶음글
                          </span>
                          <span className="text-xs text-gray-500">
                            {seriesItem.postSlugs.length}개 포스트
                          </span>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                          <Link
                            href="/series"
                            className="hover:text-indigo-600"
                          >
                            {seriesItem.title}
                          </Link>
                        </h4>
                        <p className="text-gray-700">
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
                    <h3 className="text-lg font-semibold text-gray-900">
                      메모 ({results.memos.length})
                    </h3>
                    {results.memos.length > INITIAL_DISPLAY_COUNT && (
                      <button
                        onClick={() => setShowAllMemos(!showAllMemos)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                      <article
                        key={memo.slug}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col h-full"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryBadgeColor(
                              memo.category
                            )}`}
                          >
                            {categoryLabels[memo.category]}
                          </span>
                          <time className="text-xs text-gray-500">
                            {new Date(memo.date).toLocaleDateString("ko-KR", {
                              month: "short",
                              day: "numeric",
                            })}
                          </time>
                        </div>

                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                          <Link
                            href={`/memo/${memo.slug}`}
                            className="hover:text-blue-600"
                          >
                            {memo.title}
                          </Link>
                        </h4>

                        <p className="text-gray-600 text-sm mb-3 line-clamp-2 flex-grow">
                          {memo.excerpt}
                        </p>

                        <div className="flex flex-wrap gap-1 mt-auto">
                          {memo.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded h-fit"
                            >
                              #{tag}
                            </span>
                          ))}
                          {memo.tags.length > 3 && (
                            <span className="text-xs text-gray-400 h-fit">
                              +{memo.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* 검색 팁 */}
      {!query && (
        <div className="bg-gray-50 rounded-lg p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">검색 팁</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• 포스트 제목, 내용, 태그에서 검색됩니다</li>
            <li>• 묶음글의 제목과 설명에서 검색됩니다</li>
            <li>• 메모의 제목, 내용, 태그에서 검색됩니다</li>
            <li>• 여러 단어로 검색할 때는 띄어쓰기로 구분하세요</li>
          </ul>
        </div>
      )}
    </div>
  );
}

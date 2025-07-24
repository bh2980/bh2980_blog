"use client";

import Link from "next/link";
import { useEffect } from "react";
import { getAllSeries } from "@/lib/series";
import { getPostsBySlugs } from "@/lib/posts";

export default function SeriesPage() {
  const series = getAllSeries();

  useEffect(() => {
    // URL 해시가 있으면 해당 시리즈로 스크롤
    if (typeof window !== "undefined") {
      const hash = window.location.hash.slice(1); // # 제거
      if (hash) {
        const targetElement = document.getElementById(hash);
        if (targetElement) {
          // 약간의 지연 후 스크롤 (페이지 로딩 완료 후)
          setTimeout(() => {
            targetElement.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 100);
        }
      }
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 dark:text-gray-100">
          묶음글 📚
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          연관된 주제별로 정리된 게시글 모음입니다. 체계적으로 학습하고 싶은
          주제를 선택해보세요.
        </p>
      </div>

      <div className="space-y-8">
        {series.map((seriesItem) => {
          // 묶음글에 포함된 게시글들 가져오기
          const posts = getPostsBySlugs(seriesItem.postSlugs);

          return (
            <section
              key={seriesItem.slug}
              id={seriesItem.slug}
              className="bg-gray-50 rounded-lg p-8 border border-gray-200 dark:bg-gray-900 dark:border-gray-800"
            >
              {/* 묶음글 헤더 */}
              <header className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full font-medium dark:bg-indigo-900/30 dark:text-indigo-400">
                    묶음글
                  </span>
                  <time className="text-gray-500 text-sm dark:text-gray-400">
                    {new Date(seriesItem.createdAt).toLocaleDateString(
                      "ko-KR",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </time>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-4 dark:text-gray-100">
                  {seriesItem.title}
                </h2>

                <p className="text-gray-700 leading-relaxed mb-4 dark:text-gray-300">
                  {seriesItem.description}
                </p>

                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <svg
                    className="mr-2 w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                    />
                  </svg>
                  총 {posts.length}개의 게시글
                </div>
              </header>

              {/* 게시글 목록 - 제목만 */}
              <div className="space-y-3">
                {posts.map((post, index) => (
                  <div
                    key={post.slug}
                    className="flex items-center gap-4 py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all dark:bg-gray-800 dark:border-gray-700 dark:hover:border-indigo-600"
                  >
                    <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xs dark:bg-indigo-900/30 dark:text-indigo-400">
                      {index + 1}
                    </div>

                    <div className="flex-1">
                      <Link
                        href={`/posts/${post.slug}?from=series-${seriesItem.slug}`}
                        className="text-gray-900 hover:text-indigo-600 font-medium transition-colors dark:text-gray-100 dark:hover:text-indigo-500"
                      >
                        {post.title}
                      </Link>
                    </div>

                    <time className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(post.createdAt).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                ))}

                {posts.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">
                      이 묶음글에는 아직 게시글이 없습니다.
                    </p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {series.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg dark:text-gray-400">
            아직 작성된 묶음글이 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}

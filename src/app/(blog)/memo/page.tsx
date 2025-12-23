"use client";

import Link from "next/link";
import { useState } from "react";
import { getAllMemos } from "@/libs/memos";
import { type Memo } from "@/content";
import { MEMO_CATEGORIES } from "@/content/categories";

export default function MemoPage() {
  const allMemos = getAllMemos();
  const [selectedCategory, setSelectedCategory] = useState<
    Memo["category"] | "all"
  >("all");

  const memos =
    selectedCategory === "all"
      ? allMemos
      : allMemos.filter((memo) => memo.category === selectedCategory);

  const getTabColor = (category: Memo["category"] | "all") => {
    if (selectedCategory === category) {
      return "bg-blue-600 text-white";
    }
    return "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";
  };

  const getCategoryCount = (category: Memo["category"] | "all") => {
    if (category === "all") return allMemos.length;
    return allMemos.filter((memo) => memo.category === category).length;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 dark:text-gray-100">
          메모장 📝
        </h1>
        <p className="text-lg text-gray-600 mb-8 dark:text-gray-300">
          알고리즘 풀이, CSS 트릭, 간단한 개념 정리 등 작은 메모들을 모아둡니다.
        </p>

        {/* 카테고리 필터 탭 */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${getTabColor(
              "all"
            )}`}
          >
            전체 ({getCategoryCount("all")})
          </button>
          {MEMO_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${getTabColor(
                category
              )}`}
            >
              {category} ({getCategoryCount(category)})
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memos.map((memo) => (
          <Link key={memo.slug} href={`/memo/${memo.slug}`} className="block">
            <article className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md hover:border-gray-300 transition-all flex flex-col h-full dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {memo.category}
                </span>
                <time className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(memo.createdAt).toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>

              <h2 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 dark:text-gray-100">
                {memo.title}
              </h2>

              <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-1 dark:text-gray-300">
                {memo.excerpt}
              </p>

              <div className="flex flex-wrap gap-1 mt-auto">
                {memo.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400"
                  >
                    #{tag}
                  </span>
                ))}
                {memo.tags.length > 3 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    +{memo.tags.length - 3}
                  </span>
                )}
              </div>
            </article>
          </Link>
        ))}
      </div>

      {memos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg dark:text-gray-400">
            {selectedCategory === "all"
              ? "아직 작성된 메모가 없습니다."
              : `${selectedCategory} 카테고리에 메모가 없습니다.`}
          </p>
        </div>
      )}
    </div>
  );
}

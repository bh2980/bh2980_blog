"use client";

import Link from "next/link";
import { useState } from "react";
import { getAllPosts } from "@/lib/posts";
import { type Post } from "@/content";
import { POST_CATEGORIES } from "@/content/categories";

export default function BlogPage() {
  const allPosts = getAllPosts();
  const [selectedCategory, setSelectedCategory] = useState<
    Post["category"] | "all"
  >("all");

  const posts =
    selectedCategory === "all"
      ? allPosts
      : allPosts.filter((post) => post.category === selectedCategory);

  const getTabColor = (category: Post["category"] | "all") => {
    if (selectedCategory === category) {
      return "bg-blue-600 text-white";
    }
    return "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";
  };

  const getCategoryCount = (category: Post["category"] | "all") => {
    if (category === "all") return allPosts.length;
    return allPosts.filter((post) => post.category === category).length;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 dark:text-gray-100">
          블로그
        </h1>
        <p className="text-lg text-gray-600 mb-8 dark:text-gray-300">
          개발하면서 배운 것들과 경험을 기록합니다.
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
          {POST_CATEGORIES.map((category) => (
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

      <div className="space-y-8">
        {posts.map((post) => (
          <Link key={post.slug} href={`/posts/${post.slug}`} className="block">
            <article className="bg-white border border-gray-200 rounded-lg p-8 hover:shadow-lg hover:border-gray-300 transition-all dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {post.category}
                  </span>
                  <time className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(post.createdAt).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-4 dark:text-gray-100">
                {post.title}
              </h2>

              <p className="text-gray-700 leading-relaxed mb-6 dark:text-gray-300">
                {post.excerpt}
              </p>

              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </article>
          </Link>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg dark:text-gray-400">
            아직 작성된 게시글이 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}

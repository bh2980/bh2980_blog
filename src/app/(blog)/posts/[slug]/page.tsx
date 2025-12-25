import Link from "next/link";
import { notFound } from "next/navigation";

import { reader } from "@/keystatic/utils/reader";
import Markdoc from "@markdoc/markdoc";
import React from "react";

interface BlogPostProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BlogPost({ params }: BlogPostProps) {
  const { slug } = await params;
  const rawPost = await reader.collections.post.read(slug);

  if (!rawPost) {
    notFound();
  }

  const post = {
    ...rawPost,
    publishedDate: new Date(rawPost?.publishedDate).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };

  const content = await post.content();

  // TODO : 추후 Mermaid 같은 커스텀 컴포넌트 추가
  // 1) transform (태그/노드 커스텀 없으면 빈 config로도 동작)
  const transformed = Markdoc.transform(content.node);

  // 2) React로 렌더
  const document = Markdoc.renderers.react(transformed, React);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 뒤로 가기 링크 */}
      <div className="mb-8">
        <Link href="/posts" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
          <svg className="mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          뒤로 가기
        </Link>
      </div>

      <article className="prose prose-lg max-w-none">
        {/* 메모 헤더 */}
        <header className="mb-12 pb-8 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              {post.category}
            </span>
            <time className="text-gray-500">{post.publishedDate}</time>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-6 dark:text-gray-100">{post.title}</h1>

          <div className="flex flex-wrap gap-2">
            {post.tags?.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        </header>
        <div className="prose prose-lg max-w-none">{document}</div>
      </article>
    </div>
  );
}

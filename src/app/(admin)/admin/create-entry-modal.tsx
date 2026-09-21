"use client";

import { useState } from "react";

interface CreateEntryModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (title: string) => Promise<void>;
}

export function CreateEntryModal({ isOpen, onClose, onSubmit }: CreateEntryModalProps) {
	const [title, setTitle] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	if (!isOpen) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim() || isSubmitting) return;
		setIsSubmitting(true);
		try {
			await onSubmit(title.trim());
			setTitle("");
			onClose();
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
			<div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
				<h3 className="text-lg font-bold text-neutral-900 dark:text-white">새 항목 만들기</h3>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-xs font-medium text-neutral-500 mb-1.5">제목</label>
						<input
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="새 글의 제목을 입력하세요"
							autoFocus
							className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div className="flex justify-end gap-2.5 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
						>
							취소
						</button>
						<button
							type="submit"
							disabled={!title.trim() || isSubmitting}
							className="px-4 py-2 text-xs font-medium bg-white text-neutral-950 font-semibold rounded-lg hover:bg-neutral-200 disabled:opacity-50 transition"
						>
							{isSubmitting ? "생성 중..." : "만들기"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

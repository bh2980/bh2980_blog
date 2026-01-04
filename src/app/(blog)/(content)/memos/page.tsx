export default function MemoPage() {
	return (
		<div className="mx-auto h-full max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="flex h-full flex-col items-center justify-center py-10 text-center">
				<p className="mb-2 font-medium text-slate-700 dark:text-slate-200">메모를 선택하세요</p>
				<p className="text-slate-500 text-sm dark:text-slate-400">왼쪽 목록에서 메모를 선택하면 내용이 표시됩니다.</p>
			</div>
		</div>
	);
}

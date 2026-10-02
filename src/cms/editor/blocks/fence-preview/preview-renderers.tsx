"use client";

import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { cn } from "@/utils/cn";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: (error: Error) => ReactNode;
	resetKey?: unknown;
}

interface ErrorBoundaryState {
	error: Error | null;
}

export class PreviewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("Preview render error:", error, errorInfo);
	}

	override componentDidUpdate(prevProps: ErrorBoundaryProps) {
		if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
			this.setState({ error: null });
		}
	}

	override render() {
		if (this.state.error) {
			if (this.props.fallback) {
				return this.props.fallback(this.state.error);
			}
			return (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 font-mono text-destructive text-xs">
					{this.state.error.message}
				</div>
			);
		}
		return this.props.children;
	}
}

export function MermaidPreview({ value, className }: { value: string; className?: string }) {
	const [Renderer, setRenderer] = useState<React.ComponentType<{
		children?: ReactNode;
		className?: string;
	}> | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		import("@/components/mdx/mermaid.client")
			.then((mod) => {
				if (!cancelled) setRenderer(() => mod.Mermaid);
			})
			.catch((err: unknown) => {
				if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (loadError) {
		return (
			<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 font-mono text-destructive text-xs">
				Mermaid 모듈 로드 실패: {loadError}
			</div>
		);
	}

	if (!Renderer) {
		return <div className="py-2 text-center text-muted-foreground text-xs">다이어그램 로딩 중...</div>;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return <div className="py-2 text-center text-muted-foreground text-xs italic">Mermaid 다이어그램을 입력하세요</div>;
	}

	return (
		<PreviewErrorBoundary resetKey={trimmed}>
			<div
				className={cn(
					"overflow-x-auto [&_[data-error=true]]:text-destructive [&_[data-error=true]_span]:text-destructive",
					className,
				)}
			>
				<Renderer>{trimmed}</Renderer>
			</div>
		</PreviewErrorBoundary>
	);
}

export function ChartPreview({ value, className }: { value: string; className?: string }) {
	const [Renderer, setRenderer] = useState<React.ComponentType<{
		source?: string;
		className?: string;
	}> | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		import("@/components/mdx/chart")
			.then((mod) => {
				if (!cancelled) setRenderer(() => mod.Chart);
			})
			.catch((err: unknown) => {
				if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (loadError) {
		return (
			<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 font-mono text-destructive text-xs">
				차트 모듈 로드 실패: {loadError}
			</div>
		);
	}

	if (!Renderer) {
		return <div className="py-2 text-center text-muted-foreground text-xs">차트 로딩 중...</div>;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return <div className="py-2 text-center text-muted-foreground text-xs italic">차트 데이터를 입력하세요</div>;
	}

	return (
		<PreviewErrorBoundary resetKey={trimmed}>
			<div className={cn("w-full min-w-0", className)}>
				<Renderer source={trimmed} />
			</div>
		</PreviewErrorBoundary>
	);
}

export function MathPreview({ value, className }: { value: string; className?: string }) {
	const trimmed = value.trim();
	const [html, setHtml] = useState<string>("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		if (!trimmed) {
			setHtml("");
			setError(null);
			return;
		}

		import("katex")
			.then((katexModule) => {
				if (cancelled) return;
				try {
					const katex = katexModule.default ?? katexModule;
					const rendered = katex.renderToString(trimmed, {
						displayMode: true,
						throwOnError: true,
					});
					setHtml(rendered);
					setError(null);
				} catch (err: unknown) {
					setError(err instanceof Error ? err.message : String(err));
					setHtml("");
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err));
					setHtml("");
				}
			});

		return () => {
			cancelled = true;
		};
	}, [trimmed]);

	if (error) {
		return (
			<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 font-mono text-destructive text-xs">
				{error}
			</div>
		);
	}

	if (!value.trim()) {
		return <div className="py-2 text-center text-muted-foreground text-xs italic">수식을 입력하세요</div>;
	}

	return (
		<PreviewErrorBoundary resetKey={trimmed}>
			<div
				className={cn("overflow-x-auto py-2 text-center", className)}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: katex produces safe display math markup
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</PreviewErrorBoundary>
	);
}

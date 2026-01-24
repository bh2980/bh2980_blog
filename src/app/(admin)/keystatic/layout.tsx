import KeystaticApp from "./keystatic";

export default function Layout() {
	return (
		<>
			<style
				// biome-ignore lint/security/noDangerouslySetInnerHtml: 본문 CSS 변수와 에디터 스타일 동기화
				dangerouslySetInnerHTML={{
					__html: `
                        :root {
                            /* Keystatic 내부 폰트 변수 덮어쓰기 */
                            --kui-typography-font-family-base: var(--font-pretendard), sans-serif !important;
                        }

                        .ProseMirror[role="textbox"] {
                            /* 1. 레이아웃 및 너비 (측정값 반영) */
                            max-width: 684px !important;
                            margin: 0 auto !important;
                            padding: 2rem 2rem 50dvh !important;
                            box-sizing: border-box !important;

                            /* 2. 타이포그래피 (본문 CSS 변수 상속) */
                            font-family: var(--font-pretendard) !important;
                            line-height: 2 !important;
                            word-break: break-word !important;
                            font-feature-settings: var(--font-features-base) !important;
                        }

                        /* 숫자 사용할 경우 고정 폭 */
                        .ProseMirror table,
                        .ProseMirror ol,
                        .ProseMirror ul {
                            font-feature-settings: var(--font-features-base), "tnum" 1 !important;
                        }

                        /* 헤딩 스타일 */
                        .ProseMirror h1 {
                            margin: 0 !important;
                            padding: 0 !important;
                            font-size: 2.25em !important;
                            font-weight: 800 !important;
                        }

                        /* 리스트 여백 */
                        .ProseMirror ol, .ProseMirror ul {
                            margin: 2.5rem 0 !important;
                        }

                        /* 이미지 (테마 반지름 변수 활용) */
                        .ProseMirror img {
                            display: block !important;
                            margin: 0 auto !important;
                            border-radius: var(--radius-md) !important;
                            max-width: 100% !important;
                            height: auto !important;
                        }

                        /* inline code */
                        .ProseMirror code {
                            /* 배경 및 테두리 (변수 활용) */
                            background-color: var(--muted) !important;
                            border: 1px solid var(--border) !important;
                            border-radius: var(--radius-sm) !important;
                            
                            /* 간격 및 폰트 */
                            padding: 0 0.25rem !important;
                            font-family: var(--font-mono) !important;
                            font-size: .875em !important;
                            font-weight: 600 !important;
                            
                            /* 케이스틱/프리즘 기본 가상 요소 제거 (필요시) */
                            &::before, &::after {
                                content: none !important;
                            }
                        }

                        .kui-scheme--dark .ProseMirror code {
                            background-color: oklch(0.3729 0.0306 259.7328) !important;
                            border-color: var(--color-gray-600) !important;
                        }

                        /* 링크 스타일 (Primary 컬러 활용) */
                        .ProseMirror a {
                            color: var(--primary) !important;
                            text-decoration: underline !important;
                            text-decoration-color: var(--border) !important;
                            text-underline-offset: 4px !important;
                            position: relative !important;
                        }

                        .ProseMirror a::after {
                            content: "↗" !important;
                            display: inline-block !important;
                            text-decoration: none !important; 
                            font-size: 0.85em !important;
                            color: var(--muted-foreground) !important; /* 흐린 텍스트 색상 */
                            position: relative !important;
                            top: -1px !important; 
                        }

                        .ProseMirror a:hover {
                            text-decoration-color: var(--primary) !important; /* 호버 시 강조색 밑줄 */
                        }

                        .ProseMirror a:hover::after {
                            color: var(--primary) !important;
                            text-decoration: none !important;
                        }

                        /* 커스텀 컴포넌트 */
                        .ProseMirror span[data-component="Underline"],
                        .ProseMirror span[data-component="Tooltip"] {
                            text-decoration: underline !important;
                            text-underline-offset: 4px !important;
                            text-decoration-thickness: 1.5px !important;
                        }

                        .ProseMirror span[data-component="Tooltip"] {
                            text-decoration-style: dotted !important;
                            cursor: help !important;
                            text-decoration-color: var(--border) !important;

                        }
                    `,
				}}
			/>
			<KeystaticApp />
		</>
	);
}

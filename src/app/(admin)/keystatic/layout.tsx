import KeystaticApp from "./keystatic";

export default function Layout() {
	return (
		<>
			<style
				// biome-ignore lint/security/noDangerouslySetInnerHtml: keystatic 에디터 설정 강제 덮어쓰기용
				dangerouslySetInnerHTML={{
					__html: `
                        :root {
                            --kui-typography-font-family-base: var(--font-pretendard), sans-serif !important;
                        }

                        /* 1. 에디터 캔버스 설정: 본문 수치 685.53px 반영 */
                        .ProseMirror[role="textbox"] {
                            font-family: var(--font-pretendard) !important;
                            line-height: 2 !important;
                            word-break: break-word !important;
                            font-feature-settings: 
                                "liga" 1, "calt" 1, "case" 1, "zero" 1, "ss01" 1, "ss02" 1,
                                "ss03" 1, "ss05" 1, "ss06" 1, "ss07" 1, "ss08" 1, "tnum" 1 !important;
                            max-width: 685.53px !important;
                            margin: 0 auto !important;
                            padding: 2rem 2rem 50dvh !important;
                            box-sizing: border-box !important;
                        }

                        /* 2. 커스텀된 prose 상세 스타일 이식 */
                        .ProseMirror h1 {
                            margin: 0 !important;
                            padding: 0 !important;
                            font-size: 2.25em !important;
                            font-weight: 800 !important;
                        }

                        .ProseMirror ol, .ProseMirror ul {
                            margin: 2.5rem 0 !important; /* my-10 */
                        }

                        .ProseMirror img {
                            display: block !important;
                            margin: 0 auto !important;
                            border-radius: 0.375rem !important;
                            max-width: 100% !important;
                            height: auto !important;
                        }

                        /* 3. 커스텀 컴포넌트(Underline, Tooltip) 스타일 */
                        .ProseMirror span[data-component="Underline"],
                        .ProseMirror span[data-component="Tooltip"] {
                            text-decoration: underline !important;
                            text-underline-offset: 4px !important;
                            text-decoration-thickness: 1.5px !important;
                        }

                        .ProseMirror span[data-component="Tooltip"] {
                            text-decoration-style: dotted !important;
                            text-decoration-color: var(--color-slate-400, #94a3b8) !important;
                            cursor: help !important;
                        }
                    `,
				}}
			/>
			<KeystaticApp />
		</>
	);
}

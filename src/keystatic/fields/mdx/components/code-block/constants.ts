import { FaDatabase, FaFileCsv } from "react-icons/fa6";
import { FiFileText } from "react-icons/fi";
import type { IconType } from "react-icons/lib";
import { RiJavaFill, RiTerminalBoxLine } from "react-icons/ri";
import {
	SiCplusplus,
	SiCss3,
	SiDocker,
	SiDotenv,
	SiDotnet,
	SiGnubash,
	SiGo,
	SiGraphql,
	SiHtml5,
	SiJavascript,
	SiJson,
	SiKotlin,
	SiLit,
	SiMdx,
	SiNginx,
	SiPostcss,
	SiPython,
	SiReact,
	SiRust,
	SiSolidity,
	SiSvelte,
	SiSwift,
	SiToml,
	SiTypescript,
	SiVuedotjs,
	SiYaml,
} from "react-icons/si";
import type { AnnotationConfig } from "@/libs/annotation/code-block/types";

// TODO : 나중에 shiki 쪽이랑 통합하면 편할 것 같은데, shiki 쪽에서 타입 제공 안해주나
// TODO : comment prefix 나중에 제거
export const EDITOR_LANG_OPTIONS = [
	// 1. 웹 생태계
	{
		label: "TypeScript",
		value: "ts",
		group: "웹 생태계",
		icon: SiTypescript,
		color: "#3178C6",
		commentPrefix: "//",
	},
	{
		label: "Lit",
		value: "lit",
		group: "웹 생태계",
		icon: SiLit,
		color: "#324FFF",
		commentPrefix: "//",
	},
	{
		label: "JavaScript",
		value: "js",
		group: "웹 생태계",
		icon: SiJavascript,
		color: "#F7DF1E",
		commentPrefix: "//",
	},
	{
		label: "React",
		value: "tsx",
		group: "웹 생태계",
		icon: SiReact,
		color: "#61DAFB",
		commentPrefix: "//",
	},
	{
		label: "Vue",
		value: "vue",
		group: "웹 생태계",
		icon: SiVuedotjs,
		color: "#42B883",
		commentPrefix: "//",
	},
	{
		label: "Svelte",
		value: "svelte",
		group: "웹 생태계",
		icon: SiSvelte,
		color: "#FF3E00",
		commentPrefix: "//",
	},
	{
		label: "HTML",
		value: "html",
		group: "웹 생태계",
		icon: SiHtml5,
		color: "#E34F26",
		commentPrefix: "",
	},
	{
		label: "CSS/SCSS",
		value: "scss",
		group: "웹 생태계",
		icon: SiCss3,
		color: "#CF649A",
		commentPrefix: "//",
	},
	{
		label: "PostCSS",
		value: "postcss",
		group: "웹 생태계",
		icon: SiPostcss,
		color: "#DD3A0A",
		commentPrefix: "/*",
		commentPostfix: " */",
	},

	// 2. 서버 & 시스템
	{
		label: "Python",
		value: "python",
		group: "서버 & 시스템",
		icon: SiPython,
		color: "#3776AB",
		commentPrefix: "#",
	},
	{
		label: "Java",
		value: "java",
		group: "서버 & 시스템",
		icon: RiJavaFill,
		color: "#007396",
		commentPrefix: "//",
	},
	{
		label: "Kotlin",
		value: "kotlin",
		group: "서버 & 시스템",
		icon: SiKotlin,
		color: "#7F52FF",
		commentPrefix: "//",
	},
	{
		label: "Go",
		value: "go",
		group: "서버 & 시스템",
		icon: SiGo,
		color: "#00ADD8",
		commentPrefix: "//",
	},
	{
		label: "Rust",
		value: "rust",
		group: "서버 & 시스템",
		icon: SiRust,
		color: "#DEA584",
		commentPrefix: "//",
	},
	{
		label: "C / C++",
		value: "cpp",
		group: "서버 & 시스템",
		icon: SiCplusplus,
		color: "#00599C",
		commentPrefix: "//",
	},
	{
		label: "C#",
		value: "csharp",
		group: "서버 & 시스템",
		icon: SiDotnet,
		color: "#512BD4",
		commentPrefix: "//",
	},
	{
		label: "Swift",
		value: "swift",
		group: "서버 & 시스템",
		icon: SiSwift,
		color: "#FA7343",
		commentPrefix: "//",
	},
	{
		label: "Solidity",
		value: "solidity",
		group: "서버 & 시스템",
		icon: SiSolidity,
		color: "#363636",
		commentPrefix: "//",
	},

	// 3. 데이터 & 문서
	{
		label: "JSON",
		value: "jsonc",
		group: "데이터 & 문서",
		icon: SiJson,
		color: "#F1E05A",
		commentPrefix: "//",
	},
	{
		label: "YAML",
		value: "yaml",
		group: "데이터 & 문서",
		icon: SiYaml,
		color: "#CB171E",
		commentPrefix: "#",
	},
	{
		label: "TOML",
		value: "toml",
		group: "데이터 & 문서",
		icon: SiToml,
		color: "#9C4221",
		commentPrefix: "#",
	},
	{
		label: "SQL",
		value: "sql",
		group: "데이터 & 문서",
		icon: FaDatabase,
		color: "#336791",
		commentPrefix: "--",
	},
	{
		label: "GraphQL",
		value: "graphql",
		group: "데이터 & 문서",
		icon: SiGraphql,
		color: "#E10098",
		commentPrefix: "#",
	},
	{
		label: "Markdown/MDX",
		value: "mdx",
		group: "데이터 & 문서",
		icon: SiMdx,
		color: "#F9AC00",
		commentPrefix: "",
	},
	{
		label: "CSV",
		value: "csv",
		group: "데이터 & 문서",
		icon: FaFileCsv,
		color: "#2F9D27",
		commentPrefix: "#",
	},
	{
		label: "Plain Text",
		value: "text",
		group: "데이터 & 문서",
		icon: FiFileText,
		color: "#64748B",
		commentPrefix: "//",
	},

	// 4. 인프라 & 도구
	{
		label: "Dockerfile",
		value: "docker",
		group: "인프라 & 도구",
		icon: SiDocker,
		color: "#2496ED",
		commentPrefix: "#",
	},
	{
		label: "Nginx",
		value: "nginx",
		group: "인프라 & 도구",
		icon: SiNginx,
		color: "#009639",
		commentPrefix: "#",
	},
	{
		label: "Bash",
		value: "bash",
		group: "인프라 & 도구",
		icon: SiGnubash,
		color: "#4EAA25",
		commentPrefix: "#",
	},
	{
		label: "PowerShell",
		value: "powershell",
		group: "인프라 & 도구",
		icon: RiTerminalBoxLine,
		color: "#5391FE",
		commentPrefix: "#",
	},
	{
		label: "Env",
		value: "dotenv",
		group: "인프라 & 도구",
		icon: SiDotenv,
		color: "#ECD53F",
		commentPrefix: "#",
	},
] as const satisfies ReadonlyArray<{
	label: string;
	value: string;
	group: string;
	icon: IconType;
	color: string;
	commentPrefix: string;
	commentPostfix?: string;
}>;

export const EDITOR_CODE_BLOCK_NAME = "CodeBlock";

export const EDITOR_CODE_BLOCK_ANNOTATION_CONFIG: AnnotationConfig = {
	annotations: [
		{
			name: "Tooltip",
			kind: "class",
			source: "mdx-text",
			class: "underline decoration-dotted",
			scopes: ["char", "document"],
		},
		{
			name: "strong",
			kind: "class",
			source: "mdx-text",
			class: "font-bold",
			scopes: ["char", "document"],
		},
		{
			name: "em",
			kind: "class",
			source: "mdx-text",
			class: "italic",
			scopes: ["char", "document"],
		},
		{
			name: "del",
			kind: "class",
			source: "mdx-text",
			class: "line-through",
			scopes: ["char", "document"],
		},
		{
			name: "u",
			kind: "class",
			source: "mdx-text",
			class: "underline",
			scopes: ["char", "document"],
		},
		{
			name: "plus",
			kind: "class",
			class: "diff plus",
			scopes: ["line"],
		},
		{
			name: "minus",
			kind: "class",
			class: "diff minus",
			scopes: ["line"],
		},
		{
			name: "Collapsible",
			kind: "render",
			render: "Collapsible",
			scopes: ["line"],
		},
	],
};

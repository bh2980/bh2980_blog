import type { IconType } from "react-icons";
import { FaDatabase, FaFileCsv } from "react-icons/fa6";
import { FiFileText } from "react-icons/fi";
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
	SiMdx,
	SiMermaid,
	SiNginx,
	SiPostcss,
	SiPython,
	SiReact,
	SiRust,
	SiSass,
	SiSolidity,
	SiSvelte,
	SiSwift,
	SiToml,
	SiTypescript,
	SiVuedotjs,
	SiYaml,
} from "react-icons/si";

export const EDITOR_LANG_OPTION = [
	{ label: "TypeScript", value: "ts-tags", depth: 1, icon: SiTypescript, color: "#3178C6" },
	{ label: "React", value: "tsx", depth: 1, icon: SiReact, color: "#61DAFB" },
	{ label: "CSS/SCSS", value: "scss", depth: 1, icon: SiCss3, color: "#CF649A" },
	{ label: "Python", value: "python", depth: 1, icon: SiPython, color: "#3776AB" },
	{ label: "Solidity", value: "solidity", depth: 1, icon: SiSolidity, color: "#363636" },
	{ label: "JSON", value: "jsonc", depth: 1, icon: SiJson, color: "#F1E05A" },
	{ label: "YAML", value: "yaml", depth: 1, icon: SiYaml, color: "#CB171E" },
	{ label: "Bash", value: "bash", depth: 1, icon: SiGnubash, color: "#4EAA25" },
	{ label: "Plain Text", value: "text", depth: 1, icon: FiFileText, color: "#64748B" },

	{ label: "JavaScript", value: "javascript", depth: 2, group: "웹 생태계", icon: SiJavascript, color: "#F7DF1E" },
	{ label: "Vue", value: "vue", depth: 2, group: "웹 생태계", icon: SiVuedotjs, color: "#42B883" },
	{ label: "Svelte", value: "svelte", depth: 2, group: "웹 생태계", icon: SiSvelte, color: "#FF3E00" },

	{ label: "HTML", value: "html", depth: 2, group: "마크업 & 스타일", icon: SiHtml5, color: "#E34F26" },
	{ label: "PostCSS", value: "postcss", depth: 2, group: "마크업 & 스타일", icon: SiPostcss, color: "#DD3A0A" },

	{ label: "Go", value: "go", depth: 2, group: "서버 & 시스템", icon: SiGo, color: "#00ADD8" },
	{ label: "Rust", value: "rust", depth: 2, group: "서버 & 시스템", icon: SiRust, color: "#DEA584" },
	{ label: "Java", value: "java", depth: 2, group: "서버 & 시스템", icon: RiJavaFill, color: "#007396" },
	{ label: "Kotlin", value: "kotlin", depth: 2, group: "서버 & 시스템", icon: SiKotlin, color: "#7F52FF" },
	{ label: "C / C++", value: "cpp", depth: 2, group: "서버 & 시스템", icon: SiCplusplus, color: "#00599C" },
	{ label: "C#", value: "csharp", depth: 2, group: "서버 & 시스템", icon: SiDotnet, color: "#512BD4" },
	{ label: "Swift", value: "swift", depth: 2, group: "서버 & 시스템", icon: SiSwift, color: "#FA7343" },

	{ label: "TOML", value: "toml", depth: 2, group: "데이터 & 설정", icon: SiToml, color: "#9C4221" },
	{ label: "CSV", value: "csv", depth: 2, group: "데이터 & 설정", icon: FaFileCsv, color: "#2F9D27" },
	{ label: "Markdown/MDX", value: "mdx", depth: 2, group: "데이터 & 설정", icon: SiMdx, color: "#F9AC00" },
	{ label: "SQL", value: "sql", depth: 2, group: "데이터 & 설정", icon: FaDatabase, color: "#336791" },
	{ label: "GraphQL", value: "graphql", depth: 2, group: "데이터 & 설정", icon: SiGraphql, color: "#E10098" },

	{
		label: "PowerShell",
		value: "powershell",
		depth: 2,
		group: "인프라 & 도구",
		icon: RiTerminalBoxLine,
		color: "#5391FE",
	},
	{ label: "Dockerfile", value: "docker", depth: 2, group: "인프라 & 도구", icon: SiDocker, color: "#2496ED" },
	{ label: "Nginx", value: "nginx", depth: 2, group: "인프라 & 도구", icon: SiNginx, color: "#009639" },
	{ label: "Env", value: "dotenv", depth: 2, group: "인프라 & 도구", icon: SiDotenv, color: "#ECD53F" },
	{ label: "Mermaid", value: "mermaid", depth: 2, group: "인프라 & 도구", icon: SiMermaid, color: "#FF3670" },
] as const satisfies ReadonlyArray<{
	label: string;
	value: string;
	depth: 1 | 2;
	group?: string;
	icon: IconType;
	color: string;
}>;

export type EditorCodeLang = (typeof EDITOR_LANG_OPTION)[number]["value"];
export type EditorLangOption = (typeof EDITOR_LANG_OPTION)[number];

export const EDITOR_CODE_BLOCK_NAME = "CodeBlock";
export const EDITOR_CODE_BLOCK_THEME = "one-dark-pro" as const;

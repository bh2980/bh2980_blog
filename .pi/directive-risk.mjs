// 지시자 위험 측정: 레거시 본문이 remark-directive 로 어떻게 파싱되는지 확인한다.
// CMS 파이프라인(src/cms/mdx/parse.ts)에 remarkDirective 만 추가해 그대로 재현한다.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

const ROOTS = ["src/contents/posts", "src/contents/memos"];
const DIRECTIVE_TYPES = new Set(["textDirective", "leafDirective", "containerDirective"]);

const stripFrontmatter = (s) => {
	const m = s.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
	return m ? s.slice(m[0].length) : s;
};

const processor = () =>
	unified()
		.use(remarkParse)
		.use(remarkMdx)
		.use(remarkGfm)
		.use(remarkMath, { singleDollarTextMath: false })
		.use(remarkDirective);

const walk = (node, fn) => {
	fn(node);
	if (node.children) for (const c of node.children) walk(c, fn);
};

const files = [];
for (const root of ROOTS) {
	for (const f of readdirSync(root)) if (f.endsWith(".mdx")) files.push(join(root, f));
}
files.sort();

// 1) directive 로 파싱된 노드 전부
const hits = [];
let textLike = 0;
for (const f of files) {
	const raw = stripFrontmatter(readFileSync(f, "utf8"));
	const tree = processor().parse(raw);
	walk(tree, (n) => {
		if (!DIRECTIVE_TYPES.has(n.type)) return;
		hits.push({
			f,
			type: n.type,
			name: n.name,
			line: n.position?.start?.line,
			col: n.position?.start?.column,
			src: raw.slice(n.position.start.offset, n.position.end.offset),
		});
	});
}

console.log(`files=${files.length} parsedDirectives=${hits.length}`);
for (const h of hits) {
	console.log(`  ${h.f}:${h.line}:${h.col} [${h.type}] name=${h.name} :: ${JSON.stringify(h.src)}`);
}

// 2) 산문에 있는 `:글자` 후보를 전부 나열 (코드 제외) — 오인 소지 확인용
const candidates = new Map();
for (const f of files) {
	const raw = stripFrontmatter(readFileSync(f, "utf8"));
	const lines = raw.split("\n");
	let inFence = false;
	lines.forEach((line, i) => {
		if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
		if (inFence) return;
		const stripped = line.replace(/`[^`]*`/g, "");
		for (const m of stripped.matchAll(/:[A-Za-z][A-Za-z0-9-]*/g)) {
			const ctx = stripped.slice(Math.max(0, m.index - 24), m.index + m[0].length + 8);
			const key = m[0];
			if (!candidates.has(key)) candidates.set(key, []);
			candidates.get(key).push(`${f}:${i + 1} :: ...${ctx}...`);
		}
	});
}
console.log(`\nproseCandidates=${candidates.size}`);
for (const [k, v] of [...candidates].sort()) {
	console.log(`  ${k}  x${v.length}`);
	for (const l of v.slice(0, 3)) console.log(`      ${l}`);
}

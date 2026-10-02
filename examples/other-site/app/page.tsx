import Link from "next/link";

export default function Home() {
	return (
		<main style={{ padding: 32, fontFamily: "system-ui" }}>
			<h1>Example site</h1>
			<p>
				<Link href="/admin">관리자 화면</Link>
			</p>
		</main>
	);
}

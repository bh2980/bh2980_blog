import type { PropsWithChildren } from "react";

export const Underline = ({ children }: PropsWithChildren) => {
	return <span className="underline underline-offset-4">{children}</span>;
};

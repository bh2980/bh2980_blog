import type { PropsWithChildren } from "react";

export const Underline = ({ children }: PropsWithChildren) => {
	return <span className="underline">{children}</span>;
};

"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ClassNameValue } from "tailwind-merge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

export const BackButton = ({ className }: { className?: ClassNameValue }) => {
	const router = useRouter();
	return (
		<Button
			variant={"ghost"}
			size="sm"
			className={cn("!p-0 hover:cursor-pointer hover:bg-transparent", className)}
			onClick={() => router.back()}
		>
			<ArrowLeft />
			<span>돌아가기</span>
		</Button>
	);
};

"use client";

import { useEffect, useState } from "react";
import type { KeystaticMode } from "@/libs/admin/keystatic-url";
import { AdminEditLink, AdminHeaderLink } from "./admin-links";

type AdminContextValue = {
	canManage: boolean;
	keystaticMode: KeystaticMode;
};

const DEFAULT_ADMIN_CONTEXT: AdminContextValue = {
	canManage: false,
	keystaticMode: "github",
};

const useAdminContextHydrated = (initialValue: AdminContextValue = DEFAULT_ADMIN_CONTEXT) => {
	const [value, setValue] = useState(initialValue);

	useEffect(() => {
		const controller = new AbortController();

		const loadAdminContext = async () => {
			try {
				const response = await fetch("/api/admin/status", {
					cache: "no-store",
					signal: controller.signal,
				});

				if (!response.ok) {
					return;
				}

				const nextValue = (await response.json()) as AdminContextValue;
				setValue((currentValue) => {
					if (
						currentValue.canManage === nextValue.canManage &&
						currentValue.keystaticMode === nextValue.keystaticMode
					) {
						return currentValue;
					}

					return nextValue;
				});
			} catch (error) {
				if (controller.signal.aborted) {
					return;
				}

				console.error("Failed to load admin context", error);
			}
		};

		void loadAdminContext();

		return () => controller.abort();
	}, []);

	return value;
};

export const AdminHeaderLinkHydrated = ({
	initialCanManage = false,
	className,
}: {
	initialCanManage?: boolean;
	className?: string;
}) => {
	const { canManage } = useAdminContextHydrated({
		canManage: initialCanManage,
		keystaticMode: "github",
	});

	return <AdminHeaderLink canManage={canManage} className={className} />;
};

export const AdminEditLinkHydrated = ({
	collection,
	slug,
	className,
	children,
}: {
	collection: "post" | "memo";
	slug: string;
	className?: string;
	children?: React.ReactNode;
}) => {
	const { canManage, keystaticMode } = useAdminContextHydrated();

	return (
		<AdminEditLink canManage={canManage} collection={collection} slug={slug} mode={keystaticMode} className={className}>
			{children}
		</AdminEditLink>
	);
};

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { KeystaticMode } from "@/libs/admin/keystatic-url";

type AdminContextValue = {
	canManage: boolean;
	keystaticMode: KeystaticMode;
};

const DEFAULT_ADMIN_CONTEXT: AdminContextValue = {
	canManage: false,
	keystaticMode: "github",
};

const AdminContext = createContext<AdminContextValue>(DEFAULT_ADMIN_CONTEXT);

export const AdminContextProvider = ({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) => {
	const [value, setValue] = useState(DEFAULT_ADMIN_CONTEXT);

	useEffect(() => {
		const controller = new AbortController();

		const loadAdminContext = async () => {
			try {
				const response = await fetch("/api/admin/context", {
					cache: "no-store",
					signal: controller.signal,
				});

				if (!response.ok) {
					return;
				}

				const nextValue = (await response.json()) as AdminContextValue;
				setValue(nextValue);
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

	return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export const useAdminContext = () => useContext(AdminContext);

import { useCallback, useEffect, useState } from "react";

export const useIsAdmin = () => {
	const [isAdmin, setIsAdmin] = useState(false);

	const checkIsAdmin = useCallback(async () => {
		const isAdmin = await fetch("/api/admin/access")
			.then((response) => response.json())
			.catch((e) => console.error(e));

		setIsAdmin(isAdmin);
	}, []);

	useEffect(() => {
		checkIsAdmin();
	}, [checkIsAdmin]);

	return isAdmin === true;
};

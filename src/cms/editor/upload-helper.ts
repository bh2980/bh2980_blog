export async function uploadImageFile(
	file: File,
	onProgress?: (percent: number) => void,
): Promise<{ mediaId: string; publicUrl: string; width: number; height: number }> {
	// 1. Request presigned PUT URL
	const prepareRes = await fetch("/api/cms/v1/media/uploads", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			filename: file.name,
			mimeType: file.type,
			byteSize: file.size,
		}),
	});

	if (!prepareRes.ok) {
		const err = await prepareRes.json().catch(() => ({ message: "Failed to prepare upload" }));
		throw new Error(err.message || "Failed to prepare upload");
	}

	const { mediaId, uploadUrl, requiredHeaders } = await prepareRes.json();

	// 2. Upload file directly to R2 via PUT with progress tracking
	await new Promise<void>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", uploadUrl, true);

		if (requiredHeaders) {
			for (const [key, value] of Object.entries(requiredHeaders)) {
				xhr.setRequestHeader(key, value as string);
			}
		}

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable && onProgress) {
				const percent = Math.round((event.loaded / event.total) * 100);
				onProgress(percent);
			}
		};

		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve();
			} else {
				reject(new Error(`Direct storage upload failed with status ${xhr.status}`));
			}
		};

		xhr.onerror = () => reject(new Error("Network error during image upload"));
		xhr.ontimeout = () => reject(new Error("Timeout during image upload"));

		xhr.send(file);
	});

	// 3. Complete and verify on server
	const completeRes = await fetch(`/api/cms/v1/media/${mediaId}/complete`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
	});

	if (!completeRes.ok) {
		const err = await completeRes.json().catch(() => ({ message: "Failed to verify upload" }));
		throw new Error(err.message || "Failed to verify upload");
	}

	const result = await completeRes.json();
	return {
		mediaId: result.mediaId,
		publicUrl: result.publicUrl,
		width: result.width,
		height: result.height,
	};
}

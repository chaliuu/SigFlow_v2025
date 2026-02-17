/**
 * File Utilities
 * Encoding detection and download helpers.
 */

/**
 * Decode an ArrayBuffer, auto-detecting UTF-16 LE/BE or falling back to UTF-8.
 */
export function decodeBufferText(buffer: ArrayBuffer, fileLabel: string): string {
    const bytes = new Uint8Array(buffer);

    const hasUtf16Le =
        bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
    const isSimilarUtf16Le =
        bytes.length >= 4 && bytes[1] === 0x00 && bytes[3] === 0x00;
    const hasUtf16Be =
        bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;

    if (hasUtf16Le || isSimilarUtf16Le) {
        console.log(`Detected UTF-16 LE encoding for ${fileLabel}`);
        return new TextDecoder('utf-16le').decode(buffer);
    }

    if (hasUtf16Be) {
        console.log(`Detected UTF-16 BE encoding for ${fileLabel}`);
        return new TextDecoder('utf-16be').decode(buffer);
    }

    console.log(`Using UTF-8 encoding for ${fileLabel}`);
    return new TextDecoder('utf-8').decode(buffer);
}

/**
 * Read a File as text with automatic encoding detection.
 * Returns the decoded text content.
 */
export function readTextFileWithEncoding(file: File, fileLabel: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);

        reader.onerror = () => {
            reject(new Error(`Failed to read ${fileLabel}: ${reader.error}`));
        };

        reader.onload = () => {
            const result = reader.result as ArrayBuffer;
            const text = decodeBufferText(result, fileLabel);
            resolve(text);
        };
    });
}

/**
 * Download data as a file to the user's machine.
 */
export function downloadFile(data: BlobPart, filename: string, mimeType: string): void {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

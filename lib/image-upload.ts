import imageCompression from "browser-image-compression";

// Panel photo uploads (client side). Compression runs on the main thread:
// the library's web worker downloads its script from cdn.jsdelivr.net, and a
// network that blocks or stalls that request left the upload spinning forever.
const COMPRESSION = {
  fileType: "image/webp",
  maxWidthOrHeight: 1600,
  initialQuality: 0.82,
  useWebWorker: false,
} as const;

export const COMPRESS_TIMEOUT_MS = 60_000;
export const UPLOAD_TIMEOUT_MS = 60_000;

export class TimeoutError extends Error {
  constructor(step: string) {
    super(`${step} timed out`);
    this.name = "TimeoutError";
  }
}

// Rejects when the promise takes longer than `ms`, so the UI never waits forever.
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, step: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(step)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function toWebp(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("not an image");
  return withTimeout(imageCompression(file, COMPRESSION), COMPRESS_TIMEOUT_MS, "compression");
}

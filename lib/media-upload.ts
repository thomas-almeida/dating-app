import {
  MAX_PHOTO_EDGE,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  MEDIA_BUCKET,
} from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

const DURATION_TIMEOUT_MS = 8000;

const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export const VIDEO_ACCEPT = Object.keys(VIDEO_EXTENSIONS).join(",");

// A mensagem pode ir direto para a tela.
export class MediaError extends Error {}

async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Foto sem conteúdo"))),
      "image/jpeg",
      0.85,
    );
  });
}

// Alguns celulares nunca disparam esses eventos. Sem duração, vale só o limite de tamanho.
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, DURATION_TIMEOUT_MS);

    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error("Vídeo ilegível"));
    };
    video.src = url;
  });
}

async function upload(userId: string, file: Blob, extension: string, contentType: string) {
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await createClient()
    .storage.from(MEDIA_BUCKET)
    .upload(path, file, { contentType });
  if (error) throw error;
  return path;
}

export async function uploadPhoto(userId: string, file: File) {
  const blob = await shrinkPhoto(file);
  const path = await upload(userId, blob, "jpg", "image/jpeg");
  return { path, blob };
}

export async function uploadVideo(userId: string, file: File) {
  const extension = VIDEO_EXTENSIONS[file.type];
  if (!extension) throw new MediaError("Use um vídeo em MP4, WebM ou MOV.");
  if (file.size > MAX_VIDEO_BYTES) {
    throw new MediaError("Esse vídeo passa de 50 MB. Escolha um mais curto.");
  }

  const duration = await readDuration(file);
  if (duration !== null && duration > MAX_VIDEO_SECONDS + 1) {
    throw new MediaError(`O vídeo pode ter até ${MAX_VIDEO_SECONDS} segundos.`);
  }

  const path = await upload(userId, file, extension, file.type);
  return { path, blob: file as Blob };
}

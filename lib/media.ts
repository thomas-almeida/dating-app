import "server-only";
import { MEDIA_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeckCard, PublicProfile } from "@/lib/types";

// O bucket é privado. Quem chega aqui já passou pelas RPCs que decidem o que pode ser visto.
export async function signPaths(paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (unique.length === 0) return {} as Record<string, string>;

  const { data } = await createAdminClient()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);

  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}

export async function toDeckCards(profiles: PublicProfile[]): Promise<DeckCard[]> {
  const urls = await signPaths(profiles.flatMap((p) => [p.video_path, ...p.photo_paths]));

  return profiles.map((profile) => ({
    id: profile.id,
    displayName: profile.nickname ?? profile.name,
    age: profile.age,
    bio: profile.bio,
    isPro: profile.is_pro,
    videoUrl: profile.video_path ? (urls[profile.video_path] ?? null) : null,
    posterUrl: profile.photo_paths[0] ? (urls[profile.photo_paths[0]] ?? null) : null,
  }));
}

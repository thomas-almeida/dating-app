import "server-only";
import { placeLabel, sameRegion, tagHobbies } from "@/lib/affinity";
import { churchLabel, MEDIA_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdCard, AdRow, DeckCard, Profile, PublicProfile } from "@/lib/types";

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

export async function toDeckCards(
  profiles: PublicProfile[],
  viewer: Profile,
): Promise<DeckCard[]> {
  const urls = await signPaths(profiles.flatMap((p) => [p.video_path, ...p.photo_paths]));

  return profiles.map((profile) => ({
    id: profile.id,
    displayName: profile.nickname ?? profile.name,
    age: profile.age,
    bio: profile.bio,
    isPro: profile.is_pro,
    videoUrl: profile.video_path ? (urls[profile.video_path] ?? null) : null,
    posterUrl: profile.photo_paths[0] ? (urls[profile.photo_paths[0]] ?? null) : null,
    place: placeLabel(profile),
    hobbies: tagHobbies(viewer.hobbies, profile.hobbies),
    sameRegion: sameRegion(viewer, profile),
    church: churchLabel(profile.church),
    sameChurch: profile.church !== null && profile.church === viewer.church,
  }));
}

// O anúncio só entra no deck com a imagem assinada: sem URL, o card não tem o que mostrar.
export async function toAdCards(ads: AdRow[]): Promise<AdCard[]> {
  const urls = await signPaths(ads.map((ad) => ad.image_path));

  return ads.flatMap((ad) => {
    const imageUrl = urls[ad.image_path];
    if (!imageUrl) return [];
    return [{
      id: ad.id,
      title: ad.title,
      description: ad.description,
      imageUrl,
      targetUrl: ad.target_url,
    }];
  });
}

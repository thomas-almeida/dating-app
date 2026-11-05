"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DECK_SIZE, MEDIA_BUCKET, STORY_TTL_HOURS } from "@/lib/config";
import { requireMember } from "@/lib/dal";
import { signPaths, toDeckCards } from "@/lib/media";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  DeckCard,
  PublicProfile,
  StoryAudienceMember,
  StoryAudienceRow,
  StoryMediaType,
  SwipeAction,
} from "@/lib/types";

export type SwipeResult = { ok: true; match: boolean } | { ok: false };

export type StoryResult = { ok: true } | { ok: false; message: string };

const swipeSchema = z.object({
  targetId: z.uuid(),
  action: z.enum(["like", "pass"]),
});

const storySchema = z.object({
  path: z.string().min(1),
  type: z.enum(["image", "video"]),
});

const storyIdSchema = z.uuid();

const STORY_FAILED = "Não deu para postar. Tente de novo.";

// O post_story devolve estes códigos em error.message.
const STORY_ERRORS: Record<string, string> = {
  story_limit: "Você já postou seu story de hoje. Com o Pro, não há limite.",
  foreign_media: "Não reconhecemos esse arquivo. Envie de novo.",
};

// Sem requireMember: a RPC já exige sessão e perfil completo, e o swipe precisa ser rápido.
export async function recordSwipe(targetId: string, action: SwipeAction): Promise<SwipeResult> {
  const parsed = swipeSchema.safeParse({ targetId, action });
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_swipe", {
    p_target: parsed.data.targetId,
    p_action: parsed.data.action,
  });

  if (error) {
    console.error("recordSwipe", error);
    return { ok: false };
  }

  return { ok: true, match: data === true };
}

export async function loadMoreCards(): Promise<DeckCard[] | null> {
  await requireMember();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discover_profiles", { p_limit: DECK_SIZE });

  if (error) {
    console.error("loadMoreCards", error);
    return null;
  }

  return toDeckCards(data as PublicProfile[]);
}

// Quem posta limpa os próprios stories vencidos, para eles não ocuparem o Storage para sempre.
async function removeExpiredStories(userId: string) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STORY_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("stories")
    .delete()
    .eq("user_id", userId)
    .lt("created_at", cutoff)
    .select("media_path");

  if (error) {
    console.error("removeExpiredStories", error);
    return;
  }

  if (data.length > 0) {
    await admin.storage.from(MEDIA_BUCKET).remove(data.map(({ media_path }) => media_path));
  }
}

export async function publishStory(path: string, type: StoryMediaType): Promise<StoryResult> {
  const { user } = await requireMember();

  const parsed = storySchema.safeParse({ path, type });
  if (!parsed.success) return { ok: false, message: STORY_FAILED };

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_story", {
    p_media_path: parsed.data.path,
    p_media_type: parsed.data.type,
  });

  if (error) {
    // O arquivo já subiu: sem o story, ele ficaria sem uso no Storage.
    await supabase.storage.from(MEDIA_BUCKET).remove([parsed.data.path]);

    const message = STORY_ERRORS[error.message];
    if (!message) console.error("publishStory", error);
    return { ok: false, message: message ?? STORY_FAILED };
  }

  await removeExpiredStories(user.id);
  revalidatePath("/inicio");
  return { ok: true };
}

export async function markStoryViewed(storyId: string) {
  const parsed = storyIdSchema.safeParse(storyId);
  if (!parsed.success) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("view_story", { p_story: parsed.data });
  if (error) console.error("markStoryViewed", error);
}

// Devolve o estado depois do toque, ou null se não deu para salvar.
export async function toggleStoryLike(storyId: string): Promise<boolean | null> {
  const parsed = storyIdSchema.safeParse(storyId);
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_story_like", { p_story: parsed.data });

  if (error) {
    console.error("toggleStoryLike", error);
    return null;
  }

  return data === true;
}

// A RPC só devolve linhas para o dono do story.
export async function loadStoryAudience(storyId: string): Promise<StoryAudienceMember[] | null> {
  const parsed = storyIdSchema.safeParse(storyId);
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("story_audience", { p_story: parsed.data });

  if (error) {
    console.error("loadStoryAudience", error);
    return null;
  }

  const rows = data as StoryAudienceRow[];
  const urls = await signPaths(rows.map((row) => row.photo_path));

  return rows.map((row) => ({
    id: row.user_id,
    label: row.nickname ?? "",
    photoUrl: row.photo_path ? (urls[row.photo_path] ?? null) : null,
    liked: row.liked,
  }));
}

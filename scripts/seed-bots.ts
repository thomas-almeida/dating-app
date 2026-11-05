// Cria os perfis de apresentação com as mídias de public/bot:
//   npm run seed:bots
//   npm run seed:bots -- --remove
// Rodar de novo depois de criar sua conta faz os bots curtirem você, para mostrar o match.
// Cada execução também renova os stories deles, que vencem em 24 horas.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const MEDIA_BUCKET = "media";
const USERS_PER_PAGE = 1000;

const emailOf = (index: number) => `bot+${index}@example.com`;
const isBotEmail = (email?: string) => /^bot\+\d+@example\.com$/.test(email ?? "");

// O app aceita até duas fotos por perfil, e a primeira vira a capa do card.
const BOTS = [
  {
    name: "Mariana Castro",
    nickname: "Mari",
    gender: "female",
    birthDate: "2002-06-12",
    bio: "Viagem de trem, mesa cheia e louvor no domingo. Procuro alguém para caminhar junto, sem pressa e com propósito.",
    photos: ["public/bot/bot-user-1/fulana-3.jpg", "public/bot/bot-user-1/fulana-2.jpg"],
  },
  {
    name: "Isabela Nogueira",
    nickname: "Isa",
    gender: "female",
    birthDate: "2000-02-20",
    bio: "Vivo de mala pronta, mas meu lugar preferido ainda é o culto de domingo. Gosto de gente que ri de si mesma.",
    photos: ["public/bot/bot-user-2/fulana-1.jpg", "public/bot/bot-user-2/fulana-3.jpg"],
  },
  {
    name: "Camila Ribeiro",
    nickname: "Cami",
    gender: "female",
    birthDate: "1999-09-08",
    bio: "Canto no louvor da minha igreja e não dispenso um pôr do sol. Procuro alguém com os mesmos valores para construir algo de verdade.",
    photos: ["public/bot/bot-user-3/fulana-1.jpg", "public/bot/bot-user-3/fulana-2.jpg"],
    video: "public/bot/bot-user-3/fulana-3.mp4",
  },
];

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Preencha o Supabase no .env.local antes de rodar.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function listUsers(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: USERS_PER_PAGE });
  if (error) throw error;
  return data.users;
}

async function removeBots(supabase: SupabaseClient) {
  const bots = (await listUsers(supabase)).filter((user) => isBotEmail(user.email));

  for (const user of bots) {
    const { data: files } = await supabase.storage.from(MEDIA_BUCKET).list(user.id);
    if (files?.length) {
      const paths = files.map((file) => `${user.id}/${file.name}`);
      await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    }
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }

  console.log(`${bots.length} bots removidos.`);
}

async function uploadMedia(
  supabase: SupabaseClient,
  userId: string,
  file: string,
  extension: string,
  contentType: string,
) {
  const path = `${userId}/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, await readFile(file), { contentType });
  if (error) throw error;
  return path;
}

async function createBot(supabase: SupabaseClient, bot: (typeof BOTS)[number], index: number) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: emailOf(index),
    // Ninguém entra nessas contas.
    password: randomUUID(),
    email_confirm: true,
  });
  if (error) throw error;

  const { id } = data.user;

  const { error: profileError } = await supabase.from("profiles").insert({ id, name: bot.name });
  if (profileError) throw profileError;

  const { error: contactError } = await supabase
    .from("profile_contacts")
    .insert({ user_id: id, whatsapp: `5511900001${String(index).padStart(3, "0")}` });
  if (contactError) throw contactError;

  const photoPaths: string[] = [];
  for (const file of bot.photos) {
    photoPaths.push(await uploadMedia(supabase, id, file, "jpg", "image/jpeg"));
  }

  const videoPath = bot.video
    ? await uploadMedia(supabase, id, bot.video, "mp4", "video/mp4")
    : null;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      nickname: bot.nickname,
      bio: bot.bio,
      gender: bot.gender,
      birth_date: bot.birthDate,
      video_path: videoPath,
      photo_paths: photoPaths,
    })
    .eq("id", id);
  if (updateError) throw updateError;

  return id;
}

async function refreshStories(supabase: SupabaseClient, botIds: string[]) {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, video_path, photo_paths")
    .in("id", botIds);
  if (error) throw error;

  const { error: deleteError } = await supabase.from("stories").delete().in("user_id", botIds);
  if (deleteError) throw deleteError;

  // Reusa a mídia do perfil: apagar o story não pode levar o arquivo junto.
  const { error: insertError } = await supabase.from("stories").insert(
    profiles.map(({ id, video_path, photo_paths }) => ({
      user_id: id,
      media_path: video_path ?? photo_paths[0],
      media_type: video_path ? "video" : "image",
    })),
  );
  if (insertError) throw insertError;
}

async function seed(supabase: SupabaseClient) {
  const users = await listUsers(supabase);
  const existing = new Map(users.map((user) => [user.email, user.id]));

  const botIds: string[] = [];
  for (const [index, bot] of BOTS.entries()) {
    botIds.push(existing.get(emailOf(index)) ?? (await createBot(supabase, bot, index)));
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id")
    .not("onboarded_at", "is", null);
  if (error) throw error;

  const targets = profiles.map(({ id }) => id).filter((id) => !botIds.includes(id));
  const likes = botIds.flatMap((swiper_id) =>
    targets.map((target_id) => ({ swiper_id, target_id, action: "like" })),
  );

  if (likes.length > 0) {
    const { error: likeError } = await supabase
      .from("swipes")
      .upsert(likes, { onConflict: "swiper_id,target_id", ignoreDuplicates: true });
    if (likeError) throw likeError;
  }

  await refreshStories(supabase, botIds);

  console.log(`${botIds.length} bots prontos, ${likes.length} curtidas registradas.`);
}

async function run() {
  const supabase = supabaseAdmin();
  if (process.argv.includes("--remove")) await removeBots(supabase);
  else await seed(supabase);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

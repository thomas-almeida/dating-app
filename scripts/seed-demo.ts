// Enche a home com perfis de exemplo para apresentações:
//   npm run seed:demo
//   npm run seed:demo -- --remove
// Rodar de novo depois de criar sua conta faz metade dos perfis curtir você, para mostrar o match.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const MEDIA_BUCKET = "media";
const USERS_PER_PAGE = 1000;

const emailOf = (index: number) => `demo+${index}@example.com`;
const isDemoEmail = (email?: string) => /^demo\+\d+@example\.com$/.test(email ?? "");

const PEOPLE = [
  {
    name: "Ana Clara Souza",
    nickname: "Aninha",
    gender: "female",
    birthDate: "2001-03-14",
    bio: "Louvor aos domingos, café forte e trilha no sábado. Procuro alguém para caminhar junto, na fé e na vida.",
    colors: ["#ff8a5b", "#a02c5c"],
  },
  {
    name: "Beatriz Lima",
    nickname: "Bia",
    gender: "female",
    birthDate: "1999-08-02",
    bio: "Professora, leitora de Lewis e fã de um bom pão de queijo. Sirvo no ministério infantil.",
    colors: ["#f7b267", "#c8553d"],
  },
  {
    name: "Rebeca Martins",
    nickname: "Rebeca",
    gender: "female",
    birthDate: "2002-11-21",
    bio: "Enfermeira em formação. Gosto de música, de mesa cheia e de conversa que vai longe.",
    colors: ["#e56b9e", "#5b2a86"],
  },
  {
    name: "Sara Oliveira",
    nickname: "Sarinha",
    gender: "female",
    birthDate: "2000-05-30",
    bio: "Designer, viajante de fim de semana. A minha oração é ser fiel nas coisas pequenas.",
    colors: ["#ffa69e", "#b8336a"],
  },
  {
    name: "Lucas Ferreira",
    nickname: "Lucas",
    gender: "male",
    birthDate: "1998-01-09",
    bio: "Engenheiro e violonista da igreja. Churrasco, futebol e estudo bíblico às quartas.",
    colors: ["#4ea8de", "#3a0ca3"],
  },
  {
    name: "Mateus Almeida",
    nickname: "Teus",
    gender: "male",
    birthDate: "2000-07-17",
    bio: "Pedalo cedo, trabalho com dados e lidero um pequeno grupo de jovens. Quero construir algo sério.",
    colors: ["#48bfe3", "#1b4965"],
  },
  {
    name: "Daniel Costa",
    nickname: "Dani",
    gender: "male",
    birthDate: "1997-12-03",
    bio: "Médico residente. Quando sobra tempo: cozinha, Salmos e praia com os amigos.",
    colors: ["#80ed99", "#22577a"],
  },
  {
    name: "Tiago Ribeiro",
    nickname: "Tiago",
    gender: "male",
    birthDate: "2001-09-25",
    bio: "Fotógrafo de casamento que ainda espera o próprio. Sirvo na recepção da igreja.",
    colors: ["#f4a261", "#264653"],
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

// Silhueta sobre gradiente: deixa claro que é um perfil de exemplo.
function portrait([from, to]: string[]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${from}"/>
        <stop offset="1" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="900" height="1200" fill="url(#bg)"/>
    <circle cx="450" cy="470" r="170" fill="#ffffff" fill-opacity="0.22"/>
    <ellipse cx="450" cy="1050" rx="330" ry="360" fill="#ffffff" fill-opacity="0.22"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function removeDemo(supabase: SupabaseClient) {
  const demos = (await listUsers(supabase)).filter((user) => isDemoEmail(user.email));

  for (const user of demos) {
    const { data: files } = await supabase.storage.from(MEDIA_BUCKET).list(user.id);
    if (files?.length) {
      const paths = files.map((file) => `${user.id}/${file.name}`);
      await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    }
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }

  console.log(`${demos.length} perfis de exemplo removidos.`);
}

async function createPerson(
  supabase: SupabaseClient,
  person: (typeof PEOPLE)[number],
  index: number,
) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: emailOf(index),
    // Ninguém entra nessas contas.
    password: randomUUID(),
    email_confirm: true,
  });
  if (error) throw error;

  const { id } = data.user;

  const { error: profileError } = await supabase.from("profiles").insert({ id, name: person.name });
  if (profileError) throw profileError;

  const { error: contactError } = await supabase
    .from("profile_contacts")
    .insert({ user_id: id, whatsapp: `55119000000${String(index).padStart(2, "0")}` });
  if (contactError) throw contactError;

  const path = `${id}/${randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, await portrait(person.colors), { contentType: "image/jpeg" });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      nickname: person.nickname,
      bio: person.bio,
      gender: person.gender,
      birth_date: person.birthDate,
      photo_paths: [path],
    })
    .eq("id", id);
  if (updateError) throw updateError;

  return id;
}

async function seed(supabase: SupabaseClient) {
  const users = await listUsers(supabase);
  const existing = new Map(users.map((user) => [user.email, user.id]));

  const demoIds: string[] = [];
  for (const [index, person] of PEOPLE.entries()) {
    demoIds.push(existing.get(emailOf(index)) ?? (await createPerson(supabase, person, index)));
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id")
    .not("onboarded_at", "is", null);
  if (error) throw error;

  const realIds = profiles.map(({ id }) => id).filter((id) => !demoIds.includes(id));

  // Os índices pares pegam dois perfis de cada gênero.
  const fans = demoIds.filter((_, index) => index % 2 === 0);
  const likes = fans.flatMap((swiper_id) =>
    realIds.map((target_id) => ({ swiper_id, target_id, action: "like" })),
  );

  if (likes.length > 0) {
    const { error: likeError } = await supabase
      .from("swipes")
      .upsert(likes, { onConflict: "swiper_id,target_id", ignoreDuplicates: true });
    if (likeError) throw likeError;
  }

  console.log(`${demoIds.length} perfis de exemplo prontos, ${likes.length} curtidas registradas.`);
}

async function run() {
  const supabase = supabaseAdmin();
  if (process.argv.includes("--remove")) await removeDemo(supabase);
  else await seed(supabase);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

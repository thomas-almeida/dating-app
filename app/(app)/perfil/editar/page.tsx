import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/app/entrar/actions";
import { BackButton } from "@/components/back-button";
import type { MediaItem } from "@/components/media-tiles";
import { Wordmark } from "@/components/wordmark";
import { requireUser } from "@/lib/dal";
import { signPaths } from "@/lib/media";
import { displayPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Seu perfil" };

async function Content() {
  const { user, profile } = await requireUser();
  const supabase = await createClient();

  const [{ data: contact }, urls] = await Promise.all([
    supabase.from("profile_contacts").select("whatsapp").eq("user_id", user.id).maybeSingle(),
    signPaths([profile.video_path, ...profile.photo_paths]),
  ]);

  const toItem = (path: string | null): MediaItem | null =>
    path && urls[path] ? { path, url: urls[path] } : null;

  const firstTime = !profile.onboarded_at;

  return (
    <>
      <header className="flex items-center justify-between py-5">
        {firstTime ? <Wordmark /> : <BackButton fallback="/perfil" />}
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sair"
            className="flex size-10 items-center justify-center rounded-full bg-surface text-muted transition hover:text-cream"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </header>

      <h1 className="font-display text-3xl font-semibold">
        {firstTime ? "Monte seu perfil" : "Editar perfil"}
      </h1>
      {firstTime && (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          É assim que as pessoas vão conhecer você. Depois disso, a home abre.
        </p>
      )}

      <div className="mt-6">
        {/* Rotas ficam montadas em segundo plano: sem a key, o form guardaria mídia já salva como nova. */}
        <ProfileForm
          key={[profile.video_path, ...profile.photo_paths].join()}
          userId={user.id}
          firstTime={firstTime}
          initial={{
            name: profile.name,
            nickname: profile.nickname ?? "",
            bio: profile.bio ?? "",
            gender: profile.gender,
            birthDate: profile.birth_date ?? "",
            state: profile.state ?? "",
            city: profile.city ?? "",
            neighborhood: profile.neighborhood ?? "",
            hobbies: profile.hobbies ?? [],
            heightCm: profile.height_cm ? String(profile.height_cm) : "",
            church: profile.church ?? "",
            skinColor: profile.skin_color ?? "",
            prefGenders: profile.pref_genders ?? [],
            prefChurches: profile.pref_churches ?? [],
            prefSkinColors: profile.pref_skin_colors ?? [],
            whatsapp: contact ? displayPhone(contact.whatsapp) : "",
          }}
          initialVideo={toItem(profile.video_path)}
          initialPhotos={profile.photo_paths.flatMap((path) => toItem(path) ?? [])}
        />
      </div>
    </>
  );
}

function EditSkeleton() {
  return (
    <div className="animate-pulse space-y-4 pt-20" aria-hidden>
      <div className="h-9 w-2/3 rounded-xl bg-surface" />
      <div className="grid grid-cols-3 gap-3">
        <div className="aspect-[3/4] rounded-2xl bg-surface" />
        <div className="aspect-[3/4] rounded-2xl bg-surface" />
        <div className="aspect-[3/4] rounded-2xl bg-surface" />
      </div>
      <div className="h-13 rounded-2xl bg-surface" />
      <div className="h-13 rounded-2xl bg-surface" />
    </div>
  );
}

export default function EditProfilePage() {
  return (
    <main className="pt-safe pb-safe flex-1 px-5">
      <Suspense fallback={<EditSkeleton />}>
        <Content />
      </Suspense>
    </main>
  );
}

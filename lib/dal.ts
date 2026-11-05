import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export type Viewer = {
  user: User;
  profile: Profile | null;
  isAdmin: boolean;
};

export type Member = Viewer & { profile: Profile };

export const getSessionUser = cache(async (): Promise<User | null> => {
  // Sem isso, um build sem env congelaria o redirect das páginas protegidas.
  await connection();
  if (!supabaseEnv()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  return {
    user,
    profile: (data as Profile | null) ?? null,
    isAdmin: user.app_metadata?.role === "admin",
  };
});

// Tem conta e perfil, mas o perfil pode estar incompleto.
export async function requireUser(): Promise<Member> {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  if (!viewer.profile) redirect(viewer.isAdmin ? "/admin" : "/entrar?erro=sem-acesso");
  return viewer as Member;
}

// Perfil completo: é o que libera a home.
export async function requireMember(): Promise<Member> {
  const viewer = await requireUser();
  if (!viewer.profile.onboarded_at) redirect("/perfil/editar");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  if (!viewer.isAdmin) redirect("/inicio");
  return viewer;
}

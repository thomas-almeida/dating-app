import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarDays, Heart, Layers, User } from "lucide-react";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const ITEMS = [
  { key: "inicio", href: "/inicio", label: "Início", icon: Layers },
  { key: "matches", href: "/matches", label: "Matches", icon: Heart },
  { key: "eventos", href: "/eventos", label: "Eventos", icon: CalendarDays },
  { key: "perfil", href: "/perfil", label: "Perfil", icon: User },
] as const;

async function UnreadDot() {
  await connection();
  if (!supabaseEnv()) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc("unread_messages");
  if (!data) return null;

  return (
    <span
      role="status"
      aria-label={`${data} mensagens não lidas`}
      className="absolute top-1.5 right-2 size-2.5 rounded-full bg-coral ring-2 ring-surface"
    />
  );
}

export function BottomNav({ active }: { active: (typeof ITEMS)[number]["key"] }) {
  return (
    <nav aria-label="Navegação principal" className="pb-safe mx-auto w-full max-w-md px-5">
      <ul className="mb-3 flex items-center justify-between gap-1 rounded-full bg-surface p-1.5">
        {ITEMS.map(({ key, href, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <li key={key} className={`relative ${isActive ? "flex-1" : ""}`}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                  isActive ? "bg-cream text-ink" : "text-muted"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                <span className={isActive ? "" : "sr-only"}>{label}</span>
              </Link>
              {key === "matches" && (
                <Suspense fallback={null}>
                  <UnreadDot />
                </Suspense>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

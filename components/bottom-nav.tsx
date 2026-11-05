import Link from "next/link";
import { Heart, Layers, User } from "lucide-react";

const ITEMS = [
  { key: "inicio", href: "/inicio", label: "Início", icon: Layers },
  { key: "matches", href: "/matches", label: "Matches", icon: Heart },
  { key: "perfil", href: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav({ active }: { active: (typeof ITEMS)[number]["key"] }) {
  return (
    <nav aria-label="Navegação principal" className="pb-safe mx-auto w-full max-w-md px-5">
      <ul className="mb-3 flex items-center justify-between gap-1 rounded-full bg-surface p-1.5">
        {ITEMS.map(({ key, href, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <li key={key} className={isActive ? "flex-1" : ""}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition ${
                  isActive ? "bg-cream text-ink" : "text-muted"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                <span className={isActive ? "" : "sr-only"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

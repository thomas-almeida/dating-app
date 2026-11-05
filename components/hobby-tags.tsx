import { MapPin } from "lucide-react";
import type { HobbyTag } from "@/lib/types";

const tagClass = "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold";
const plainClass = "bg-white/15 text-white backdrop-blur";

// Os gostos da pessoa, com os que ela divide com quem está vendo em destaque.
export function HobbyTags({
  hobbies,
  sameRegion,
}: {
  hobbies: HobbyTag[];
  sameRegion: boolean;
}) {
  return (
    <>
      {hobbies.map(({ emoji, hobbie, common }) => (
        <span key={emoji} className={`${tagClass} ${common ? "bg-coral text-ink" : plainClass}`}>
          <span aria-hidden>{emoji}</span>
          {hobbie}
          {/* A cor sozinha não chega a quem usa leitor de tela. */}
          {common && <span className="sr-only">, em comum</span>}
        </span>
      ))}
      {sameRegion && (
        <span className={`${tagClass} ${plainClass}`}>
          <MapPin className="size-3" aria-hidden />
          Da sua região
        </span>
      )}
    </>
  );
}

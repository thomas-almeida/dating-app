import { Church, MapPin } from "lucide-react";
import type { HobbyTag } from "@/lib/types";

const tagClass = "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold";
const plainClass = "bg-white/15 text-white backdrop-blur";
const commonClass = "bg-coral text-ink";

// A cor sozinha não chega a quem usa leitor de tela.
const commonMark = <span className="sr-only">, em comum</span>;

// O que a pessoa conta sobre si, com o que ela divide com quem está vendo em destaque.
export function HobbyTags({
  hobbies,
  sameRegion,
  church = null,
  sameChurch = false,
}: {
  hobbies: HobbyTag[];
  sameRegion: boolean;
  church?: string | null;
  sameChurch?: boolean;
}) {
  return (
    <>
      {church && (
        <span className={`${tagClass} ${sameChurch ? commonClass : plainClass}`}>
          <Church className="size-3" aria-hidden />
          {church}
          {sameChurch && commonMark}
        </span>
      )}
      {hobbies.map(({ emoji, hobbie, common }) => (
        <span key={emoji} className={`${tagClass} ${common ? commonClass : plainClass}`}>
          <span aria-hidden>{emoji}</span>
          {hobbie}
          {common && commonMark}
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

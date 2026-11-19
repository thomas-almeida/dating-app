import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADS_PER_DECK, DECK_SIZE } from "@/lib/config";
import { interleaveAds } from "@/lib/deck";
import { toAdCards, toDeckCards } from "@/lib/media";
import type { AdRow, DeckLoad, Profile, PublicProfile } from "@/lib/types";

/**
 * Monta uma carga do deck com pessoas e anúncios intercalados.
 *
 * A primeira tela e o refill passam os dois pelo mesmo caminho: se só a home soubesse de
 * anúncio, o deck pararia de mostrar anúncio depois do primeiro refill.
 *
 * Quem é Pro não precisa de tratamento aqui: o `active_ads` já devolve lista vazia para ele.
 */
export async function loadDeckItems(
  supabase: SupabaseClient,
  viewer: Profile,
  limit: number = DECK_SIZE,
): Promise<DeckLoad | null> {
  const [discovered, ads] = await Promise.all([
    supabase.rpc("discover_profiles", { p_limit: limit }),
    supabase.rpc("active_ads", { p_limit: ADS_PER_DECK }),
  ]);

  if (discovered.error) {
    console.error("discover_profiles", discovered.error);
    return null;
  }

  // Anúncio é acessório: se a consulta falhar, o deck ainda tem gente para mostrar.
  if (ads.error) console.error("active_ads", ads.error);

  const [people, adCards] = await Promise.all([
    toDeckCards((discovered.data ?? []) as PublicProfile[], viewer),
    toAdCards((ads.data ?? []) as AdRow[]),
  ]);

  // Sem gente no deck o anúncio não entra na pilha: vai para o estado vazio.
  return {
    items: interleaveAds(people, adCards),
    spareAd: people.length === 0 ? (adCards[0] ?? null) : null,
  };
}

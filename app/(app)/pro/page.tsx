import {
  ChevronDown,
  Crown,
  EighthNotes,
  Eye,
  HeartPlus,
  MessageCircle,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BackButton } from "@/components/back-button";
import { Wordmark } from "@/components/wordmark";
import { isAbacatePayConfigured } from "@/lib/abacatepay";
import { APP_NAME, PRO_PRICE_LABEL } from "@/lib/config";
import { requireMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { CancelForm, CheckoutForm, PaymentPending } from "./pro-forms";

export const metadata: Metadata = { title: "Pro" };

const BENEFITS = [
  {
    icon: MessageCircle,
    title: "Converse no WhatsApp",
    text: "Mande mensagem para quem chamou sua atenção diretamente antes do match.",
  },
  {
    icon: UsersRound,
    title: "Acompanhe seus likes",
    text: "Veja o que está acontecendo com as pessoas que te interessaram.",
  },
  {
    icon: HeartPlus,
    title: "Dê likes sem limite",
    text: "Não se preocupe com o número de likes: curta quem você quiser, sem restrições.",
  },
  {
    icon: Eye,
    title: "Veja quem te curtiu",
    text: "Saiba quem curtiu você e não perca a chance de conhecer alguém especial.",
  },
  {
    icon: MessageCircle,
    title: "Entre no grupo no WhatsApp",
    text: "Participe de grupos exclusivos com pessoas que compartilham seus interesses.",
  },
  {
    icon: EighthNotes,
    title: "Adicione músicas às suas fotos",
    text: "Dê vida às suas fotos adicionando músicas que expressem sua personalidade e estilo.",
  },
];

// Onde o navegador não anima ::details-content, o item só abre sem transição.
const accordionClass =
  "group rounded-3xl bg-surface [interpolate-size:allow-keywords] details-content:h-0 details-content:overflow-clip details-content:transition-[height,content-visibility] details-content:transition-discrete details-content:duration-200 open:details-content:h-auto motion-reduce:details-content:transition-none";

async function Plan({ searchParams }: { searchParams: PageProps<"/pro">["searchParams"] }) {
  const [{ user, profile }, params] = await Promise.all([requireMember(), searchParams]);

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (profile.is_pro) {
    return (
      <div className="space-y-3">
        <p className="rounded-3xl bg-surface p-5 text-center text-sm font-semibold text-cream">
          {subscription ? "Seu Pro está ativo." : "Seu Pro foi liberado pela equipe."}
        </p>
        {subscription && <CancelForm />}
      </div>
    );
  }

  if (params.status === "ok") return <PaymentPending />;

  return <CheckoutForm available={isAbacatePayConfigured()} />;
}

function PlanSkeleton() {
  return <div className="h-13 animate-pulse rounded-full bg-surface" aria-hidden />;
}

export default function ProPage({ searchParams }: PageProps<"/pro">) {
  return (
    <main className="pt-safe pb-safe flex flex-1 flex-col px-5">
      <header className="flex h-16 shrink-0 items-center justify-between">
        <BackButton />
        <Wordmark />
        <span className="size-10" aria-hidden />
      </header>

      <div className="flex flex-1 flex-col pt-6 pb-6">
        <div className="flex justify-start items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-coral text-ink">
            <Crown className="size-6" aria-hidden />
          </span>
          <div className="ml-4 text-left">
            <h1 className="font-display text-4xl font-semibold">{APP_NAME} Pro</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{PRO_PRICE_LABEL}. Cancele quando quiser.</p>
          </div>
        </div>
        <ul className="mt-8 space-y-3">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              {/* Com o mesmo name, o navegador fecha o item aberto quando outro abre. */}
              <details name="pro-benefits" className={accordionClass}>
                <summary className="flex cursor-pointer list-none items-center gap-4 rounded-3xl p-5 font-semibold [&::-webkit-details-marker]:hidden">
                  <Icon className="size-5 shrink-0 text-coral" aria-hidden />
                  <span className="flex-1">{title}</span>
                  <ChevronDown
                    className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="pr-5 pb-5 pl-14 text-sm leading-relaxed text-muted">{text}</p>
              </details>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-8">
          <Suspense fallback={<PlanSkeleton />}>
            <Plan searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

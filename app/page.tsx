import Link from "next/link";
import { MessageCircle, Play, ShieldCheck } from "lucide-react";
import { GradientBackground } from "@/components/gradient-background";
import { Wordmark } from "@/components/wordmark";
import { APP_NAME } from "@/lib/config";
import { StorySlideshow } from "./story-slideshow";
import { WaitlistForm } from "./waitlist-form";

const POINTS = [
  {
    icon: ShieldCheck,
    title: "Perfis aprovados um a um",
    text: "Ninguém entra direto. Cada pedido passa pela nossa equipe antes de virar perfil.",
  },
  {
    icon: Play,
    title: "Vídeo de apresentação",
    text: "Um vídeo curto mostra quem a pessoa é, muito além da foto mais bonita do rolo.",
  },
  {
    icon: MessageCircle,
    title: "Conversa no WhatsApp",
    text: "Sem chat novo para aprender: a conversa acontece no app que você já usa.",
  },
];

export default function LandingPage() {
  return (
    <main className="pt-safe isolate mx-auto flex w-full max-w-5xl flex-1 flex-col px-5">
      <GradientBackground />

      <header className="flex items-center justify-between py-5">
        <Wordmark />
        <Link
          href="/entrar"
          className="rounded-full border border-cream/30 px-4 py-2 text-sm font-semibold transition-colors hover:bg-cream/10"
        >
          Já Tenho Conta, Entrar
        </Link>
      </header>

      <section className="grid items-center gap-12 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-14">
        <div>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Alguém que ore com você.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-cream">
            O {APP_NAME} é um lugar para jovens cristãos se conhecerem com calma e intenção. Estamos
            abrindo aos poucos para apenas aqueles que estão no propósito de terem seu par diante da escritura: entre na lista e aprovamos o seu acesso.
          </p>
          <div className="mt-8 max-w-md">
            <WaitlistForm />
          </div>
        </div>
        <StorySlideshow />
      </section>

      <ul className="grid gap-6 border-t border-cream/15 py-10 sm:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Icon className="size-6 text-cream" aria-hidden />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-cream">{text}</p>
          </li>
        ))}
      </ul>

      <footer className="pb-safe border-t border-cream/15 py-6 text-sm text-cream">
        <p className="pb-6">
          {APP_NAME} · Só para maiores de 18 anos
        </p>
      </footer>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormMessage } from "@/components/field";
import { GradientBackground } from "@/components/gradient-background";
import { Wordmark } from "@/components/wordmark";
import { getViewer } from "@/lib/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

// Fica fora do formulário: quando a sessão resolve, o que a pessoa já digitou não é substituído.
async function Gate({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }) {
  const [viewer, params] = await Promise.all([getViewer(), searchParams]);

  if (viewer?.isAdmin) redirect("/admin");
  if (viewer?.profile) redirect("/inicio");

  if (params.erro === "sem-acesso") {
    return <FormMessage message="Essa conta ainda não tem acesso ao app." />;
  }
  return null;
}

export default function LoginPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <main className="pt-safe pb-safe isolate mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5">
      <GradientBackground />

      <div className="py-10">
        <Link href="/" aria-label="Voltar para o início">
          <Wordmark />
        </Link>
        <h1 className="mt-8 font-display text-3xl font-semibold">Que bom te ver</h1>
        <p className="mt-2 text-sm leading-relaxed text-cream">
          Use o e-mail do seu cadastro e a senha que você criou no convite.
        </p>

        <div className="mt-6 space-y-4 rounded-3xl border border-line bg-surface/80 p-5">
          <Suspense fallback={null}>
            <Gate searchParams={searchParams} />
          </Suspense>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm text-cream">
          Ainda não tem acesso?{" "}
          <Link href="/" className="font-semibold text-cream underline underline-offset-4">
            Entre na lista de espera
          </Link>
        </p>
      </div>
    </main>
  );
}

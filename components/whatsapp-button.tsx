"use client";

import Image from "next/image";
import { useCallback, useLayoutEffect, useState } from "react";
import { ProSheet, type ProReason } from "@/components/pro-sheet";
import whatsappIcon from "@/public/icons/whatsapp.png";

const buttonClass =
  "flex h-13 w-full items-center justify-center gap-2 rounded-full bg-green-700 font-semibold text-white transition active:scale-[0.98]";

const icon = <Image src={whatsappIcon} alt="" width={24} height={24} loading="eager" />;

// Sem href, a pessoa não é Pro: o número nem chega até aqui.
// O visual é igual de propósito, para quem não é Pro clicar e conhecer o plano.
export function WhatsAppButton({ href }: { href: string | null }) {
  const [paywall, setPaywall] = useState<ProReason | null>(null);
  const closePaywall = useCallback(() => setPaywall(null), []);

  useLayoutEffect(() => () => setPaywall(null), []);

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={buttonClass}>
        {icon}
        Mandar mensagem no WhatsApp
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setPaywall("whatsapp")} className={buttonClass}>
        {icon}
        Mandar mensagem no WhatsApp
      </button>
      <ProSheet reason={paywall} onClose={closePaywall} />
    </>
  );
}

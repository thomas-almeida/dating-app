"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import photo1 from "@/public/pre/fulana-1.jpg";
import photo3 from "@/public/pre/fulana-3.jpg";
import photo4 from "@/public/pre/fulana-4.jpg";

// O quadro 9:16 corta as laterais das fotos mais largas: a posição mantém os rostos no recorte.
const SLIDES = [
  { photo: photo1, position: "object-[35%_50%]" },
  { photo: photo3, position: "object-[25%_50%]" },
  { photo: photo4, position: "object-[55%_50%]" },
];

const noopSubscribe = () => () => {};

export function StorySlideshow() {
  const [active, setActive] = useState(0);
  // A barra só corre depois da hidratação: antes disso, ninguém ouviria o fim da animação.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  function showNext() {
    setActive((current) => (current + 1) % SLIDES.length);
  }

  return (
    <div
      aria-hidden
      className="group relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-[2rem] border border-line bg-surface shadow-2xl shadow-coral/10"
    >
      {SLIDES.map(({ photo, position }, index) => (
        <Image
          key={photo.src}
          src={photo}
          alt=""
          fill
          sizes="320px"
          placeholder="blur"
          className={`object-cover transition-opacity duration-1000 ${position} ${
            index === active ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Sem as barras não há fim de animação: com movimento reduzido, a primeira foto fica parada. */}
      <div className="motion-reduce:hidden">
        <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-black/50 to-transparent" />
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {SLIDES.map(({ photo }, index) => (
            <span key={photo.src} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
              {index < active && <span className="block size-full bg-white" />}
              {index === active && hydrated && (
                <span
                  onAnimationEnd={showNext}
                  className="block size-full origin-left animate-story-progress bg-white group-hover:[animation-play-state:paused] group-active:[animation-play-state:paused]"
                />
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

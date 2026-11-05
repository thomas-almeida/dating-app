"use client";

import { useEffect, useRef } from "react";

// Rotas escondidas continuam montadas no DOM: o cleanup evita vídeo tocando fora da tela.
export function LoopVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.play().catch(() => {});
    return () => video.pause();
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      className={className}
      muted
      loop
      autoPlay
      playsInline
      preload="metadata"
    />
  );
}

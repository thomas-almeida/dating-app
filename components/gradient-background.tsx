// As bolhas grandes levam a cor pela tela, e as pequenas sobem na frente delas.
const BLOBS = [
  "-top-24 -left-32 size-96 bg-coral/24 [--blob-x:50vw] [--blob-y:35vh] [--blob-time:13s]",
  "top-1/3 -right-40 size-[28rem] bg-coral-deep/40 [--blob-x:-55vw] [--blob-y:-25vh] [--blob-time:17s] [--blob-delay:-5s]",
  "-bottom-32 left-1/4 size-80 bg-coral/20 [--blob-x:30vw] [--blob-y:-50vh] [--blob-time:11s] [--blob-delay:-8s]",
];

const BUBBLES = [
  "left-[6%] size-20 [--bubble-sway:8vw] [--bubble-time:15s] [--bubble-delay:-3s]",
  "left-[22%] size-10 [--bubble-sway:-5vw] [--bubble-time:11s] [--bubble-delay:-9s]",
  "left-[41%] size-28 [--bubble-sway:6vw] [--bubble-time:19s] [--bubble-delay:-12s]",
  "left-[58%] size-14 [--bubble-sway:-7vw] [--bubble-time:13s] [--bubble-delay:-1s]",
  "left-[74%] size-24 [--bubble-sway:5vw] [--bubble-time:17s] [--bubble-delay:-6s]",
  "left-[88%] size-12 [--bubble-sway:-6vw] [--bubble-time:12s] [--bubble-delay:-4s]",
];

// Camada fixa: no fundo da página, o gradiente esticaria com a altura do conteúdo.
// O main precisa de `isolate`, senão o fundo do body cobre o z-index negativo.
// O pico fica no vinho, e não no coral puro: o texto claro precisa continuar legível.
export function GradientBackground() {
  return (
    <div
      aria-hidden
      className="animate-brand-gradient fixed inset-0 -z-10 overflow-hidden -bg-linear-45 from-ink via-coral-deep/50 to-ink bg-size-[400%_400%]"
    >
      {BLOBS.map((blob) => (
        <span
          key={blob}
          className={`animate-blob absolute rounded-full blur-3xl will-change-transform ${blob}`}
        />
      ))}
      {BUBBLES.map((bubble) => (
        <span
          key={bubble}
          className={`animate-bubble absolute -bottom-32 rounded-full bg-linear-to-br from-coral/25 to-coral-deep/5 ring-1 ring-cream/10 will-change-transform motion-reduce:hidden ${bubble}`}
        />
      ))}
    </div>
  );
}

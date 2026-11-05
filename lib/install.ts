import { INSTALL_REMINDER_DAYS } from "@/lib/config";

export type InstallPlatform = "ios" | "android" | "in-app";

type InstallEvent = Event & { prompt: () => Promise<unknown> };

// Chave própria do guia: quem fechou o banner antigo ainda precisa ver o passo a passo.
const DISMISSED_KEY = "install-guide-dismissed";
const REMINDER_MS = INSTALL_REMINDER_DAYS * 24 * 60 * 60 * 1000;

// Navegadores embutidos em outros apps não têm como instalar nada.
const IN_APP_BROWSER =
  /FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Snapchat|LinkedInApp|Pinterest|Twitter|\bLine\/|; wv\)/i;

export function detectInstallPlatform(
  userAgent: string,
  maxTouchPoints: number,
): InstallPlatform | null {
  // O iPad se apresenta como Mac: quem denuncia é a tela de toque.
  const isIos =
    /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1);
  const isAndroid = /android/i.test(userAgent);
  if (!isIos && !isAndroid) return null;

  // No iOS, todo navegador de verdade traz "Safari/". WebView de app, não.
  if (IN_APP_BROWSER.test(userAgent) || (isIos && !userAgent.includes("Safari/"))) return "in-app";
  return isIos ? "ios" : "android";
}

let installEvent: InstallEvent | null = null;
let justInstalled = false;
// Sem storage, a dispensa vale até a página recarregar.
let dismissed = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setInstallEvent(event: InstallEvent | null) {
  installEvent = event;
  notify();
}

// O evento dispara uma vez por carregamento, em geral antes do login. Como o login não recarrega
// a página, quem só escuta na home nunca recebe. Por isso o root layout importa este módulo.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setInstallEvent(event as InstallEvent);
  });
  window.addEventListener("appinstalled", () => {
    justInstalled = true;
    setInstallEvent(null);
  });
}

function wasDismissed() {
  if (dismissed) return true;
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED_KEY)) < REMINDER_MS;
  } catch {
    return false;
  }
}

function isStandalone() {
  // O Safari do iOS antigo só informa pelo navigator.standalone.
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true)
  );
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function canPromptInstall() {
  return installEvent !== null;
}

// Estamos no app instalado, ou no navegador que acabou de instalar.
export function isInstalledHere() {
  return justInstalled || isStandalone();
}

// Nulo quando não há o que ensinar: já instalou, dispensou há pouco ou não é celular.
export function getInstallPlatform() {
  if (isInstalledHere() || wasDismissed()) return null;
  return detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
}

export function dismissInstall() {
  dismissed = true;
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Fica só o estado em memória.
  }
  notify();
}

// Todo login mostra o guia, mesmo dentro do intervalo do lembrete.
export function resetInstallDismissal() {
  dismissed = false;
  try {
    localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // Sem storage, não há o que limpar.
  }
  notify();
}

// O navegador só aceita um prompt() por evento.
export async function promptInstall() {
  await installEvent?.prompt().catch(() => {});
  setInstallEvent(null);
}

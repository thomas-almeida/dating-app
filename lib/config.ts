// Nome provisório: trocar aqui muda o app inteiro (o manifest lê daqui também).
export const APP_NAME = "Ágape";
export const APP_DESCRIPTION =
  "Um lugar para jovens cristãos se conhecerem com calma e intenção.";

// Só exibição. O valor cobrado é o do produto cadastrado na loja do AbacatePay.
export const PRO_PRICE_LABEL = "R$ 29,97 por mês";

export const THEME_COLOR = "#0d0a0b";

export const MEDIA_BUCKET = "media";
export const MAX_PHOTOS = 2;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 30;
export const MAX_PHOTO_EDGE = 1440;

export const INVITE_TTL_DAYS = 7;
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const DECK_SIZE = 20;
export const STORY_COUNT = 12;
export const STORY_TTL_HOURS = 24;

export const MAX_HOBBIES = 3;

export const BRAZIL_STATES = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export const MIN_HEIGHT_CM = 120;
export const MAX_HEIGHT_CM = 230;

// Trocar um value exige atualizar quem já escolheu: é ele que fica salvo no perfil.
export const CHURCHES = [
  { value: "catolica", label: "Católica" },
  { value: "assembleia", label: "Assembleia de Deus" },
  { value: "congregacao", label: "Congregação Cristã" },
  { value: "batista", label: "Batista" },
  { value: "presbiteriana", label: "Presbiteriana" },
  { value: "metodista", label: "Metodista" },
  { value: "adventista", label: "Adventista" },
  { value: "luterana", label: "Luterana" },
  { value: "quadrangular", label: "Quadrangular" },
  { value: "universal", label: "Universal" },
  { value: "comunidade", label: "Comunidade" },
  { value: "outra", label: "Outra" },
];

// Categorias do IBGE. A coluna do banco aceita só estes valores.
export const SKIN_COLORS = [
  { value: "branca", label: "Branca" },
  { value: "preta", label: "Preta" },
  { value: "parda", label: "Parda" },
  { value: "amarela", label: "Amarela" },
  { value: "indigena", label: "Indígena" },
];

export function churchLabel(value: string | null) {
  return CHURCHES.find((church) => church.value === value)?.label ?? null;
}

export const CHAT_POLL_MS = 3000;
export const MAX_MESSAGE_LENGTH = 1000;

export const MAX_EVENT_PHOTOS = 3;

// Depois de "Agora não", o guia de instalação volta nesse intervalo até a pessoa instalar.
export const INSTALL_REMINDER_DAYS = 3;

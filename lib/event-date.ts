// Tudo em horário de Brasília: o servidor roda em UTC, e o formulário não diz o fuso de quem digita.
const TIME_ZONE = "America/Sao_Paulo";
const OFFSET = "-03:00";

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const displayFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

// O sueco escreve a data no mesmo formato do input datetime-local.
const inputFormat = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

export function formatEventDate(iso: string) {
  return displayFormat.format(new Date(iso));
}

export function toDateInput(iso: string) {
  return inputFormat.format(new Date(iso)).replace(" ", "T");
}

export function fromDateInput(value: string) {
  if (!LOCAL_DATE.test(value)) return null;
  const date = new Date(`${value}:00${OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

"use client";

type Option = { value: string; label: string };

// Campos ocultos, e não checkboxes: o reset do form depois da action desmarcaria sem avisar o estado.
export function ChoiceChips({
  name,
  label,
  hint,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(
      value.includes(option) ? value.filter((item) => item !== option) : [...value, option],
    );
  }

  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-sm font-medium text-cream">{label}</p>

      {value.map((item) => (
        <input key={item} type="hidden" name={name} value={item} />
      ))}

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(option.value)}
              className={`h-10 rounded-full border px-3.5 text-sm transition ${
                selected
                  ? "border-cream bg-cream font-semibold text-ink"
                  : "border-line bg-surface text-cream"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

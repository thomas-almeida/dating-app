import Link from "next/link";

type GridPerson = {
  id: string;
  label: string;
  age: number | null;
  photoUrl: string | undefined;
};

export function PersonGrid({ people }: { people: GridPerson[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {people.map(({ id, label, age, photoUrl }) => (
        <li key={id}>
          <Link
            href={`/perfil/${id}`}
            className="relative block aspect-[3/4] overflow-hidden rounded-3xl bg-linear-to-b from-raised to-coral-deep/50"
          >
            {photoUrl && (
              <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
            )}
            <span className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/85 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 flex items-baseline gap-1.5 p-4 font-display text-lg font-semibold text-white">
              <span className="truncate">{label}</span>
              {age && <span className="font-normal">{age}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

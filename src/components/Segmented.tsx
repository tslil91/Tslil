export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <div role="group" aria-label={label} className="flex gap-2">
        {options.map(([v, l]) => <button key={v} type="button" className="seg" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
      </div>
    </div>
  );
}

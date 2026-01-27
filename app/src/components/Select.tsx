type SelectOption = { value: string; label: string }
type SelectGroup = { label: string; options: SelectOption[] }

type SelectProps = {
  label: string
  value: string
  placeholder: string
  options: SelectOption[] | SelectGroup[]
  onChange: (value: string) => void
  disabled?: boolean
}

function isGrouped(options: SelectOption[] | SelectGroup[]): options is SelectGroup[] {
  return options.length > 0 && 'options' in options[0]
}

export function Select({ label, value, placeholder, options, onChange, disabled }: SelectProps) {
  return (
    <label class="block text-sm">
      <span class="mb-1 block font-medium text-slate-700">{label}</span>
      <select
        value={value}
        disabled={disabled}
        class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base shadow-inner focus:border-emerald-500 focus:outline-none"
        onChange={(event) => onChange((event.target as HTMLSelectElement).value)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {isGrouped(options)
          ? options.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))
          : options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
      </select>
    </label>
  )
}

export function BirthDateGate({ required = true, disabled = false }: { required?: boolean; disabled?: boolean }) {
  return <label className="block space-y-1.5 text-sm">
    <span className="font-medium">Date of birth</span>
    <input className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" type="date" name="birthDate" autoComplete="bday" required={required} disabled={disabled} min="1900-01-01" />
    <span className="block text-xs text-slate-500">You must be 21 or older. We validate your birthdate before accepting your submission; we record the age-check result, not your birthdate.</span>
  </label>
}

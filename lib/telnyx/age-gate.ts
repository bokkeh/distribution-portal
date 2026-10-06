export const AGE_GATE_VERSION = 'birthdate-21-v1'

export function isAtLeast21(birthDate: unknown, today = new Date()) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false
  const [year, month, day] = birthDate.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (year < 1900 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false
  const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(today)
  const part = (name: string) => Number(calendar.find(value => value.type === name)?.value)
  const age = part('year') - year - (part('month') < month || (part('month') === month && part('day') < day) ? 1 : 0)
  return age >= 21
}

export function requireAdultBirthDate(value: unknown) {
  if (!isAtLeast21(value)) throw new Error('Enter a valid date of birth. You must be 21 or older to use this service.')
}

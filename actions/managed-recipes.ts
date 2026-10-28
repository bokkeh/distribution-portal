'use server'
import { db } from '@/db'
import { managedRecipes, recipeSelections, tastings } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getManagedRecipes } from '@/lib/marketing/managed-recipes'
import { recipeAvailable, recipeIsComplete } from '@/lib/marketing/recipe-selection'
const refresh = () => revalidatePath('/admin/crm/community/recipe-emails')
export async function saveManagedRecipe(_state: { message: string }, form: FormData): Promise<{ message: string }> {
  const session = await requireAdminOrStaff()
  const parsed = z.object({ handle: z.string().regex(/^[a-z0-9-]+$/).max(150), title: z.string().trim().min(1).max(500), status: z.enum(['draft','published']), ingredients: z.string().max(15000), steps: z.string().max(15000), availableFrom: z.union([z.literal(''),z.iso.date()]), availableUntil: z.union([z.literal(''),z.iso.date()]) }).safeParse(Object.fromEntries(form))
  if (!parsed.success) return { message: 'Check recipe fields.' }
  const v = parsed.data
  const ingredients = v.ingredients.split('\n').map(s=>s.trim()).filter(Boolean), steps = v.steps.split('\n').map(s=>s.trim()).filter(Boolean)
  const seasons = form.getAll('seasons').map(String).filter(s=>['spring','summer','autumn','winter'].includes(s))
  if (v.availableFrom && v.availableUntil && v.availableFrom > v.availableUntil) return { message: 'Availability end must follow start.' }
  if (v.status === 'published' && (!ingredients.length || !steps.length)) return { message: 'Ingredients and instructions are required before publishing.' }
  try {
    const data = { handle: v.handle, title: v.title, ingredients, steps, seasons, status: v.status, availableFrom: v.availableFrom || null, availableUntil: v.availableUntil || null, updatedBy: session.user.id, updatedAt: new Date() }
    await db.insert(managedRecipes).values(data).onConflictDoUpdate({ target: managedRecipes.handle, set: data })
    refresh(); return { message: 'Recipe saved.' }
  } catch { return { message: 'Recipe could not be saved.' } }
}
export async function saveRecipeSelection(_state: { message: string }, form: FormData): Promise<{ message: string }> {
  const session = await requireAdminOrStaff()
  const scope = String(form.get('scope') ?? ''), handle = String(form.get('handle') ?? '')
  let date: string
  if (/^week:\d{4}-\d{2}-\d{2}$/.test(scope)) {
    if (!z.iso.date().safeParse(scope.slice(5)).success) return { message: 'Choose a valid week.' }
    const sendDate = new Date(`${scope.slice(5)}T12:00:00Z`); sendDate.setUTCDate(sendDate.getUTCDate() + 3); date = sendDate.toISOString().slice(0,10)
  }
  else if (/^tasting:[0-9a-f-]{36}$/.test(scope)) {
    const [event] = await db.select().from(tastings).where(eq(tastings.id, scope.slice(8))).limit(1)
    if (!event) return { message: 'Tasting not found.' }
    date = new Intl.DateTimeFormat('en-CA', { timeZone: event.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(event.scheduledAt)
  } else return { message: 'Choose a valid week or tasting.' }
  try {
    if (!handle) await db.delete(recipeSelections).where(eq(recipeSelections.scope, scope))
    else {
      const recipe = (await getManagedRecipes()).find(r => r.handle === handle)
      if (!recipe || !recipeIsComplete(recipe) || !recipeAvailable(recipe, date)) return { message: 'Select a complete published recipe available on the event/send date.' }
      await db.insert(recipeSelections).values({ scope, handle, updatedBy: session.user.id }).onConflictDoUpdate({ target: recipeSelections.scope, set: { handle, updatedBy: session.user.id, updatedAt: new Date() } })
    }
    refresh()
    if (scope.startsWith('tasting:')) revalidatePath(`/admin/tastings/${scope.slice(8)}`)
    return { message: 'Selection saved. Preview before sending.' }
  } catch { return { message: 'Selection could not be saved.' } }
}

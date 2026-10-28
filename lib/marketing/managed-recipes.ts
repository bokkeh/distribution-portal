import 'server-only'
import { db } from '@/db'
import { managedRecipes, recipeSelections } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { fetchWisherRecipes } from './wisher-recipes'
import { recipeAvailable, recipeIsComplete, type SelectableRecipe } from './recipe-selection'
export async function getManagedRecipes(): Promise<SelectableRecipe[]> {
  const [catalog, local] = await Promise.all([fetchWisherRecipes(), db.select().from(managedRecipes)])
  const merged = new Map<string, SelectableRecipe>(catalog.map(r => [r.handle, { ...r, status: 'published', seasons: r.seasons ?? [] }]))
  for (const r of local) merged.set(r.handle, { handle: r.handle, title: r.title, url: merged.get(r.handle)?.url ?? 'https://wishervodka.com/collections/recipes', imageUrl: merged.get(r.handle)?.imageUrl ?? null, ingredientGroups: [{ heading: null, items: r.ingredients }], steps: r.steps, seasons: r.seasons, availableFrom: r.availableFrom, availableUntil: r.availableUntil, status: r.status })
  return [...merged.values()]
}
export async function getExplicitRecipe(scope: string, recipes: SelectableRecipe[], date: string) {
  const [selection] = await db.select().from(recipeSelections).where(eq(recipeSelections.scope, scope)).limit(1)
  if (!selection) return undefined
  const recipe = recipes.find(r => r.handle === selection.handle)
  // An invalid explicit selection blocks sending; never silently substitute another recipe.
  return recipe && recipeIsComplete(recipe) && recipeAvailable(recipe, date) ? recipe : null
}

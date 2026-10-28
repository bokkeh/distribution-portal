import type { WisherRecipe } from './wisher-recipes'
export type SelectableRecipe = WisherRecipe & { status?: 'draft' | 'published'; seasons?: string[]; availableFrom?: string | null; availableUntil?: string | null }
export function recipeIsComplete(recipe: SelectableRecipe) {
  return recipe.status !== 'draft' && recipe.title.trim() && recipe.ingredientGroups.some(g => g.items.some(i => i.trim())) && recipe.steps.some(s => s.trim())
}
export function seasonForDate(date: string) {
  const month = Number(date.slice(5, 7))
  return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter'
}
export function recipeAvailable(recipe: SelectableRecipe, date: string) {
  return (!recipe.availableFrom || recipe.availableFrom <= date) && (!recipe.availableUntil || recipe.availableUntil >= date)
}
export function seasonalRecipePool(recipes: SelectableRecipe[], date: string) {
  const ready = recipes.filter(r => recipeIsComplete(r) && recipeAvailable(r, date))
  const seasonal = ready.filter(r => r.seasons?.includes(seasonForDate(date)))
  return seasonal.length ? seasonal : ready.filter(r => !r.seasons?.length)
}

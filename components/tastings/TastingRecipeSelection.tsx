import { db } from '@/db'
import { recipeSelections } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getManagedRecipes } from '@/lib/marketing/managed-recipes'
import { RecipeSelectionForm } from '@/components/marketing/ManagedRecipeForm'
export async function TastingRecipeSelection({ tastingId }: { tastingId: string }) {
  try {
    const [recipes, [selection]] = await Promise.all([getManagedRecipes(), db.select().from(recipeSelections).where(eq(recipeSelections.scope, `tasting:${tastingId}`))])
    return <section className="space-y-3 rounded-xl border bg-white p-4"><h2 className="font-semibold">Tasting cocktail</h2><RecipeSelectionForm scope={`tasting:${tastingId}`} recipes={recipes} selected={selection?.handle ?? ''}/>{selection && <a className="text-sm text-blue-700 underline" href={`/api/admin/weekly-recipe-email/preview?handle=${encodeURIComponent(selection.handle)}`} target="_blank" rel="noreferrer">Preview selected recipe</a>}<p className="text-xs text-slate-500">Selection is specific to this event. Weekly emails have a separate override.</p></section>
  } catch { return <p className="rounded border p-3 text-sm">Recipe catalog unavailable. Recipe selection has not changed.</p> }
}

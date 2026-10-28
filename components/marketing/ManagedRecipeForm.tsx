'use client'
import { useActionState } from 'react'
import { saveManagedRecipe, saveRecipeSelection } from '@/actions/managed-recipes'
import { recipeIsComplete, type SelectableRecipe } from '@/lib/marketing/recipe-selection'
import { Button } from '@/components/ui/button'
export function RecipeSelectionForm({ scope, recipes, selected }: { scope: string; recipes: SelectableRecipe[]; selected: string }) {
  const [state, action, pending] = useActionState(saveRecipeSelection, { message: '' })
  return <form action={action} className="flex flex-wrap items-end gap-3"><input type="hidden" name="scope" value={scope}/>
    <label className="text-sm">Explicit recipe for {scope}<select className="block rounded border bg-white p-2" name="handle" defaultValue={selected}><option value="">Automatic seasonal selection / no event override</option>{recipes.map(r => <option key={r.handle} value={r.handle} disabled={!recipeIsComplete(r)}>{r.title}{!recipeIsComplete(r) ? ' (draft / incomplete)' : ''}</option>)}</select></label>
    <Button disabled={pending}>Save selection</Button><p role="status" className="text-sm">{state.message}</p>
  </form>
}
export function ManagedRecipeForm({ recipe }: { recipe: SelectableRecipe }) {
  const [state, action, pending] = useActionState(saveManagedRecipe, { message: '' })
  const style = 'block w-full rounded border bg-white p-2 text-sm'
  return <details className="rounded border bg-white p-3"><summary>{recipe.title} · {recipe.status ?? 'published'}{!recipeIsComplete(recipe) ? ' · Ingredients and instructions required' : ''}</summary>
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="handle" value={recipe.handle}/>
      <label>Title<input className={style} name="title" required defaultValue={recipe.title}/></label>
      <label>Publication<select className={style} name="status" defaultValue={recipe.status ?? 'published'}><option>draft</option><option>published</option></select></label>
      <label>Ingredients (one per line)<textarea className={style} rows={7} name="ingredients" defaultValue={recipe.ingredientGroups.flatMap(g=>[...(g.heading ? [g.heading] : []),...g.items]).join('\n')}/></label>
      <label>Instructions (one per line)<textarea className={style} rows={7} name="steps" defaultValue={recipe.steps.join('\n')}/></label>
      <fieldset className="flex flex-wrap gap-3"><legend>Seasonal tags (none means evergreen)</legend>{['spring','summer','autumn','winter'].map(s=><label key={s}><input type="checkbox" name="seasons" value={s} defaultChecked={recipe.seasons?.includes(s)}/> {s}</label>)}</fieldset>
      <div className="flex gap-3"><label>Available from<input className={style} type="date" name="availableFrom" defaultValue={recipe.availableFrom ?? ''}/></label><label>Until<input className={style} type="date" name="availableUntil" defaultValue={recipe.availableUntil ?? ''}/></label></div>
      <Button disabled={pending}>Save recipe</Button><p role="status">{state.message}</p>
      {recipeIsComplete(recipe) && <a className="text-blue-700 underline" href={`/api/admin/weekly-recipe-email/preview?handle=${encodeURIComponent(recipe.handle)}`} target="_blank" rel="noreferrer">Preview recipe email</a>}
    </form>
  </details>
}

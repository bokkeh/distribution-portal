import assert from 'node:assert/strict'
import test from 'node:test'
import { recipeIsComplete, seasonalRecipePool, recipeAvailable, type SelectableRecipe } from './recipe-selection'
const recipe=(extra: Partial<SelectableRecipe> = {}): SelectableRecipe => ({handle:'test',title:'Synthetic cocktail',url:'https://example.test/recipe',imageUrl:null,ingredientGroups:[{heading:null,items:['Synthetic ingredient']}],steps:['Synthetic instruction'],status:'published',...extra})
test('seasonal recipes are preferred with evergreen fallback; drafts and incomplete recipes never qualify',()=>{
 const fall=recipe({handle:'fall',seasons:['autumn']}), summer=recipe({handle:'summer',seasons:['summer']}), evergreen=recipe({handle:'evergreen'})
 assert.deepEqual(seasonalRecipePool([summer,evergreen,fall],'2026-10-30').map(r=>r.handle),['fall'])
 assert.deepEqual(seasonalRecipePool([summer,evergreen,recipe({status:'draft'})],'2026-10-30').map(r=>r.handle),['evergreen'])
 assert.equal(recipeIsComplete(recipe({steps:[]})),false)
 assert.equal(seasonalRecipePool([summer,recipe({status:'draft'})],'2026-10-30').length,0)
})
test('availability windows include endpoints and exclude out-of-window explicit selections',()=>{
 const r=recipe({availableFrom:'2026-10-01',availableUntil:'2026-10-31'})
 assert.equal(recipeAvailable(r,'2026-10-31'),true);assert.equal(recipeAvailable(r,'2026-11-01'),false)
})

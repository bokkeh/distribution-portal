const RECIPES_COLLECTION_URL = 'https://wishervodka.com/collections/recipes'
const RECIPES_FEED_URL = `${RECIPES_COLLECTION_URL}/products.json?limit=250`

/** Recipes on the collection page that are not cocktails on their own. */
const EXCLUDED_HANDLES = new Set(['homemade-holiday-bitters'])

export type WisherRecipeIngredientGroup = {
  heading: string | null
  items: string[]
}

export type WisherRecipe = {
  handle: string
  title: string
  url: string
  imageUrl: string | null
  ingredientGroups: WisherRecipeIngredientGroup[]
  steps: string[]
}

type ShopifyProduct = {
  handle: string
  title: string
  body_html: string | null
  images: Array<{ src: string }>
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
}

function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point = code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10)
      return Number.isFinite(point) ? String.fromCodePoint(point) : match
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

/** Splits a run of <p> blocks into groups (one per paragraph or blank line) of trimmed text lines. */
function toLineGroups(html: string) {
  return html
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\b[^>]*>/gi, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map(stripTags).filter(Boolean))
    .filter((lines) => lines.length > 0)
}

export function parseRecipeBody(bodyHtml: string) {
  const cleaned = bodyHtml
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
  const sections = cleaned.split(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)

  let ingredientsHtml = ''
  let instructionsHtml = ''
  for (let index = 1; index < sections.length; index += 2) {
    const heading = stripTags(sections[index]).toLowerCase()
    const content = sections[index + 1] ?? ''
    if (heading.includes('ingredient')) ingredientsHtml += content
    else if (/instruction|direction|method|steps/.test(heading)) instructionsHtml += content
  }

  // Later groups that start with a non-measured line are sub-recipes ("Infused Apple Cider", "Thyme Bitters").
  const ingredientGroups = toLineGroups(ingredientsHtml).map((lines, index): WisherRecipeIngredientGroup =>
    index > 0 && lines.length > 1 ? { heading: lines[0], items: lines.slice(1) } : { heading: null, items: lines },
  )
  const steps = toLineGroups(instructionsHtml).flat()

  return { ingredientGroups, steps }
}

export async function fetchWisherRecipes(): Promise<WisherRecipe[]> {
  const response = await fetch(RECIPES_FEED_URL, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Wisher recipes feed returned ${response.status}`)
  const payload = (await response.json()) as { products?: ShopifyProduct[] }

  return (payload.products ?? [])
    .filter((product) => !EXCLUDED_HANDLES.has(product.handle))
    .map((product): WisherRecipe => {
      const { ingredientGroups, steps } = parseRecipeBody(product.body_html ?? '')
      const image = product.images[0]?.src
      return {
        handle: product.handle,
        title: product.title.trim(),
        url: `${RECIPES_COLLECTION_URL}/products/${product.handle}`,
        imageUrl: image ? `${image}${image.includes('?') ? '&' : '?'}width=1200` : null,
        ingredientGroups,
        steps,
      }
    })
    .filter((recipe) => recipe.ingredientGroups.length > 0 && recipe.steps.length > 0)
}

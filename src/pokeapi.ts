export type NamedAPIResource = {
  name: string
  url: string
}

export type PokemonTypeName =
  | 'normal'
  | 'fire'
  | 'water'
  | 'electric'
  | 'grass'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy'

export type TypeDamageRelations = {
  double_damage_from: NamedAPIResource[]
  half_damage_from: NamedAPIResource[]
  no_damage_from: NamedAPIResource[]
}

export type TypeInfo = {
  name: PokemonTypeName | string
  damage_relations: TypeDamageRelations
}

export type SpeciesListItem = {
  id: number
  name: string
}

export type PokemonVariety = {
  is_default: boolean
  pokemon: NamedAPIResource
}

export type PokemonSpecies = {
  id: number
  name: string
  varieties: PokemonVariety[]
  evolution_chain: { url: string }
}

export type PokemonTypeSlot = {
  slot: number
  type: NamedAPIResource
}

export type Pokemon = {
  id: number
  name: string
  sprites: {
    front_default: string | null
    other?: Record<string, { front_default?: string | null }>
  }
  types: PokemonTypeSlot[]
  stats: Array<{
    base_stat: number
    effort: number
    stat: NamedAPIResource
  }>
  moves: Array<{
    move: NamedAPIResource
    version_group_details: Array<{
      level_learned_at: number
      move_learn_method: NamedAPIResource
      version_group: NamedAPIResource
    }>
  }>
}

const API = 'https://pokeapi.co/api/v2'

export function extractIdFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/)
  return match ? Number(match[1]) : 0
}

// Simple in-memory caches to keep the app snappy
let speciesListCache: SpeciesListItem[] | null = null
const speciesCache = new Map<number, PokemonSpecies>()
const pokemonCache = new Map<string | number, Pokemon>()
let typesCache: TypeInfo[] | null = null

export async function fetchAllSpeciesList(): Promise<SpeciesListItem[]> {
  if (speciesListCache) return speciesListCache
  const res = await fetch(`${API}/pokemon-species?limit=20000`)
  if (!res.ok) throw new Error('Failed to fetch species list')
  const data = (await res.json()) as { results: NamedAPIResource[] }
  const list: SpeciesListItem[] = data.results
    .map((r) => ({ id: extractIdFromUrl(r.url), name: r.name }))
    .filter((s) => s.id > 0)
    .sort((a, b) => a.id - b.id)
  speciesListCache = list
  return list
}

export async function fetchSpecies(idOrName: number | string): Promise<PokemonSpecies> {
  const keyAsNumber = typeof idOrName === 'number' ? idOrName : undefined
  if (keyAsNumber) {
    const cached = speciesCache.get(keyAsNumber)
    if (cached) return cached
  }
  const res = await fetch(`${API}/pokemon-species/${idOrName}`)
  if (!res.ok) throw new Error('Failed to fetch species')
  const data = (await res.json()) as PokemonSpecies
  const id = data.id
  speciesCache.set(id, data)
  return data
}

export async function fetchPokemon(identifier: number | string): Promise<Pokemon> {
  const key = identifier
  const cached = pokemonCache.get(key)
  if (cached) return cached
  const res = await fetch(`${API}/pokemon/${identifier}`)
  if (!res.ok) throw new Error('Failed to fetch pokemon')
  const data = (await res.json()) as Pokemon
  pokemonCache.set(key, data)
  return data
}

// Evolution chain
export type EvolutionChainLink = {
  species: NamedAPIResource
  evolves_to: EvolutionChainLink[]
}

export type EvolutionChain = {
  id: number
  chain: EvolutionChainLink
}

export async function fetchEvolutionChainByUrl(url: string): Promise<EvolutionChain> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch evolution chain')
  return (await res.json()) as EvolutionChain
}

export function getImmediateEvolutions(chain: EvolutionChain, currentSpeciesName: string): {
  previous: NamedAPIResource[]
  next: NamedAPIResource[]
} {
  const parentByChild = new Map<string, NamedAPIResource[]>()
  const childrenByParent = new Map<string, NamedAPIResource[]>()

  function walk(node: EvolutionChainLink, parent: EvolutionChainLink | null) {
    const name = node.species.name
    if (parent) {
      const pName = parent.species.name
      const parents = parentByChild.get(name) ?? []
      parents.push(parent.species)
      parentByChild.set(name, parents)

      const kids = childrenByParent.get(pName) ?? []
      kids.push(node.species)
      childrenByParent.set(pName, kids)
    }
    for (const child of node.evolves_to) walk(child, node)
  }
  walk(chain.chain, null)

  return {
    previous: parentByChild.get(currentSpeciesName) ?? [],
    next: childrenByParent.get(currentSpeciesName) ?? [],
  }
}

export async function fetchAllTypes(): Promise<TypeInfo[]> {
  if (typesCache) return typesCache
  const res = await fetch(`${API}/type?limit=100`)
  if (!res.ok) throw new Error('Failed to fetch types list')
  const data = (await res.json()) as { results: NamedAPIResource[] }
  const validTypeNames = new Set<string>([
    'normal',
    'fire',
    'water',
    'electric',
    'grass',
    'ice',
    'fighting',
    'poison',
    'ground',
    'flying',
    'psychic',
    'bug',
    'rock',
    'ghost',
    'dragon',
    'dark',
    'steel',
    'fairy',
  ])

  const typeItems = data.results.filter((t) => validTypeNames.has(t.name))
  const types = await Promise.all(
    typeItems.map(async (t) => {
      const r = await fetch(t.url)
      if (!r.ok) throw new Error(`Failed to fetch type ${t.name}`)
      const d = (await r.json()) as TypeInfo
      return d
    })
  )
  // stable order by name
  types.sort((a, b) => a.name.localeCompare(b.name))
  typesCache = types
  return types
}

export type TypeMultiplierMap = Record<string, number>

export function computeTypeEffectiveness(defendingTypeNames: string[], typeInfos: TypeInfo[]): TypeMultiplierMap {
  const typeByName = new Map<string, TypeInfo>(typeInfos.map((t) => [t.name, t]))
  // initialize multipliers for all standard types at 1
  const multipliers: TypeMultiplierMap = {}
  for (const t of typeByName.keys()) multipliers[t] = 1

  for (const attackType of typeByName.keys()) {
    let multiplier = 1
    for (const defending of defendingTypeNames) {
      const defendingType = typeByName.get(defending)
      if (!defendingType) continue
      const rel = defendingType.damage_relations
      if (rel.no_damage_from.some((x) => x.name === attackType)) {
        multiplier *= 0
      } else if (rel.double_damage_from.some((x) => x.name === attackType)) {
        multiplier *= 2
      } else if (rel.half_damage_from.some((x) => x.name === attackType)) {
        multiplier *= 0.5
      }
    }
    multipliers[attackType] = multiplier
  }

  return multipliers
}

export function formatTypeName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function getOfficialArtwork(p: Pokemon): string | null {
  const other = p.sprites.other || {}
  // Prefer 3D model renders from Pokémon HOME when available
  const home = (other['home']?.front_default ?? null) as string | null
  if (home) return home
  // Fallback to Showdown assets if present
  const showdown = (other['showdown']?.front_default ?? null) as string | null
  if (showdown) return showdown
  // Then fallback to official artwork
  const official = (other['official-artwork']?.front_default ?? null) as string | null
  if (official) return official
  return p.sprites.front_default
}

// Moves
export type Move = {
  id: number
  name: string
  power: number | null
  type: NamedAPIResource
  effect_entries: Array<{
    effect: string
    short_effect: string
    language: NamedAPIResource
  }>
  flavor_text_entries?: Array<{
    flavor_text: string
    language: NamedAPIResource
    version_group: NamedAPIResource
  }>
}

const moveCache = new Map<string | number, Move>()

export async function fetchMove(identifier: number | string): Promise<Move> {
  const key = identifier
  const cached = moveCache.get(key)
  if (cached) return cached
  const res = await fetch(`${API}/move/${identifier}`)
  if (!res.ok) throw new Error('Failed to fetch move')
  const data = (await res.json()) as Move
  moveCache.set(key, data)
  return data
}



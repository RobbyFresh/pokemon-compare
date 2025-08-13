import { useEffect, useMemo, useState } from 'react'
import PokemonSelector, { type PokemonSelectorValue } from './PokemonSelector'
import {
  computeTypeEffectiveness,
  fetchAllTypes,
  fetchPokemon,
  fetchSpecies,
  formatTypeName,
  getOfficialArtwork,
  type TypeInfo,
} from '../pokeapi'

type Selection = {
  speciesId: number
  name: string
  formPokemonName?: string
  queryHint?: string
}

type PokemonPanelProps = {
  side: 'left' | 'right'
  opponentTypes?: string[] | null
  onDefendingTypesChange?: (types: string[] | null) => void
}

export default function PokemonPanel({ opponentTypes, onDefendingTypesChange }: PokemonPanelProps) {
  const [selected, setSelected] = useState<Selection | null>(null)
  const [types, setTypes] = useState<TypeInfo[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [artwork, setArtwork] = useState<string | null>(null)
  const [pokemonName, setPokemonName] = useState<string | null>(null)
  const [defendingTypes, setDefendingTypes] = useState<string[] | null>(null)
  const [varieties, setVarieties] = useState<{ label: string; value: string; isDefault: boolean }[] | null>(null)
  const [selectedVariety, setSelectedVariety] = useState<string | null>(null)
  const [evoPrev, setEvoPrev] = useState<{ name: string }[] | null>(null)
  const [evoNext, setEvoNext] = useState<{ name: string }[] | null>(null)
  const [movesLoading, setMovesLoading] = useState(false)
  const [movesError, setMovesError] = useState<string | null>(null)
  const [moves, setMoves] = useState<Array<{ name: string; power: number | null; typeName: string }>>([])
  const [stats, setStats] = useState<{ name: string; value: number }[] | null>(null)
  const [selectedMoveDetail, setSelectedMoveDetail] = useState<{
    name: string
    typeName: string
    power: number | null
    description: string
  } | null>(null)
  const [loadingMoveName, setLoadingMoveName] = useState<string | null>(null)

  useEffect(() => {
    const clear = () => {
      setSelected(null)
      setSelectedVariety(null)
      setArtwork(null)
      setPokemonName(null)
      setDefendingTypes(null)
      setMoves([])
      setSelectedMoveDetail(null)
    }
    window.addEventListener('clear-selections', clear)
    return () => window.removeEventListener('clear-selections', clear)
  }, [])

  useEffect(() => {
    let mounted = true
    fetchAllTypes()
      .then((t) => {
        if (mounted) setTypes(t)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const key: number | string = Number.isFinite(selected.speciesId) && selected.speciesId! > 0
          ? selected.speciesId!
          : (selected.name as string)
        const species = await fetchSpecies(key)
        const items = species.varieties.map((v) => {
          const raw = v.pokemon.name
          const label = raw
            .replaceAll('-', ' ')
            .replace(/\b\w/g, (m) => m.toUpperCase())
          return { label, value: raw, isDefault: v.is_default }
        })
        // sort: default first, then alphabetically
        items.sort((a, b) => (a.isDefault === b.isDefault ? a.label.localeCompare(b.label) : a.isDefault ? -1 : 1))
        setVarieties(items)
        // Attempt to preselect a regional form based on query hint
        let initial = (items.find((i) => i.isDefault) ?? items[0])?.value ?? null
        const hint = selected.queryHint?.toLowerCase() ?? selected.name.toLowerCase()
        if (hint.includes('hisui') || hint.includes('hisuian')) {
          const hisuian = items.find((i) => i.label.toLowerCase().includes('hisui'))
          if (hisuian) initial = hisuian.value
        }
        if (hint.includes('alola') || hint.includes('alolan')) {
          const alolan = items.find((i) => i.label.toLowerCase().includes('alola'))
          if (alolan) initial = alolan.value
        }
        if (hint.includes('galar') || hint.includes('galarian')) {
          const galar = items.find((i) => i.label.toLowerCase().includes('galar'))
          if (galar) initial = galar.value
        }
        if (hint.includes('paldea') || hint.includes('paldean')) {
          const paldea = items.find((i) => i.label.toLowerCase().includes('paldea'))
          if (paldea) initial = paldea.value
        }
        setSelectedVariety(initial)

        // Evolutions
        if (species.evolution_chain?.url) {
          const { getImmediateEvolutions, fetchEvolutionChainByUrl } = await import('../pokeapi')
          const chain = await fetchEvolutionChainByUrl(species.evolution_chain.url)
          const rel = getImmediateEvolutions(chain, species.name)
          setEvoPrev(rel.previous.map((p) => ({ name: p.name })))
          setEvoNext(rel.next.map((n) => ({ name: n.name })))
        } else {
          setEvoPrev(null)
          setEvoNext(null)
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load species')
      } finally {
        setLoading(false)
      }
    })()
  }, [selected])

  useEffect(() => {
    if (!selectedVariety) return
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const pokemon = await fetchPokemon(selectedVariety)
        setPokemonName(pokemon.name)
        setArtwork(getOfficialArtwork(pokemon))
        const defTypes = pokemon.types.map((t) => t.type.name)
        setDefendingTypes(defTypes)
        onDefendingTypesChange?.(defTypes)
        // when navigating by species name (evo buttons), ensure species selection reflects the evo
        if (selected?.speciesId === -1) {
          const species = await fetchSpecies(pokemon.name)
          setSelected({ speciesId: species.id, name: species.name })
        }

        setStats(pokemon.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })))

        // Load moves for the latest available version group for this Pokémon
        setMovesLoading(true)
        setMovesError(null)
        try {
          const { extractIdFromUrl, fetchMove } = await import('../pokeapi')
          // Determine the most recent version group id seen in this Pokémon's move details
          let latestVgId = 0
          for (const m of pokemon.moves) {
            for (const vgd of m.version_group_details) {
              const id = extractIdFromUrl(vgd.version_group.url)
              if (id > latestVgId) latestVgId = id
            }
          }
          // Filter moves that are available in that latest version group
          const usableMoveNames = pokemon.moves
            .filter((m) => m.version_group_details.some((vgd) => extractIdFromUrl(vgd.version_group.url) === latestVgId))
            .map((m) => m.move.name)

          // Fetch move details (power, type)
          const detailList = await Promise.all(
            usableMoveNames.map(async (mn) => {
              try {
                const d = await fetchMove(mn)
                return { name: d.name, power: d.power, typeName: d.type.name }
              } catch {
                return { name: mn, power: null, typeName: 'normal' }
              }
            })
          )

          // Sort by type then power desc then name
          detailList.sort((a, b) =>
            a.typeName === b.typeName
              ? (b.power ?? -1) - (a.power ?? -1) || a.name.localeCompare(b.name)
              : a.typeName.localeCompare(b.typeName)
          )
          setMoves(detailList)
          setSelectedMoveDetail(null)
        } catch (e: any) {
          setMovesError(e?.message ?? 'Failed to load moves')
          setMoves([])
        } finally {
          setMovesLoading(false)
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load Pokémon form')
      } finally {
        setLoading(false)
      }
    })()
  }, [selectedVariety])

  const opponentEffectiveness = useMemo(() => {
    if (!types || !opponentTypes || opponentTypes.length === 0) return null
    return computeTypeEffectiveness(opponentTypes, types)
  }, [types, opponentTypes])

  const sortedMoves = useMemo(() => {
    if (moves.length === 0) return moves
    if (!opponentEffectiveness) return moves
    const scored = moves.map((m) => {
      const mult = opponentEffectiveness[m.typeName] ?? 1
      const basePower = m.power ?? 0
      const score = basePower * mult
      return { ...m, __score: score }
    })
    scored.sort((a, b) => b.__score - a.__score || (b.power ?? -1) - (a.power ?? -1) || a.name.localeCompare(b.name))
    // strip helper
    return scored.map(({ __score, ...rest }) => rest)
  }, [moves, opponentEffectiveness])

  const effectiveness = useMemo(() => {
    if (!types || !defendingTypes) return null
    return computeTypeEffectiveness(defendingTypes, types)
  }, [types, defendingTypes])

  const weaknesses = useMemo(() => {
    if (!effectiveness) return [] as { type: string; mult: number }[]
    return Object.entries(effectiveness)
      .map(([type, mult]) => ({ type, mult }))
      .filter((x) => x.mult > 1)
      .sort((a, b) => b.mult - a.mult || a.type.localeCompare(b.type))
  }, [effectiveness])

  const resistances = useMemo(() => {
    if (!effectiveness) return [] as { type: string; mult: number }[]
    return Object.entries(effectiveness)
      .map(([type, mult]) => ({ type, mult }))
      .filter((x) => x.mult > 0 && x.mult < 1)
      .sort((a, b) => a.mult - b.mult || a.type.localeCompare(b.type))
  }, [effectiveness])

  const immunities = useMemo(() => {
    if (!effectiveness) return [] as { type: string; mult: number }[]
    return Object.entries(effectiveness)
      .map(([type, mult]) => ({ type, mult }))
      .filter((x) => x.mult === 0)
      .sort((a, b) => a.type.localeCompare(b.type))
  }, [effectiveness])

  function getTypeColor(type: string): string {
    switch (type) {
      case 'normal':
        return 'bg-stone-600 text-white'
      case 'fire':
        return 'bg-orange-600 text-white'
      case 'water':
        return 'bg-sky-700 text-white'
      case 'electric':
        return 'bg-yellow-600 text-white'
      case 'grass':
        return 'bg-green-700 text-white'
      case 'ice':
        return 'bg-cyan-700 text-white'
      case 'fighting':
        return 'bg-red-700 text-white'
      case 'poison':
        return 'bg-fuchsia-700 text-white'
      case 'ground':
        return 'bg-amber-700 text-white'
      case 'flying':
        return 'bg-indigo-600 text-white'
      case 'psychic':
        return 'bg-pink-700 text-white'
      case 'bug':
        return 'bg-lime-700 text-white'
      case 'rock':
        return 'bg-yellow-800 text-white'
      case 'ghost':
        return 'bg-violet-700 text-white'
      case 'dragon':
        return 'bg-indigo-800 text-white'
      case 'dark':
        return 'bg-neutral-800 text-white'
      case 'steel':
        return 'bg-slate-600 text-white'
      case 'fairy':
        return 'bg-rose-600 text-white'
      default:
        return 'bg-slate-600 text-white'
    }
  }

  function getMultiplierColor(mult: number): string {
    // Neutral grayscale palette for multipliers
    if (mult === 0) return 'bg-zinc-900 text-white'
    if (mult >= 4) return 'bg-zinc-700 text-white'
    if (mult >= 2) return 'bg-zinc-600 text-white'
    if (mult === 1) return 'bg-zinc-500 text-white'
    if (mult <= 0.25) return 'bg-zinc-300 text-black'
    if (mult < 1) return 'bg-zinc-400 text-black'
    return 'bg-zinc-500 text-white'
  }

  const typeChips = (typesToRender: { type: string; mult: number }[]) => (
    <div className="flex flex-wrap justify-center gap-2">
      {typesToRender.map((t) => (
        <span key={t.type} className="inline-flex items-center">
          <span className={`px-2 py-1 text-xs capitalize rounded-full shadow ring-1 ring-black/5 ${getTypeColor(t.type)}`}>
            {formatTypeName(t.type)}
          </span>
          <span
            className={`-ml-1 px-2 py-1 text-xs tabular-nums rounded-full shadow ring-1 ring-black/5 ${getMultiplierColor(t.mult)}`}
            style={{ paddingLeft: 10 }}
          >
            {t.mult}x
          </span>
        </span>
      ))}
    </div>
  )

  return (
    <div className="flex h-full flex-col gap-3">
      <PokemonSelector
        value={selected as PokemonSelectorValue | null}
        onChange={(v) => setSelected(v ? { speciesId: v.speciesId, name: v.name } : null)}
      />
      <div className={`${selected ? 'details-card p-4' : ''} rounded-2xl border border-transparent shadow-sm backdrop-blur`}>
        {selected && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="text-xl font-semibold capitalize">{pokemonName ?? selected.name}</div>
              <div className="h-6">
                {varieties && varieties.length > 1 && (
                  <div>
                    <select
                      className="rounded-full border border-slate-500/60 bg-slate-700/60 px-3 py-1 text-xs text-slate-100 shadow-sm hover-lift"
                      value={selectedVariety ?? ''}
                      onChange={(e) => setSelectedVariety(e.target.value)}
                    >
                      {varieties.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {artwork && (
                <img
                  src={artwork}
                  alt={pokemonName ?? selected.name}
                  className="h-40 w-40 rounded-2xl object-contain model-bg shadow sm:h-48 sm:w-48"
                  loading="lazy"
                />
              )}
              {defendingTypes && defendingTypes.length > 0 && (
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {defendingTypes.map((t) => (
                    <span key={t} className={`rounded-full px-2 py-0.5 text-xs capitalize ${getTypeColor(t)}`}>
                      {formatTypeName(t)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {loading && <div className="text-sm text-gray-500">Loading…</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}

            {effectiveness && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 h-64 overflow-auto px-1">
                  {(evoPrev?.length || evoNext?.length) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {evoPrev?.map((p) => (
                          <button
                            key={`prev-${p.name}`}
                            className="cursor-pointer rounded-full border border-white/80 ring-1 ring-white/60 bg-gradient-to-r from-cyan-300 to-sky-400 px-3 py-1.5 text-xs font-semibold capitalize text-white shadow-md backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:from-cyan-200 hover:to-sky-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
                            onClick={() => setSelected({ speciesId: -1, name: p.name })}
                            title="Previous evolution"
                            aria-label={`Go to ${p.name.replace('-', ' ')}`}
                          >
                            ← {p.name.replace('-', ' ')}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 ml-auto">
                        {evoNext?.map((n) => (
                          <button
                            key={`next-${n.name}`}
                            className="cursor-pointer rounded-full border border-white/80 ring-1 ring-white/60 bg-gradient-to-r from-cyan-300 to-sky-400 px-3 py-1.5 text-xs font-semibold capitalize text-white shadow-md backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:from-cyan-200 hover:to-sky-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
                            onClick={() => setSelected({ speciesId: -1, name: n.name })}
                            title="Next evolution"
                            aria-label={`Go to ${n.name.replace('-', ' ')}`}
                          >
                            {n.name.replace('-', ' ')} →
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="mb-1 text-center text-sm font-semibold text-slate-200/90">Weaknesses</div>
                    {weaknesses.length ? typeChips(weaknesses) : (
                      <div className="text-xs text-gray-500">None</div>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 text-center text-sm font-semibold text-slate-200/90">Resistances</div>
                    {resistances.length ? typeChips(resistances) : (
                      <div className="text-xs text-gray-500">None</div>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 text-center text-sm font-semibold text-slate-200/90">Immunities</div>
                    {immunities.length ? typeChips(immunities) : <div className="text-xs text-gray-500">None</div>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-3 text-left">
                    <div className="mb-1 pl-[1.375rem] text-left text-sm font-semibold text-slate-200/90">Moveset</div>
                    {movesLoading && <div className="text-xs text-gray-500">Loading moves…</div>}
                    {movesError && <div className="text-xs text-red-600">{movesError}</div>}
                    {!movesLoading && !movesError && (
                      <div className="max-h-80 overflow-auto pr-1">
                        <div className="grid grid-cols-1 gap-1">
                          {sortedMoves.map((mv) => {
                            const isSelected = selectedMoveDetail?.name === mv.name
                            const isLoading = loadingMoveName === mv.name
                            return (
                              <div
                                key={mv.name}
                                className="rounded-2xl border border-slate-600/40 bg-slate-700/40 p-0 shadow hover-lift"
                              >
                                <button
                                  className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-xs text-slate-200 hover:bg-slate-600/40"
                                  onClick={async () => {
                                    // Toggle off if the same move is clicked again
                                    if (selectedMoveDetail?.name === mv.name) {
                                      setSelectedMoveDetail(null)
                                      return
                                    }
                                    setLoadingMoveName(mv.name)
                                    try {
                                      const { fetchMove } = await import('../pokeapi')
                                      const d = await fetchMove(mv.name)
                                      const desc =
                                        d.effect_entries.find((e) => e.language.name === 'en')?.short_effect ??
                                        d.flavor_text_entries
                                          ?.find((e) => e.language.name === 'en')
                                          ?.flavor_text?.replace(/\s+/g, ' ') ??
                                        '—'
                                      setSelectedMoveDetail({
                                        name: mv.name,
                                        typeName: mv.typeName,
                                        power: mv.power,
                                        description: desc,
                                      })
                                    } catch {
                                      setSelectedMoveDetail({
                                        name: mv.name,
                                        typeName: mv.typeName,
                                        power: mv.power,
                                        description: '—',
                                      })
                                    } finally {
                                      setLoadingMoveName(null)
                                    }
                                  }}
                                >
                                  <span className={`rounded-full px-2 py-0.5 capitalize ${getTypeColor(mv.typeName)}`}>
                                    {formatTypeName(mv.typeName)}
                                  </span>
                                  <span className="flex-1 truncate capitalize px-1">{mv.name.replace(/-/g, ' ')}</span>
                                  <span className="tabular-nums text-slate-300">{mv.power ?? '-'}</span>
                                </button>
                                {(isSelected || isLoading) && (
                                  <div className="border-t border-slate-600/40 px-2 py-1 text-xs">
                                    {isLoading ? (
                                      <span className="text-slate-400">Loading…</span>
                                    ) : (
                                      <span className="text-slate-200">{selectedMoveDetail?.description}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2 text-left">
                    {stats && stats.length > 0 && (
                      <div className="text-left">
                        <div className="mb-1 text-center text-sm font-semibold text-slate-200/90">Base Stats</div>
                        <div className="flex flex-col gap-2 rounded-2xl border border-slate-600/40 bg-slate-700/40 p-2 shadow">
                          {stats.map((stat) => {
                            const statColor =
                              stat.value < 60
                                ? 'bg-red-500'
                                : stat.value < 90
                                ? 'bg-yellow-500'
                                : stat.value < 120
                                ? 'bg-green-500'
                                : 'bg-cyan-500'
                            const statLabel = stat.name
                              .replace('special-attack', 'Sp. Atk')
                              .replace('special-defense', 'Sp. Def')
                              .replace('-', ' ')
                              .replace(/\b\w/g, (m) => m.toUpperCase())

                            return (
                              <div key={stat.name} className="grid grid-cols-12 items-center gap-1 text-xs">
                                <span className="col-span-4 truncate text-right text-slate-300">{statLabel}</span>
                                <span className="col-span-2 text-center font-bold tabular-nums text-white">
                                  {stat.value}
                                </span>
                                <div className="col-span-6 w-full rounded-full bg-slate-800/70 h-2.5">
                                  <div
                                    className={`${statColor} h-2.5 rounded-full`}
                                    style={{ width: `${(stat.value / 255) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}



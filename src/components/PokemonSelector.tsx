import { useEffect, useMemo, useState } from 'react'
import { fetchAllSpeciesList, type SpeciesListItem } from '../pokeapi'

export type PokemonSelectorValue = {
  speciesId: number
  name: string
  queryHint?: string
}

type PokemonSelectorProps = {
  value: PokemonSelectorValue | null
  onChange: (value: PokemonSelectorValue | null) => void
}

export default function PokemonSelector({ value, onChange }: PokemonSelectorProps) {
  const [allSpecies, setAllSpecies] = useState<SpeciesListItem[] | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const formatPokemonName = (name: string) =>
    name
      .replace(/-/g, ' ')
      .replace(/(^|\s)\w/g, (m) => m.toUpperCase())

  const getSpriteUrl = (id: number) =>
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`

  useEffect(() => {
    let mounted = true
    fetchAllSpeciesList()
      .then((list) => {
        if (mounted) setAllSpecies(list)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!allSpecies) return [] as SpeciesListItem[]
    const q = query.trim().toLowerCase()
    if (!q) return []
    const asNumber = Number(q)
    if (!Number.isNaN(asNumber)) {
      return allSpecies.filter((s) => String(s.id).startsWith(String(asNumber)))
    }
    return allSpecies.filter((s) => s.name.includes(q))
  }, [allSpecies, query])

  return (
    <div className="relative z-30 w-full hover-lift">
      <input
        className="w-full rounded-2xl border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
        placeholder={value ? `#${value.speciesId} ${formatPokemonName(value.name)}` : 'Search by name or Pokédex #'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay closing to allow click
          setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (filtered.length > 0) {
              const top = filtered[0]
              onChange({ speciesId: top.id, name: top.name, queryHint: query })
              setQuery('')
              setOpen(false)
              e.preventDefault()
              e.stopPropagation()
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && filtered.length > 0 && (
        <div className="dropdown-panel absolute z-50 mt-1 max-h-72 w-full overflow-auto" style={{background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(15,23,42,0.85))', borderColor: 'rgba(51,65,85,0.6)'}}>
          {filtered.map((s) => (
            <button
              key={s.id}
              className="dropdown-item flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/40"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ speciesId: s.id, name: s.name, queryHint: query })
                setQuery('')
                setOpen(false)
              }}
            >
              <img
                src={getSpriteUrl(s.id)}
                alt={s.name}
                loading="lazy"
                className="h-7 w-7 shrink-0 rounded-full bg-white/70 object-contain ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700"
                onError={(e) => {
                  // Hide broken images gracefully
                  ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                }}
              />
              <span className="w-12 shrink-0 tabular-nums text-gray-500">#{s.id}</span>
              <span className="capitalize">{s.name.replace('-', ' ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}



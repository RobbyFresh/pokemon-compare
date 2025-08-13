import type { PokemonTypeName } from './pokeapi'

const typeColorMap: Record<string, string> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
}

function getLuminance(hex: string) {
  const rgb = parseInt(hex.slice(1), 16)
  const r = (rgb >> 16) & 0xff
  const g = (rgb >> 8) & 0xff
  const b = (rgb >> 0) & 0xff
  return 0.2126 * r + 0.7159 * g + 0.0722 * b
}

export function getTypeColors(typeName: string) {
  const bgColor = typeColorMap[typeName] ?? '#FFFFFF'
  const textColor = getLuminance(bgColor) > 128 ? '#000000' : '#FFFFFF'
  return { bgColor, textColor }
}

import PokemonPanel from './components/PokemonPanel'
import { useState } from 'react'
import BackgroundMusic from './components/BackgroundMusic'
import './App.css'

export default function App() {
  const [leftTypes, setLeftTypes] = useState<string[] | null>(null)
  const [rightTypes, setRightTypes] = useState<string[] | null>(null)
  return (
    <div className="relative min-h-screen overflow-hidden text-slate-100">
      <div className="battle-bg" />
      <div className="mx-auto max-w-[1400px] p-4 sm:p-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex-1" />
          <div className="flex items-center justify-center gap-2">
            <img
              src="/pokemon-logo.png"
              alt="Pokémon"
              className="h-10 w-auto sm:h-12 select-none cursor-pointer transition-transform duration-150 hover:scale-105 hover:drop-shadow"
              draggable={false}
              title="Clear selections"
              tabIndex={0}
              onClick={() => {
                // Clear selections on both panels by reloading state via custom event
                const ev = new CustomEvent('clear-selections')
                window.dispatchEvent(ev)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  const ev = new CustomEvent('clear-selections')
                  window.dispatchEvent(ev)
                }
              }}
            />
            <span className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Lookup</span>
          </div>
          <div className="flex-1 flex justify-end">
            <BackgroundMusic />
          </div>
        </div>
        <p className="mb-4 text-center text-sm text-slate-500">Search by name or #; select forms like Hisuian from the dropdown.</p>
        <div className="flex flex-col items-start gap-4 md:flex-row">
          <div className="p-3 flex-1 min-w-0">
            <PokemonPanel
              side="left"
              opponentTypes={rightTypes}
              onDefendingTypesChange={setLeftTypes}
            />
          </div>
          <div className="p-3 flex-1 min-w-0">
            <PokemonPanel
              side="right"
              opponentTypes={leftTypes}
              onDefendingTypesChange={setRightTypes}
            />
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">Data via PokeAPI. Type effectiveness computed vs defending types.</p>
      </div>
    </div>
  )
}

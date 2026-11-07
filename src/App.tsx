import { useState } from 'react'
import { GuessGrid } from './components/GuessGrid'
import { Header, type GameMode } from './components/Header'
import { HelpModal } from './components/HelpModal'
import { SearchBar } from './components/SearchBar'
import { usePokedle } from './hooks/usePokedle'
import { POKEDEX } from './lib/pokedex'

export default function App() {
  const [mode, setMode] = useState<GameMode>('daily')
  const [showHelp, setShowHelp] = useState(false)
  const { guesses, gameStatus, submitGuess } = usePokedle()

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col">
      <Header mode={mode} onModeChange={setMode} onHelp={() => setShowHelp(true)} />
      <main className="flex flex-col gap-4 p-4">
        <SearchBar pokedex={POKEDEX} onGuess={submitGuess} disabled={gameStatus !== 'playing'} />
        <GuessGrid guesses={guesses} />
      </main>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}

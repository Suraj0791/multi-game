// Tournament Header — shows tournament info at the top
// DUMB: receives tournament object, displays it. No API, no state.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Swords, User, IndianRupee, Users, Copy, Check } from 'lucide-react'

const STATUS_LABELS = {
  REGISTRATION: 'Registration Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
}

const STATUS_COLORS = {
  REGISTRATION: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  IN_PROGRESS: 'border-amber-500/30 bg-amber-500/10 text-amber-400 animate-pulse',
  COMPLETED: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
}

export default function TournamentHeader({ tournament }) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const inviteLink = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-950 to-amber-950/10 p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
      {/* Absolute Decorative Glow */}
      <div className="absolute right-0 top-0 -z-10 h-32 w-32 rounded-full bg-amber-500/5 blur-3xl" />
      
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className={`px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[tournament.status] || 'border-neutral-700 bg-neutral-800 text-neutral-300'}`}>
              {STATUS_LABELS[tournament.status] || tournament.status}
            </Badge>
            <span className="text-xs text-neutral-500 font-medium">Created {new Date(tournament.createdAt).toLocaleDateString()}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-amber-400 bg-clip-text text-transparent">
            {tournament.name}
          </h1>
        </div>

        {tournament.status === 'REGISTRATION' && (
          <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 rounded-lg p-2 max-w-full md:max-w-md w-full md:w-auto">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="bg-transparent text-xs text-neutral-400 outline-none px-2 select-all w-full truncate md:w-60"
            />
            <Button
              onClick={handleCopyLink}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold shrink-0 flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Invite Link</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Grid of info boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
          <div className="p-2 rounded-md bg-amber-500/10 text-amber-400">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Game Type</p>
            <p className="text-sm font-medium text-neutral-200">
              {tournament.gameType === 'TRIVIA' ? 'Trivia Showdown' : 'Quick Draw'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
          <div className="p-2 rounded-md bg-amber-500/10 text-amber-400">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Host</p>
            <p className="text-sm font-medium text-neutral-200 truncate max-w-[120px]" title={tournament.hostName}>
              {tournament.hostName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
          <div className="p-2 rounded-md bg-amber-500/10 text-amber-400">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Entry Fee</p>
            <p className="text-sm font-bold text-amber-400">
              {tournament.entryFee > 0 ? `₹${tournament.entryFee}` : 'Free Entry'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
          <div className="p-2 rounded-md bg-amber-500/10 text-amber-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Capacity</p>
            <p className="text-sm font-medium text-neutral-200">
              Max {tournament.maxPlayers} Players
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


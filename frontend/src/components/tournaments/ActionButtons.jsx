// Action Buttons — Join / Leave / Start
// DUMB: Receives boolean props that tell it WHAT to show.
// It doesn't know WHY canJoin is true. The page computed that.
//
// This is a KEY design pattern:
// BAD:  ActionButtons receives tournament + players + userId, computes internally
// GOOD: Page computes canJoin/canLeave/canStart, passes booleans
//
// WHY good? Because the button doesn't need to know about business rules.
// If the rules change ("need 4 players to start" instead of 2),
// you change the PAGE, not this component.

import { Button } from '@/components/ui/button'
import { LogIn, LogOut, Play, Share2, CreditCard, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export default function ActionButtons({
  canJoin,
  canLeave,
  canStart,
  needsPayment,
  startDisabledReason,
  onJoin,
  onLeave,
  onStart,
  onPay,
  isJoining,    // loading state for join
  isLeaving,    // loading state for leave
  isStarting,   // loading state for start
}) {
  const handleCopyInvite = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Tournament invite link copied to clipboard!')
  }

  return (
    <div className="space-y-3 w-full">
      <div className="flex flex-wrap gap-2">
        {canJoin && (
          <Button onClick={onJoin} disabled={isJoining} className="gap-1.5">
            <LogIn className="h-4 w-4" />
            {isJoining ? 'Joining...' : 'Join Tournament'}
          </Button>
        )}

        {needsPayment && (
          <Button onClick={onPay} className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse transition-all">
            <CreditCard className="h-4 w-4" />
            Pay Entry Fee
          </Button>
        )}

        {canLeave && (
          <Button onClick={onLeave} disabled={isLeaving} variant="outline" className="gap-1.5">
            <LogOut className="h-4 w-4" />
            {isLeaving ? 'Leaving...' : 'Leave'}
          </Button>
        )}

        {canStart && (
          <Button 
            onClick={onStart} 
            disabled={isStarting || !!startDisabledReason} 
            variant={startDisabledReason ? "ghost" : "secondary"}
            className={`gap-1.5 ${startDisabledReason ? 'cursor-not-allowed opacity-50 bg-neutral-800 text-neutral-400 border border-neutral-700' : ''}`}
          >
            <Play className="h-4 w-4" />
            {isStarting ? 'Starting...' : 'Start Tournament'}
          </Button>
        )}

        <Button onClick={handleCopyInvite} variant="outline" className="gap-1.5">
          <Share2 className="h-4 w-4" />
          Copy Invite Link
        </Button>
      </div>

      {canStart && startDisabledReason && (
        <div className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md p-3 flex items-center gap-2 max-w-xl">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span>{startDisabledReason}</span>
        </div>
      )}
    </div>
  )
}


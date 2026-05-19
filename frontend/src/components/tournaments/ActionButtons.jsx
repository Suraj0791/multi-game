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
import { LogIn, LogOut, Play } from 'lucide-react'

export default function ActionButtons({
  canJoin,
  canLeave,
  canStart,
  onJoin,
  onLeave,
  onStart,
  isJoining,    // loading state for join
  isLeaving,    // loading state for leave
  isStarting,   // loading state for start
}) {
  return (
    <div className="flex gap-2">
      {canJoin && (
        <Button onClick={onJoin} disabled={isJoining} className="gap-1.5">
          <LogIn className="h-4 w-4" />
          {isJoining ? 'Joining...' : 'Join Tournament'}
        </Button>
      )}

      {canLeave && (
        <Button onClick={onLeave} disabled={isLeaving} variant="outline" className="gap-1.5">
          <LogOut className="h-4 w-4" />
          {isLeaving ? 'Leaving...' : 'Leave'}
        </Button>
      )}

      {canStart && (
        <Button onClick={onStart} disabled={isStarting} variant="secondary" className="gap-1.5">
          <Play className="h-4 w-4" />
          {isStarting ? 'Starting...' : 'Start Tournament'}
        </Button>
      )}
    </div>
  )
}

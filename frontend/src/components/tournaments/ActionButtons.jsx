import { Button } from '@/components/ui/button'
import { AlertTriangle, CreditCard, Link2, Loader2, LogIn, LogOut, Play } from 'lucide-react'
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
  isJoining,
  isLeaving,
  isStarting,
}) {
  const handleCopyInvite = async () => {
    await navigator.clipboard.writeText(window.location.href)
    toast.success('Invite link copied')
  }

  const showStart = canStart
  const hasPrimaryAction = canJoin || needsPayment || (showStart && !startDisabledReason)

  return (
    <section className="rounded-xl border border-border/70 bg-surface/35 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canJoin && (
          <Button onClick={onJoin} disabled={isJoining} className="h-10 sm:min-w-36">
            {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {isJoining ? 'Joining' : 'Join Tournament'}
          </Button>
        )}

        {needsPayment && (
          <Button
            onClick={onPay}
            className="h-10 bg-amber-500 text-neutral-950 hover:bg-amber-400 sm:min-w-36"
          >
            <CreditCard className="h-4 w-4" />
            Pay Entry Fee
          </Button>
        )}

        {canLeave && (
          <Button onClick={onLeave} disabled={isLeaving} variant="outline" className="h-10 sm:min-w-28">
            {isLeaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            {isLeaving ? 'Leaving' : 'Leave'}
          </Button>
        )}

        {showStart && (
          <Button
            onClick={onStart}
            disabled={isStarting || !!startDisabledReason}
            variant={startDisabledReason ? 'outline' : 'secondary'}
            className="h-10 sm:min-w-36"
          >
            {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isStarting ? 'Starting' : 'Start Tournament'}
          </Button>
        )}

        <Button onClick={handleCopyInvite} variant={hasPrimaryAction ? 'ghost' : 'secondary'} className="h-10 sm:min-w-32">
          <Link2 className="h-4 w-4" />
          Copy Invite
        </Button>
      </div>

      {showStart && startDisabledReason && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{startDisabledReason}</span>
        </div>
      )}
    </section>
  )
}

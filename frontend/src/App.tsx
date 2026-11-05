import { useEffect, useState } from 'react'

type Status = 'loading' | 'online' | 'offline'

export default function App() {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/health', { signal: controller.signal })
      .then((response) => setStatus(response.ok ? 'online' : 'offline'))
      .catch(() => {
        if (!controller.signal.aborted) setStatus('offline')
      })
    return () => controller.abort()
  }, [])

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Animated Chart Studio</h1>
        <p className="text-slate-400">
          Backend status: <span data-testid="status">{status}</span>
        </p>
      </div>
    </main>
  )
}

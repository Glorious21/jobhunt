export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="skeleton" style={{ height: 34, width: 280 }} />
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 112 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 260 }} />
    </div>
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}>
      <span className="card-title">Couldn’t load your data</span>
      <span className="muted">{message}</span>
      <button className="btn btn-outline btn-sm" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

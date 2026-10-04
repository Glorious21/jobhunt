'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppData } from '@/components/AppData'
import { StageDot, StatusSelect, hue } from '@/components/StatusBadge'
import { LoadError, PageSkeleton } from '@/components/PageState'
import { isStatus, SOURCE_LABEL, STATUS_HUE, STATUS_LABEL, STATUSES, type Status } from '@/lib/constants'
import { ago, shortDate } from '@/lib/dates'
import type { Application } from '@/lib/types'

type SortKey = 'company' | 'role' | 'status' | 'channel' | 'applied' | 'updated'
const COLUMNS: [SortKey, string][] = [
  ['company', 'Company'],
  ['role', 'Role'],
  ['status', 'Status'],
  ['channel', 'Channel'],
  ['applied', 'Applied'],
  ['updated', 'Updated'],
]
const GRID = 'minmax(140px,1.3fr) minmax(160px,1.3fr) 130px 110px 80px 80px'

const SORTERS: Record<SortKey, (a: Application, b: Application) => number> = {
  company: (a, b) => a.company.localeCompare(b.company),
  role: (a, b) => a.jobTitle.localeCompare(b.jobTitle),
  status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status),
  channel: (a, b) => SOURCE_LABEL[a.source].localeCompare(SOURCE_LABEL[b.source]),
  applied: (a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? ''),
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Applications />
    </Suspense>
  )
}

function Applications() {
  const { applications, loading, error, reload, openEditor, setStatus } = useAppData()
  const params = useSearchParams()
  const statusParam = params.get('status')
  const [filter, setFilter] = useState<Status | 'ALL'>(isStatus(statusParam) ? statusParam : 'ALL')
  const [q, setQ] = useState(params.get('q') ?? '')
  const [view, setView] = useState<'table' | 'board'>('table')
  const [sort, setSort] = useState<SortKey>('updated')

  // Follow links from the pipeline strip and the top-bar search.
  const [lastParams, setLastParams] = useState(params.toString())
  if (lastParams !== params.toString()) {
    setLastParams(params.toString())
    setFilter(isStatus(statusParam) ? statusParam : 'ALL')
    if (params.get('q') !== null) setQ(params.get('q') ?? '')
    if (statusParam) setView('table')
  }

  const matchesQ = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (a: Application) => !needle || `${a.company} ${a.jobTitle}`.toLowerCase().includes(needle)
  }, [q])

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, applications.filter((a) => a.status === s).length])) as Record<Status, number>, [applications])
  const rows = useMemo(
    () => applications.filter((a) => (filter === 'ALL' || a.status === filter) && matchesQ(a)).sort(SORTERS[sort]),
    [applications, filter, matchesQ, sort]
  )

  if (loading) return <PageSkeleton />
  if (error) return <LoadError message={error} onRetry={reload} />

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input className="input" style={{ height: 40, width: 300, maxWidth: '100%', padding: '0 14px' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company or role" aria-label="Search applications" />
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === 'table'} onClick={() => setView('table')}>
            Table
          </button>
          <button aria-pressed={view === 'board'} onClick={() => setView('board')}>
            Board
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="pill" aria-pressed={filter === 'ALL'} onClick={() => setFilter('ALL')}>
          All<span className="count">{applications.length}</span>
        </button>
        {STATUSES.map((s) => (
          <button key={s} className="pill" aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {STATUS_LABEL[s]}
            <span className="count">{counts[s]}</span>
          </button>
        ))}
      </div>

      {view === 'table' ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflowX: 'auto' }}>
          <div style={{ minWidth: 820 }} role="table" aria-label="Applications">
            <div role="row" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 600, background: 'var(--surface-2)' }}>
              {COLUMNS.map(([k, label]) => (
                <button
                  key={k}
                  role="columnheader"
                  aria-sort={sort === k ? 'descending' : 'none'}
                  onClick={() => setSort(k)}
                  style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontWeight: 600, color: sort === k ? 'var(--ink)' : 'var(--muted)' }}
                >
                  {label}
                  {sort === k ? ' ↓' : ''}
                </button>
              ))}
            </div>
            {rows.map((a) => (
              <div
                key={a.id}
                role="row"
                tabIndex={0}
                onClick={() => openEditor({ app: a })}
                onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && openEditor({ app: a })}
                className="table-row"
                style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--line-3)', cursor: 'pointer' }}
              >
                <span className="truncate" style={{ fontWeight: 600 }}>
                  {a.company}
                </span>
                <span className="truncate ink-2">{a.jobTitle}</span>
                <StatusSelect value={a.status} onChange={(s) => setStatus(a, s)} label={`Status for ${a.company}`} />
                <span className="muted truncate">{SOURCE_LABEL[a.source]}</span>
                <span className="mono muted" style={{ fontSize: 12 }}>
                  {shortDate(a.appliedAt)}
                </span>
                <span className="faint" style={{ fontSize: 12 }}>
                  {ago(a.updatedAt)}
                </span>
              </div>
            ))}
            {rows.length === 0 && <div className="empty">No applications match.</div>}
          </div>
        </div>
      ) : (
        <Board apps={applications.filter(matchesQ)} onOpen={(a) => openEditor({ app: a })} onMove={setStatus} />
      )}
    </div>
  )
}

function Board({ apps, onOpen, onMove }: { apps: Application[]; onOpen: (a: Application) => void; onMove: (a: Application, s: Status) => void }) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<Status | null>(null)
  const [popId, setPopId] = useState<string | null>(null)
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (popTimer.current) clearTimeout(popTimer.current)
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(200px, 1fr))', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {STATUSES.map((s) => {
        const items = apps.filter((a) => a.status === s)
        const over = overCol === s
        return (
          <section
            key={s}
            aria-label={STATUS_LABEL[s]}
            onDragOver={(e) => {
              e.preventDefault()
              if (overCol !== s) setOverCol(s)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/plain') || dragId
              setOverCol(null)
              setDragId(null)
              const app = apps.find((a) => a.id === id)
              if (!app) return
              setPopId(app.id)
              if (popTimer.current) clearTimeout(popTimer.current)
              popTimer.current = setTimeout(() => setPopId(null), 450)
              onMove(app, s)
            }}
            style={{
              background: over ? 'var(--lime-tint)' : 'var(--line-2)',
              outline: `2px dashed ${over ? 'var(--forest)' : 'transparent'}`,
              outlineOffset: -2,
              transition: 'background-color .15s, outline-color .15s',
              borderRadius: 14,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minHeight: 420,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                <StageDot status={s} />
                {STATUS_LABEL[s]}
              </span>
              <span className="mono faint" style={{ fontSize: 11 }}>
                {items.length}
              </span>
            </div>
            {items.map((a) => (
              <div
                key={a.id}
                draggable
                tabIndex={0}
                role="button"
                aria-label={`${a.company}, ${a.jobTitle}. ${STATUS_LABEL[a.status]}.`}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', a.id)
                  e.dataTransfer.effectAllowed = 'move'
                  // Defer so the drag image is captured before the card fades.
                  setTimeout(() => setDragId(a.id), 0)
                }}
                onDragEnd={() => {
                  setDragId(null)
                  setOverCol(null)
                }}
                onClick={() => onOpen(a)}
                onKeyDown={(e) => e.key === 'Enter' && onOpen(a)}
                className="hover-lift"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  cursor: 'grab',
                  opacity: dragId === a.id ? 0.35 : 1,
                  animation: popId === a.id ? 'jhDrop .4s cubic-bezier(.2,.8,.2,1)' : undefined,
                  ...hue(STATUS_HUE[s]),
                }}
              >
                <span style={{ fontWeight: 600 }}>{a.company}</span>
                <span className="muted" style={{ fontSize: 13 }}>
                  {a.jobTitle}
                </span>
                <span className="faint" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                  <span>{SOURCE_LABEL[a.source]}</span>
                  <span>{ago(a.updatedAt)}</span>
                </span>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

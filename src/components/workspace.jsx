import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useRouterState } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CalendarDays, ChevronRight, CircleHelp, CreditCard, FolderClosed, LayoutDashboard, LogOut, Menu, Monitor, Moon, ReceiptText, Settings2, Sun, X } from 'lucide-react'
import { localDay } from '../lib/finance.js'
import { readPlan, changePlan, localFile } from '../lib/local-store.js'

const Workspace = createContext(null)
export const useWorkspace = () => useContext(Workspace)
const navigation = [
  ['/', 'Overview', LayoutDashboard], ['/bills', 'Bills', ReceiptText],
  ['/subscriptions', 'Subscriptions', CreditCard], ['/vault', 'Document vault', FolderClosed],
  ['/alerts', 'Alerts', Bell], ['/settings', 'Settings', Settings2],
]

export function WorkspaceProvider({ children }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }))
  return <QueryClientProvider client={client}><WorkspaceState>{children}</WorkspaceState></QueryClientProvider>
}

function WorkspaceState({ children }) {
  const cache = useQueryClient()
  const [mode, setMode] = useState(null)
  const [theme, setTheme] = useState('light')
  const [today, setToday] = useState(null)
  const channel = useRef(null)
  useEffect(() => {
    let initialMode = 'local'
    let selectedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    try {
      if (sessionStorage.getItem('finease-example') === 'yes') initialMode = 'example'
      selectedTheme = localStorage.getItem('finease-theme') || selectedTheme
    } catch { /* The theme can still be changed when preferences cannot be stored. */ }
    setMode(initialMode)
    setTheme(selectedTheme)
    const clock = () => setToday(localDay())
    clock()
    const timer = setInterval(clock, 60_000)
    window.addEventListener('focus', clock)
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('finease-changes')
      channel.current.onmessage = () => cache.invalidateQueries({ queryKey: ['plan'] })
    }
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', clock)
      channel.current?.close()
    }
  }, [cache])

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  const queryKey = ['plan', mode]
  const plan = useQuery({
    queryKey,
    enabled: !!mode,
    queryFn: () => readPlan(mode),
  })
  const refresh = async () => {
    channel.current?.postMessage('change')
    await cache.invalidateQueries({ queryKey })
  }
  async function save(collection, values, { id, file } = {}) {
    await changePlan(mode, (data, files) => {
      if (collection === 'profile') { data.profile = values; return }
      const key = id ?? crypto.randomUUID()
      if (file) files.put(file, mode + '/' + key)
      if (!id) { data[collection].push({ ...values, id: key }); return }
      const index = data[collection].findIndex((entry) => entry.id === id)
      if (index < 0) throw new Error('This item was removed. Refresh to see the current list.')
      data[collection][index] = { ...data[collection][index], ...values }
    })
    await refresh()
  }
  async function remove(collection, id) {
    await changePlan(mode, (data, files) => {
      data[collection] = data[collection].filter((item) => item.id !== id)
      if (collection === 'documents') files.delete(mode + '/' + id)
    })
    await refresh()
  }
  async function fileUrl(item) {
    return URL.createObjectURL(await localFile(mode, item.id))
  }
  function selectExample(enabled) {
    try { sessionStorage.setItem('finease-example', enabled ? 'yes' : 'no') } catch { /* Session-only selection. */ }
    setMode(enabled ? 'example' : 'local')
  }
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    try { localStorage.setItem('finease-theme', next) } catch { /* Use the in-memory preference. */ }
  }
  return (
    <Workspace.Provider value={{
      workspace: plan.data, mode, today, user: null, signedOut: false, theme, toggleTheme,
      error: plan.error, retry: () => plan.refetch(),
      save, remove, fileUrl, refresh, selectExample,
    }}>{children}</Workspace.Provider>
  )
}

export function Wordmark() {
  return <span className="wordmark" aria-label="FinEase">Fin<i>Ease</i></span>
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useWorkspace()
  const Icon = theme === 'light' ? Moon : Sun
  return <button type="button" className="icon-button" onClick={toggleTheme}
    aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}>
    <Icon size={18} aria-hidden="true" />
  </button>
}

export function StatusScreen({ error, retry }) {
  return <main className="status-screen"><Wordmark />
    {error ? <><h1>Couldn’t open your plan</h1><p role="alert">{error.message}</p>
      <button className="button primary" onClick={retry}>Try again</button></>
      : <p role="status">Opening your plan…</p>}
  </main>
}

export function WorkspacePage({ children }) {
  const { workspace, signedOut, error, retry } = useWorkspace()
  if (signedOut) return <Navigate to="/login" replace />
  if (error || !workspace) return <StatusScreen error={error} retry={retry} />
  if (!workspace.profile) return <Navigate to="/onboarding" replace />
  return <Shell>{children}</Shell>
}

function Shell({ children }) {
  const { mode, selectExample, today } = useWorkspace()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [menu, setMenu] = useState(false)
  const page = navigation.find(([to]) => to === pathname)?.[1] || 'Overview'
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(today)
  return <div className="shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar">
      <div className="brand-row"><Link to="/" aria-label="FinEase overview"><Wordmark /></Link>
        <button className="icon-button menu-toggle" aria-label={menu ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menu} aria-controls="workspace-nav" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
      </div>
      <div id="workspace-nav" className={'side-content ' + (menu ? 'open' : '')}>
        <nav aria-label="Workspace">{navigation.map(([to, name, Icon]) =>
          <Link key={to} to={to} activeOptions={{ exact: true }} onClick={() => setMenu(false)}>
            <Icon size={19} aria-hidden="true" />{name}
          </Link>)}</nav>
        <div className="side-footer">
          {mode === 'example' ? <button className="quiet-button" onClick={() => selectExample(false)}><LogOut size={17} />Leave example</button>
            : <div className="side-status"><Monitor size={16} />Saved in this browser</div>}
        </div>
      </div>
    </aside>
    <div className="page-area"><header className="topbar">
      <span className="breadcrumb">{mode === 'example' ? 'Example plan' : 'My plan'} <ChevronRight size={13} /> <strong>{page}</strong></span>
      <span className="top-tools"><span className="today-date"><CalendarDays size={15} />{date}</span><ThemeToggle /></span>
    </header><main className="content" id="main">{children}</main></div>
  </div>
}

export function PageTitle({ title, children, action }) {
  return <header className="page-title"><div><h1>{title}</h1>{children && <p>{children}</p>}</div>{action}</header>
}

export function EmptyState({ children, icon: Icon = CircleHelp }) {
  return <div className="empty-state"><Icon aria-hidden="true" size={22} /><p>{children}</p></div>
}

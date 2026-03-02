import { useState, useEffect, useRef } from 'react'
import { palette } from '../theme/tokens.js'
import { icons } from './icons.jsx'

const APPS = [
  { id: 'accounting', name: 'Accounting', url: 'https://accounting.manaakumal.com', icon: icons.appAccounting },
  { id: 'cms', name: 'Client Management', url: 'https://cms.manaakumal.com', icon: icons.appCms },
  { id: 'investors', name: 'Investor Portal', url: 'https://investors.manaakumal.com', icon: icons.appInvestors },
]

/**
 * App switcher dropdown in the top bar.
 * @param {object} props
 * @param {string} props.currentAppId - The ID of the current app
 * @param {string[]} [props.appAccess] - IDs of apps the user can access (all if empty)
 */
export function AppSwitcher({ currentAppId, appAccess }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const visibleApps = appAccess?.length
    ? APPS.filter(a => appAccess.includes(a.id))
    : APPS

  const currentApp = APPS.find(a => a.id === currentAppId)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border-none cursor-pointer"
        style={{ background: open ? 'rgba(206,158,98,0.08)' : 'transparent', color: palette.black }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(206,158,98,0.08)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ color: palette.gold }}>{icons.appSwitcher}</span>
        {currentApp && (
          <span className="text-[0.75rem] font-semibold">{currentApp.name}</span>
        )}
        <span style={{ color: '#a0a0a0', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          {icons.chevron}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          width: 240, background: '#fff', borderRadius: 8,
          boxShadow: '0 8px 32px rgba(44,44,44,0.12)', border: `1px solid ${palette.border}`, zIndex: 1000,
          overflow: 'hidden',
        }}>
          {visibleApps.map(app => {
            const isCurrent = app.id === currentAppId
            return (
              <button
                key={app.id}
                onClick={() => {
                  if (!isCurrent) window.location.href = app.url
                  setOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 border-none cursor-pointer transition-colors"
                style={{
                  background: isCurrent ? 'rgba(206,158,98,0.08)' : '#fff',
                  color: isCurrent ? palette.gold : palette.black,
                  borderBottom: `1px solid ${palette.cream}`,
                }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = palette.cream }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = '#fff' }}
              >
                <span style={{ color: isCurrent ? palette.gold : '#a0a0a0' }}>{app.icon}</span>
                <span className="text-[0.75rem] font-medium">{app.name}</span>
                {isCurrent && (
                  <span className="ml-auto text-[0.6rem] font-semibold uppercase tracking-wider" style={{ color: palette.gold }}>Current</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

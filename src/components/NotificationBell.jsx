import { useState, useEffect, useRef, useCallback } from 'react'
import { palette, themeColors } from '../theme/tokens.js'
import { icons } from './icons.jsx'

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

/**
 * Notification bell for the sidebar footer.
 *
 * @param {object} props
 * @param {Array} props.notifications - Array of { id, subject, body, status, notification_type, created_at, related_id }
 * @param {number} props.unreadCount
 * @param {function} props.onMarkAllRead
 * @param {function} props.onClickNotification - (notification) => void
 * @param {boolean} props.sidebarOpen
 * @param {string} [props.label] - Label text (default "Notifications")
 */
export function NotificationBell({
  notifications = [],
  unreadCount = 0,
  onMarkAllRead,
  onClickNotification,
  sidebarOpen,
  label = 'Notifications',
}) {
  const [showPanel, setShowPanel] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setShowPanel(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleNotifClick = useCallback((n) => {
    onClickNotification?.(n)
    setShowPanel(false)
  }, [onClickNotification])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="w-full flex items-center rounded-lg transition-all duration-150 border-none cursor-pointer mb-1"
        style={{
          gap: sidebarOpen ? 10 : 0,
          padding: sidebarOpen ? '7px 10px' : '7px 0',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          background: showPanel ? 'rgba(206,158,98,0.12)' : 'transparent',
          color: showPanel ? palette.gold : '#a0a0a0',
        }}
        onMouseEnter={e => { if (!showPanel) { e.currentTarget.style.background = 'rgba(206,158,98,0.06)'; e.currentTarget.style.color = palette.gold }}}
        onMouseLeave={e => { if (!showPanel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a0a0a0' }}}
      >
        <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20, height: 20, position: 'relative' }}>
          {icons.bell}
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -4, background: palette.red, color: '#fff',
              fontSize: '0.5rem', fontWeight: 700, borderRadius: 99, minWidth: 14, height: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </span>
        {sidebarOpen && <span className="text-[0.67rem] font-medium">{label}</span>}
      </button>

      {showPanel && (
        <div style={{
          position: 'absolute', bottom: '100%', left: sidebarOpen ? 0 : -140, marginBottom: 4,
          width: 320, maxHeight: 400, overflowY: 'auto', background: themeColors.s, borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: `1px solid ${themeColors.border}`, zIndex: 1000,
        }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${themeColors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '0.78rem', color: themeColors.t1 }}>
              {label} {unreadCount > 0 && `(${unreadCount})`}
            </span>
            {unreadCount > 0 && onMarkAllRead && (
              <button onClick={onMarkAllRead} style={{ border: 'none', background: 'none', color: themeColors.gold, fontSize: '0.68rem', fontWeight: 500, cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: themeColors.t3, fontSize: '0.75rem' }}>No notifications</div>
          ) : (
            notifications.slice(0, 10).map(n => {
              const typeColors = { approval_request: themeColors.gold, approved: themeColors.gold, rejected: themeColors.error, payment_complete: themeColors.gold }
              return (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  style={{
                    padding: '10px 16px', borderBottom: `1px solid ${themeColors.s2}`, cursor: 'pointer',
                    background: n.status !== 'read' ? themeColors.accentSubtle : themeColors.s,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = themeColors.s2 }}
                  onMouseLeave={e => { e.currentTarget.style.background = n.status !== 'read' ? themeColors.accentSubtle : themeColors.s }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: typeColors[n.notification_type] || themeColors.info, marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: n.status !== 'read' ? 600 : 400, color: themeColors.t1, lineHeight: 1.3 }}>{n.subject || n.title}</div>
                      {n.body && <div style={{ fontSize: '0.62rem', color: themeColors.t3, marginTop: 1, lineHeight: 1.3 }}>{n.body}</div>}
                      <div style={{ fontSize: '0.62rem', color: themeColors.t3, marginTop: 2 }}>{getTimeAgo(n.created_at)}</div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

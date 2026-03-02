import { palette } from '../theme/tokens.js'
import { icons } from './icons.jsx'

export function AccountMenu({ email, onSignOut, sidebarOpen }) {
  return (
    <>
      <button
        onClick={onSignOut}
        className="w-full flex items-center rounded-lg transition-all duration-150 border-none cursor-pointer mt-1"
        style={{
          gap: sidebarOpen ? 10 : 0,
          padding: sidebarOpen ? '7px 10px' : '7px 0',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          background: 'transparent',
          color: '#a0a0a0',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(206,158,98,0.06)'; e.currentTarget.style.color = palette.gold }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a0a0a0' }}
      >
        <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20, height: 20 }}>
          {icons.logout}
        </span>
        {sidebarOpen && <span className="text-[0.67rem] font-medium">Sign Out</span>}
      </button>

      {sidebarOpen && email && (
        <div className="mt-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(206,158,98,0.06)' }}>
          <div className="text-[0.6rem] truncate" style={{ color: '#a0a0a0' }}>
            {email}
          </div>
        </div>
      )}
    </>
  )
}

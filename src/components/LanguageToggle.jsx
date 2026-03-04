import { palette } from '../theme/tokens.js'

const LANG_ORDER = ['es', 'en', 'pt']
const LANG_FLAGS = { es: '\u{1F1F2}\u{1F1FD}', en: '\u{1F1FA}\u{1F1F8}', pt: '\u{1F1E7}\u{1F1F7}' }
const LANG_LABELS = { es: 'Español', en: 'English', pt: 'Português' }

export function LanguageToggle({ locale, onToggle, sidebarOpen }) {
  // Show the NEXT language that will be activated on click
  const currentIdx = LANG_ORDER.indexOf(locale)
  const nextIdx = (currentIdx + 1) % LANG_ORDER.length
  const nextLang = LANG_ORDER[nextIdx]

  return (
    <button
      onClick={onToggle}
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
      title={LANG_LABELS[nextLang]}
    >
      <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20, height: 20, fontSize: '0.82rem' }}>
        {LANG_FLAGS[locale]}
      </span>
      {sidebarOpen && (
        <span className="text-[0.67rem] font-medium">
          {LANG_LABELS[locale]}
        </span>
      )}
    </button>
  )
}

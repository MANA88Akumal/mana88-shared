import { themeColors } from '../theme/tokens.js'
import { AppSwitcher } from './AppSwitcher.jsx'

/**
 * Thin top bar (~44px) with app switcher and optional right-side content.
 * @param {object} props
 * @param {string} props.appId
 * @param {string[]} [props.appAccess]
 * @param {React.ReactNode} [props.rightSlot] - Optional right-side content (notifications etc. handled per-app)
 */
export function TopBar({ appId, appAccess, rightSlot }) {
  return (
    <div
      className="flex items-center justify-between px-4 border-b"
      style={{
        height: 44,
        borderColor: themeColors.border,
        background: themeColors.s,
      }}
    >
      <AppSwitcher currentAppId={appId} appAccess={appAccess} />
      {rightSlot && (
        <div className="flex items-center gap-2">
          {rightSlot}
        </div>
      )}
    </div>
  )
}

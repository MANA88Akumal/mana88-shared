import { createContext, useState, useEffect, useCallback } from 'react'
import {
  getSharedAuthCookie,
  clearSharedAuthCookie,
  setSharedAuthCookie,
  isTokenExpired,
  parseJwtPayload,
} from './supabase.js'

export const AuthContext = createContext(null)

const LOGIN_URL = 'https://login.manaakumal.com'

/**
 * Unified auth provider — works across all MANA 88 apps.
 *
 * Auth flow:
 * 1. Check URL hash for tokens (from login portal redirect)
 * 2. Check existing shared cookie
 * 3. On failure → redirect to login portal
 *
 * @param {object} props
 * @param {string} props.appId - 'accounting' | 'cms' | 'investors'
 * @param {function} [props.onAuthenticated] - Called with { user, token } after successful auth
 * @param {React.ReactNode} props.children
 */
export function AuthProvider({ appId, onAuthenticated, children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const redirectToLogin = useCallback(() => {
    clearSharedAuthCookie()
    const returnUrl = encodeURIComponent(window.location.href)
    window.location.href = `${LOGIN_URL}?returnTo=${returnUrl}`
  }, [])

  // Initial auth check
  useEffect(() => {
    const hash = window.location.hash
    const cookieSession = getSharedAuthCookie()

    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1))
      const access_token = params.get('access_token')

      if (access_token) {
        if (isTokenExpired(access_token)) {
          redirectToLogin()
          return
        }

        const payload = parseJwtPayload(access_token)
        if (!payload) {
          redirectToLogin()
          return
        }

        const userData = { id: payload.sub, email: payload.email }
        setUser(userData)
        setProfile({ approved: true, role: 'admin' })

        // Store in cookie
        const refresh_token = params.get('refresh_token')
        const expires_at = params.get('expires_at')
        setSharedAuthCookie({ access_token, refresh_token, expires_at })

        window.history.replaceState(null, '', window.location.pathname)
        onAuthenticated?.({ user: userData, token: access_token })
      }
      setLoading(false)
    } else if (cookieSession?.access_token) {
      if (isTokenExpired(cookieSession.access_token)) {
        redirectToLogin()
        return
      }

      const payload = parseJwtPayload(cookieSession.access_token)
      if (!payload) {
        redirectToLogin()
        return
      }

      const userData = { id: payload.sub, email: payload.email }
      setUser(userData)
      setProfile({ approved: true, role: 'admin' })
      onAuthenticated?.({ user: userData, token: cookieSession.access_token })
      setLoading(false)
    } else {
      redirectToLogin()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic token expiry check
  useEffect(() => {
    const interval = setInterval(() => {
      const cookieSession = getSharedAuthCookie()
      if (cookieSession?.access_token && isTokenExpired(cookieSession.access_token)) {
        redirectToLogin()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [redirectToLogin])

  const signOut = useCallback(() => {
    clearSharedAuthCookie()
    window.location.href = LOGIN_URL
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isApproved: !!profile?.approved,
      isAdmin: profile?.role === 'admin',
      isStaff: profile?.role === 'staff' || profile?.role === 'admin',
      isBroker: profile?.role === 'broker',
      isInvestor: profile?.role === 'investor',
      signOut,
      refreshProfile: () => {},
    }}>
      {children}
    </AuthContext.Provider>
  )
}

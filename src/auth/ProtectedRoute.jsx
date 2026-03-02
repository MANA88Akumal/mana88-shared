import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth.js'
import { palette } from '../theme/tokens.js'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: palette.cream }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse" style={{ background: palette.black }}>
          <span className="text-white font-bold text-2xl">M</span>
        </div>
        <div className="animate-spin rounded-full h-8 w-8 mx-auto" style={{ border: `2px solid ${palette.border}`, borderTopColor: palette.gold }} />
        <p className="mt-4 text-sm" style={{ color: '#9a9a9a' }}>Loading...</p>
      </div>
    </div>
  )
}

/** Requires authentication + approval */
export function ProtectedRoute({ children }) {
  const { user, loading, isApproved } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isApproved) return <Navigate to="/pending-approval" replace />
  return children
}

/** Requires admin role */
export function AdminRoute({ children }) {
  const { user, loading, isAdmin, isApproved } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isApproved) return <Navigate to="/pending-approval" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

/** Requires staff or admin role */
export function StaffRoute({ children }) {
  const { user, loading, isStaff, isApproved } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isApproved) return <Navigate to="/pending-approval" replace />
  if (!isStaff) return <Navigate to="/" replace />
  return children
}

/** Public route — redirects to dashboard if already logged in */
export function PublicRoute({ children, redirectTo = '/' }) {
  const { user, loading, isApproved } = useAuth()

  if (loading) return <LoadingScreen />
  if (user && isApproved) return <Navigate to={redirectTo} replace />
  return children
}

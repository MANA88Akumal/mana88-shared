import { createContext, useEffect, useState } from 'react'

export const TenantContext = createContext(null)

const DEFAULT_TENANT = {
  id: null,
  slug: 'mana88',
  name: 'MANA 88 Akumal',
  domain: 'manaakumal.com',
  logo_url: 'https://manaakumal.com/wp-content/uploads/2025/06/logo-white-simple.png',
  brand_primary: '#ce9e62',
  brand_secondary: '#2c2c2c',
  brand_accent: '#c1432e',
  brand_bg: '#faf8f5',
  enabled_apps: ['accounting', 'cms', 'investors'],
  settings: {},
}

/**
 * Tenant context + CSS custom property branding.
 * For now, always uses MANA 88 defaults.
 * When multi-tenant DB is deployed, will fetch from user_roles → tenants.
 */
export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(DEFAULT_TENANT)

  // Apply brand CSS variables
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--mana-gold', tenant.brand_primary)
    root.style.setProperty('--mana-black', tenant.brand_secondary)
    root.style.setProperty('--mana-red', tenant.brand_accent)
    root.style.setProperty('--mana-cream', tenant.brand_bg)
  }, [tenant])

  return (
    <TenantContext.Provider value={{ tenant, setTenant }}>
      {children}
    </TenantContext.Provider>
  )
}

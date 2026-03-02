import { useContext } from 'react'
import { I18nContext } from './I18nProvider.jsx'

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Fallback for components used outside provider
    return {
      t: (key) => key,
      locale: 'es',
      setLocale: () => {},
    }
  }
  return ctx
}

import { useAuth } from '@/contexts/AuthContext'
import { getAvatarSrcSet, getOptimizedAvatarUrl } from '@/lib/avatar-utils'
import { useEffect } from 'react'

const PRELOAD_ID = 'skale-avatar-preload'

/** Precarga el avatar solo cuando el shell de la app (TopBar) está montado. */
export function usePreloadUserAvatar() {
  const { user } = useAuth()

  useEffect(() => {
    if (typeof document === 'undefined' || !user?.avatar_url) return

    const href = getOptimizedAvatarUrl(user.avatar_url, 32, user.updated_at)
    const srcset = getAvatarSrcSet(user.avatar_url, 32, user.updated_at)
    if (!href) {
      document.getElementById(PRELOAD_ID)?.remove()
      return
    }

    const existing = document.getElementById(PRELOAD_ID) as HTMLLinkElement | null
    const link = existing ?? document.createElement('link')
    link.id = PRELOAD_ID
    link.rel = 'preload'
    link.as = 'image'
    link.href = href
    if (srcset) link.setAttribute('imagesrcset', srcset)
    link.setAttribute('fetchpriority', 'high')
    if (!existing) document.head.appendChild(link)
  }, [user?.avatar_url, user?.updated_at])
}

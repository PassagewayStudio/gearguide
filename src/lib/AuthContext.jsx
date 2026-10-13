import React, { createContext, useState, useContext, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setIsLoadingAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoadingAuth(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const logout = useCallback((shouldRedirect = true) => {
    setUser(null)
    return db.auth.logout(shouldRedirect ? window.location.href : undefined)
  }, [])

  const navigateToLogin = useCallback(() => {
    db.auth.redirectToLogin(window.location.pathname + window.location.search)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoadingAuth, authChecked: !isLoadingAuth, logout, navigateToLogin }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

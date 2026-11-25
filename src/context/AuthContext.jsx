import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function toInternalEmail(identifier) {
  const clean = String(identifier || '').trim().toLowerCase()
  if (clean.includes('@')) return clean
  return `${clean}@expensetracker.local`
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Profile fetch error:', error)
      return { profile: null, error }
    }
    return { profile: data, error: null }
  }

  useEffect(() => {
    let mounted = true

    async function init() {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!mounted) return

      if (currentSession?.user) {
        const { profile: prof } = await fetchProfile(currentSession.user.id)
        if (!mounted) return

        if (prof && prof.status === 'approved') {
          setSession(currentSession)
          setProfile(prof)
        } else {
          await supabase.auth.signOut()
          setSession(null)
          setProfile(null)
        }
      }
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
      } else if (newSession) {
        setSession(newSession)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function login(identifier, password, expectedRole) {
    const email = toInternalEmail(identifier)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data?.user) {
      return { error: 'Invalid login ID or password.' }
    }

    const { profile: prof, error: profError } = await fetchProfile(data.user.id)
    if (profError || !prof) {
      await supabase.auth.signOut()
      const detail = profError
        ? `${profError.code || ''} ${profError.message}`.trim()
        : 'Row not returned'
      return { error: `Profile error: ${detail}` }
    }

    if (expectedRole === 'admin' && prof.role !== 'admin') {
      await supabase.auth.signOut()
      return { error: 'This login page is for Admin only. Use the User Login page.' }
    }

    if (expectedRole === 'user' && prof.role === 'admin') {
      await supabase.auth.signOut()
      return { error: 'Admin accounts cannot log in here. Use the Admin Login page.' }
    }

    if (prof.status === 'pending') {
      await supabase.auth.signOut()
      return { error: 'Your registration request is still waiting for Admin approval.' }
    }

    if (prof.status === 'rejected') {
      await supabase.auth.signOut()
      return { error: 'Your registration request was rejected by the Admin.' }
    }

    if (prof.status === 'disabled') {
      await supabase.auth.signOut()
      return { error: 'Your account has been disabled by the Admin.' }
    }

    setSession(data.session)
    setProfile(prof)
    return { profile: prof }
  }

  async function register({
    fullName,
    mobileNumber,
    password,
    employmentStatus,
    currentActivity,
    registrationReason,
    monthStartDay,
  }) {
    const cleanMobile = String(mobileNumber || '').replace(/\D/g, '')
    if (cleanMobile.length !== 10) {
      return { error: 'Enter a valid 10-digit mobile number.' }
    }
    if (!password || password.length < 6) {
      return { error: 'Password must be at least 6 characters.' }
    }

    const { error } = await supabase.auth.signUp({
      email: toInternalEmail(cleanMobile),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          mobile_number: cleanMobile,
          employment_status: employmentStatus,
          current_activity: currentActivity.trim(),
          registration_reason: registrationReason.trim(),
          month_start_day: Number(monthStartDay),
        },
      },
    })

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        return { error: 'This mobile number is already registered.' }
      }
      return { error: error.message }
    }

    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    return { success: true }
  }

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  async function refreshProfile() {
    if (!session?.user) return
    const { profile: prof } = await fetchProfile(session.user.id)
    if (prof && prof.status === 'approved') {
      setProfile(prof)
    } else {
      await logout()
    }
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, login, register, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
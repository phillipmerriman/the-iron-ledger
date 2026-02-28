import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isDev } from '@/lib/supabase'
import { seedExercisesIfNeeded } from '@/lib/seed-exercises'
import type { Profile } from '@/types/database'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (fields: Partial<Profile>) => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

// Mock data used when Supabase env vars are not configured
const MOCK_USER = { id: 'dev-user', email: 'dev@localhost' } as User
const MOCK_SESSION = { user: MOCK_USER } as Session
const MOCK_PROFILE: Profile = {
  id: 'dev-user',
  email: 'dev@localhost',
  display_name: 'Dev User',
  avatar_url: null,
  unit_system: 'imperial',
  preferred_weight_unit: 'lbs',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(isDev ? MOCK_SESSION : null)
  const [user, setUser] = useState<User | null>(isDev ? MOCK_USER : null)
  const [profile, setProfile] = useState<Profile | null>(isDev ? MOCK_PROFILE : null)
  const [loading, setLoading] = useState(!isDev)

  useEffect(() => {
    if (isDev) {
      seedExercisesIfNeeded(MOCK_USER.id)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    return { error: error as Error | null }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  async function updateProfile(fields: Partial<Profile>) {
    if (!user) return
    if (isDev) {
      setProfile((prev) => prev ? { ...prev, ...fields } : prev)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', user.id)
      .select()
      .single()
    if (data) setProfile(data)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signUp, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// The app works fully offline (data saved on the device). When these two
// variables are set, history, mantras and images are also synced to Supabase.
export const supabase = url && anonKey ? createClient(url, anonKey) : null

let userPromise = null

/** Returns the signed-in user's id, signing in anonymously the first time. */
export function getUserId() {
  if (!supabase) return Promise.resolve(null)
  if (!userPromise) {
    userPromise = (async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) return data.session.user.id
      const { data: signIn, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      return signIn.user.id
    })().catch(err => {
      userPromise = null
      throw err
    })
  }
  return userPromise
}

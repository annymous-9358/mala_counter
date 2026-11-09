# Jain Mala Counter

A mobile-first jaap counter.

- **Any count** – 108, 54, 27, 1008, a custom number, or no limit. Optionally repeats malas automatically.
- **Tap or bell (danka) counting** – teach the app your own bell (3 rings) and it counts only sounds that
  match it; claps, voices and other bells are ignored. Strictness, loudness and minimum gap are adjustable.
- **Mantras** – Navkar Mantra built in; add, edit and delete your own. The mantra shows while you count.
- **Images** – choose the built-in image, upload your own photos, or show none.
- **History** – every completed or saved mala with time, duration, mantra and counting mode, plus a
  7-day chart, weekly totals and a daily streak.
- **Timer** – starts with the first bead, can be paused.

Everything is saved on the device. When Supabase is configured, history, mantras and images are also
synced to the cloud (changes made offline are queued and uploaded later).

## Development

```bash
npm install
npm run dev
```

## Connecting Supabase

1. Create a project at https://supabase.com (free tier is fine).
2. **SQL Editor → New query**: paste `supabase/schema.sql` and run it. This creates the `sessions`,
   `mantras` and `images` tables with row-level security and the public `mala-images` storage bucket.
3. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**. Each device gets its own
   private account automatically; no login screen is needed.
4. **Project Settings → API**: copy the Project URL and the `anon` public key.
5. In **Netlify → Site configuration → Environment variables** add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`, then trigger a new deploy. For local development put them in `.env.local`
   (see `.env.example`).

The sync badge in the app header shows **Synced**, **Offline**, **Not synced** or **On this device**
(Supabase not configured).

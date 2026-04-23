# GRIND — Social Study App for HSC Students

Turn studying into a competition.

## Stack
React + Vite · Firebase (Auth, Firestore, Storage) · Tailwind CSS · Vercel

## Setup

1. Create a Firebase project, enable Email/Password Auth, Firestore, and Storage.
2. Copy `.env.example` → `.env` and fill in your Firebase config.
3. `npm install && npm run dev`
4. Deploy: `vercel --prod` (add env vars in Vercel dashboard)

## Features
- Study timer with subject picker and circular ring
- Live leaderboard (friends ranked by weekly hours, resets Monday)
- 1v1 battles — challenge friends, longest study session wins
- Prove It — 60-second photo challenge mid-battle or session ends
- Streaks + badges at 7, 30, 100 days

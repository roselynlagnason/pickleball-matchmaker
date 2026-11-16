# OPENPLAY — Pickleball Open Play Manager

A React + Vite single-court doubles session manager.

## Run locally

1. Install Node.js (18+ recommended).
2. Extract this folder.
3. Open a terminal in the project folder.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open the local URL printed by Vite (usually http://localhost:5173).

## Features
- Register players with name, gender, and category (Mixed, Men's, Women's).
- Mixed doubles automatically requires 2 men and 2 women, with one of each on each team.
- Men's and Women's doubles require four active players of the matching gender.
- Random first match for the session; later pairings use win/loss rates, team competitiveness, and avoid repeat partners where possible.
- One active match at a time (one court).
- Record winner and optional score; wins/losses update automatically.
- Player rankings, match history, CSV export, pause/unpause players.
- Session data persists in browser localStorage on the device where it is used.

## Pairing logic
The first match uses a random shuffle. Subsequent matches enumerate valid doubles pairings for the selected division, then score candidate team splits. The score favors similar player records within partnerships, competitive team averages, and a strong penalty for repeating a previous partnership. If every possible partnership has already occurred, the system still produces the best available valid matchup.

## Notes / current scope
- This is a local-first frontend starter. It does not include accounts, cloud sync, or multi-device shared data.
- Only one court and one active match are supported, as requested.
- Players remain eligible for future rounds after their match is recorded. Paused players are excluded from new pairings.
- Changing a player's category affects future matches; match history retains the category and player IDs used at the time.

# 🩴 GPL Online

> A real-time, multiplayer web app to celebrate birthdays the Indian engineering way—virtually!

In Indian engineering hostels, there is a fun (but awkward) way of celebrating anything: we hit the birthday person on their bums. They scream for their life, but the hitting goes on! It might sound crazy, but that’s the way we celebrate. 

**GPL Online** replicates this exact experience virtually so you can celebrate friends online even when you aren't together offline. Create a sharable link, invite the gang, and unleash the digital chappals and belts!

---

## ✨ Features

- 🎮 **Real-time Multiplayer:** Using Supabase Realtime, all hits, combos, and rage meters are synchronized across everyone's screens instantly with zero lag.
- 🎨 **Cartoon Physics & Vectors:** Custom HTML5 Canvas engine featuring smooth, rounded vector characters that physically react and bounce when hit.
- 📸 **Face Detection Magic:** Upload a photo of the celebrant and the app automatically detects and crops their face to attach to the in-game character using `@vladmandic/face-api`.
- 🩴 **Arsenal of Weapons:** Choose between a Chapaat (slap), Chappal (slipper), or Belt. Each has different damage, sounds, and animations.
- 💥 **Combos & Rage:** Hit fast enough to build up a combo multiplier. Max out the Rage Meter to trigger the ultimate "GPL OVERDRIVE" screen explosion!
- 📊 **Persistent Leaderboards:** Your hits are permanently recorded in the room. Compete with your friends to see who can deliver the most damage.
- 🧹 **Auto-Cleanup:** Rooms and uploaded photos are automatically purged from the database after 24 hours to ensure zero clutter.

---

## 🚀 Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5 Canvas, CSS (No heavy frameworks!)
- **Tooling:** Vite (Lightning-fast dev server and bundler)
- **Backend / Database:** Supabase (PostgreSQL, Realtime Broadcasts, Storage)
- **Face Processing:** `face-api.js`
- **Effects:** `canvas-confetti`

---

## 🛠️ Local Development Setup

To run this project locally, you will need [Node.js](https://nodejs.org/) installed and a free [Supabase](https://supabase.com/) account.

### 1. Clone & Install
```bash
git clone https://github.com/RKRJ7/gpl-online.git
cd gpl-online
npm install
```

### 2. Supabase Setup
1. Create a new Supabase project.
2. Go to the **SQL Editor** and run the contents of `supabase/schema.sql`. This will:
   - Create the necessary tables (`rooms`, `room_hits`).
   - Create the `pg_cron` jobs to auto-delete old rooms.
   - Set up the database triggers to auto-delete photos.
3. Go to **Database > Extensions** and enable `pg_cron`.
4. Go to **Storage** and ensure a public bucket named `celebrant-photos` exists.

### 3. Environment Variables
Copy the example environment file and fill in your Supabase credentials:
```bash
cp .env.example .env
```
Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the `.env` file.

### 4. Run the Dev Server
```bash
npm run dev
```
Open `http://localhost:5174` in your browser.

---

## 🌐 Deployment

This project is optimized to be deployed seamlessly on **Vercel** or **Netlify**. 
Just connect your GitHub repository, set the build command to `npm run build`, output directory to `dist`, and remember to add your Supabase Environment Variables in their dashboard!

---

*Made with ❤️ by RKRJ7*

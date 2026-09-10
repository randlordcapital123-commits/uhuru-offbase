# 🚀 QUICK START — Get Your Dashboard & Numbers Working

Your site is ready to load the dashboard and save numbers! Just **3 steps**:

## Step 1: Get Your Supabase Credentials (2 minutes)
1. Go to **https://app.supabase.com**
2. Sign in to your project
3. In the left sidebar, click **Settings → API**
4. You'll see two values:
   - **Project URL** — copy this (looks like `https://abcdef123.supabase.co`)
   - **anon public** — copy this (a long string like `eyJhbGc...`)
   - ⚠️ **DO NOT copy service_role key** — that stays secret!

## Step 2: Put Credentials in app.js
1. Open `app.js` in any text editor (Notepad, VS Code, etc.)
2. Find these lines near the top (around line 12–13):
   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
   ```
3. Replace them with **your actual values** from Step 1:
   ```js
   const SUPABASE_URL = "https://abcdef123.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
   ```
4. **Save the file**

## Step 3: Push to GitHub Pages
1. Open your terminal/command line
2. Navigate to your repository folder
3. Run these commands:
   ```bash
   git add app.js
   git commit -m "Add Supabase credentials"
   git push origin main
   ```
   (Replace `main` with your branch name if different)

4. Wait ~2 minutes for GitHub Pages to deploy
5. Refresh your site — **Dashboard should now load!** 📊

---

## ✅ How to Verify It's Working

Once you've done the 3 steps above:
- **Open your site** in the browser
- Click the **Dashboard** tab
- You should see stat cards with:
  - Total contacts
  - Revenue (quoted vs. paid)
  - Sales pipeline breakdown
  - Activity charts

**If you see a red error message instead:** The credentials are still missing or wrong. Copy them again from Supabase (Step 1) and paste into app.js.

---

## 🆘 Troubleshooting

**Q: Where exactly do I find the Project URL?**
A: In Supabase dashboard → Settings (⚙️) → API → look for "Project URL" at the top

**Q: The anon key is super long — am I copying the right thing?**
A: Yes! It's supposed to be long (usually 200+ characters). It starts with something like `eyJhbGc...`

**Q: Do I need to run supabase-schema.sql again?**
A: No — if you already set up Supabase and have a `contacts` table, you're good. Just add your credentials.

**Q: GitHub Pages says 404 or the site is blank?**
A: Make sure you pushed to the right branch (usually `main` or `gh-pages`). Check your GitHub Pages settings: Settings → Pages → should show your branch.

**Q: "Database error" appears on the page?**
A: The app loaded but couldn't connect. Double-check your credentials in app.js — they might have a typo or space at the end.

---

## 📱 Save Numbers on the Dashboard

Once connected:
1. **Add contacts** using the form at the top
2. Click **Dashboard** to see your totals
3. Edit any contact to update:
   - Quote price (R)
   - Amount paid (R)
   - Status (Called, Agreed, Building, Live)
   - Follow-up date

All changes **auto-save to Supabase** — no manual saves needed! ✨

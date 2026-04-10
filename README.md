# 🌹 Derby Betting App

A mobile-first pari-mutuel betting app for your Kentucky Derby party. Guests visit the URL on their phones to place bets. You manage everything from the admin panel.

---

## How It Works

- **Pari-mutuel pool:** All bets go into a single pot. You keep a cut (the "rake," default 15%). The rest is paid out to whoever picked the winning horse, split proportionally by how much each person bet.
- **Live odds:** Displayed on every horse card and update automatically as bets come in.
- **You're in control:** Open betting, close it when the race starts, declare the winner, and see exactly who gets paid and how much.

---

## Deploying to Vercel (free, about 15 minutes)

Vercel is a free hosting platform that works perfectly for this app.

### Step 1 — Put the code on GitHub

1. Go to github.com and create a free account if you don't have one
2. Create a new repository by clicking the "+" in the top right and selecting "New repository"
3. On the new empty repo page, click "uploading an existing file"
4. Unzip the downloaded file on your computer, open the derby-app folder, select everything inside it, and drag it all into GitHub
5. Click "Commit changes"

### Step 2 — Deploy to Vercel

1. Go to vercel.com and sign in with your GitHub account
2. Click "Add New Project" and select your GitHub repository
3. Leave all settings as-is and click Deploy
4. In about 60 seconds your app will be live at a URL like https://derby-betting.vercel.app

### Step 3 — Add a database (so bets persist)

1. In your Vercel project dashboard, click the Storage tab
2. Click "Create Database" and choose Upstash from the Marketplace section
3. Select Redis when prompted, pick the free tier, and create it
4. Once created, copy the REST URL and REST Token that Upstash shows you
5. In your Vercel project go to Settings, then Environment Variables, and add two entries:
   - First entry: Key is KV_REST_API_URL, Value is the REST URL you copied
   - Second entry: Key is KV_REST_API_TOKEN, Value is the REST Token you copied
6. Go to Deployments and click Redeploy

### Step 4 — Set your admin password

1. Still in Settings, then Environment Variables, add one more entry
2. Key is ADMIN_PASSWORD, Value is whatever password you want for the host panel
3. Click Save, then go to Deployments and click Redeploy one more time

---

## Running Your Party

### Before the race
Open the app on your phone and go to your-url.vercel.app/admin and log in with your password. Confirm the status shows BETTING OPEN. Share the main URL with guests via a group text or show a QR code on a TV — they just open it on their phones, enter their name, and start betting.

### When the race is about to start
Tap "Close Betting" in the admin panel to lock in all bets.

### After the race
Tap "Declare Winner," select the winning horse, and the app immediately shows you each winner's name and exact dollar payout. Collect from the losers and pay out the winners!

### For the next race
Tap "Reset Race" to clear all bets and start fresh.

---

## Customizing the Horses

The app comes loaded with placeholder horse names. To update them with the real Derby field, you'll need to edit the horse list in the code. The list appears in three places — the main betting page, the admin panel, and the race API file. Each entry has a post number, horse name, jockey name, and a color code for the silks. Just swap out the names and numbers to match the official entry list, which is published about two weeks before the race.

---

## Changing Bet Limits

The current limits are $100 maximum per single bet and $200 maximum total per person. These can be adjusted in the betting API file if you want higher or lower limits for your crowd.

---

## The Math

With a 15% rake and $500 in total bets, you keep $75 guaranteed regardless of who wins, and the winners split $425. If $200 total was bet on the winning horse and someone personally bet $20, they receive $42.50 — more than double their money. The fewer people who pick the winner, the bigger each individual payout.

---

## Tech Notes

Built with Next.js, hosted free on Vercel, uses Upstash Redis to store bets. No servers to manage and no ongoing costs for a party-sized event.

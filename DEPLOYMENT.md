# Deployment - Quick Start Guide

## 🚀 Fastest Way: GitHub Pages

### Step 1: Create GitHub Account
Go to [github.com](https://github.com) and sign up (if you don't have an account)

### Step 2: Create New Repository
1. Click "+" in top right → "New repository"
2. Repository name: `vyasa-puja-2025` (or any name you like)
3. Set to **Public**
4. Click "Create repository"

### Step 3: Upload Files

**Option A: Using GitHub Web Interface (Easiest)**
1. On your repository page, click "uploading an existing file"
2. Drag all files and folders from `vyasPujaSite` folder
3. Write commit message: "Initial commit"
4. Click "Commit changes"

**Option B: Using Git Command Line**
```bash
# Navigate to your project folder
cd c:\vyasPujaProject\vyasPujaSite

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Vyasa Puja website"

# Add remote (replace YOUR-USERNAME and REPO-NAME)
git remote add origin https://github.com/YOUR-USERNAME/vyasa-puja-2025.git

# Push
git branch -M main
git push -u origin main
```

### Step 4: Enable GitHub Pages
1. Go to repository → **Settings** tab
2. Click **Pages** in left sidebar
3. Under "Source":
   - Branch: `main`
   - Folder: `/ (root)`
4. Click **Save**
5. Wait 1-2 minutes

### Step 5: Access Your Website
Your site will be live at:
```
https://YOUR-USERNAME.github.io/vyasa-puja-2025/
```

---

## ⚡ Alternative: Netlify (No Git Required)

### Method: Drag & Drop

1. Go to [app.netlify.com](https://app.netlify.com/)
2. Sign up (free) with email or GitHub
3. Drag the entire `vyasPujaSite` folder onto the page
4. Wait 30 seconds
5. Your site is live! (random URL like `random-name-12345.netlify.app`)

### Custom Domain (Optional)
1. Click "Domain settings"
2. Click "Add custom domain"
3. Follow instructions

---

## 🎯 Alternative: Vercel

1. Go to [vercel.com](https://vercel.com/)
2. Sign up with GitHub
3. Click "Add New" → "Project"
4. Import your GitHub repository
5. Click "Deploy"
6. Done! Your site is live

---

## 🖥️ Local Testing First

Before deploying, test locally:

**Using Python:**
```bash
cd c:\vyasPujaProject\vyasPujaSite
python -m http.server 8000
```
Then visit: `http://localhost:8000`

**Using Node.js:**
```bash
npx serve
```

---

## 📝 Custom Domain Setup

### For GitHub Pages:
1. Buy domain from Namecheap, GoDaddy, etc.
2. In repository Settings → Pages → Custom domain
3. Enter your domain (e.g., `vyasapuja2025.com`)
4. In your domain registrar, add DNS records:
   ```
   Type: A
   Name: @
   Value: 185.199.108.153
   Value: 185.199.109.153
   Value: 185.199.110.153
   Value: 185.199.111.153
   
   Type: CNAME
   Name: www
   Value: YOUR-USERNAME.github.io
   ```

### For Netlify:
1. In Netlify Dashboard → Domain Settings
2. Click "Add custom domain"
3. Follow automatic DNS setup

---

## 🔒 HTTPS/SSL

- **GitHub Pages**: Automatic (free)
- **Netlify**: Automatic (free)
- **Vercel**: Automatic (free)

---

## 📊 Analytics

Google Analytics (`G-CS3RYDL2F6`) is already included in the `<head>` of all four pages (`index.html`, `offerings.html`, `offer.html`, `lectures.html`). Each successful submission also sends an `offering_submitted` event. To use a different property, replace the ID in all four files:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

---

## ✍️ Online Submissions (Google Apps Script)

Hosting stays static. Offerings that devotees write on `offer.html` are saved to a Google Sheet by a small Apps Script web app, and moderators publish them by ticking **Approved**.

1. Follow [backend/google-apps-script/README.md](backend/google-apps-script/README.md) to set up the sheet and deploy the script.
2. Paste the web-app URL (ending in `/exec`) into `submissionEndpoint` in `scripts/config.js`.
3. Commit and push. GitHub Pages redeploys in a minute or two.

Until step 2 is done, the site works exactly as before: the archive is readable, and the form explains that offerings are not open yet.

---

## ✅ Pre-Deployment Checklist

- [ ] Test locally over HTTP (`python -m http.server 8000`)
- [ ] Home page shows counts and the garland of names
- [ ] **Read offerings**: year switch, search, country/city filters, reader (←/→, Esc), share link
- [ ] **Offer yours**: draft is kept after a reload; validation messages; a test offering reaches the sheet
- [ ] A test offering appears on **Read offerings** after ticking **Approved**, and disappears after unticking
- [ ] **Lectures**: days, topics expand, PDF opens
- [ ] Mobile layout (≈375px wide) and keyboard-only navigation
- [ ] `scripts/config.js`: `currentYear`, `submissionsOpen` and `closesOn` are correct for this season

---

## 🎉 You're Done!

Share your website URL with devotees worldwide!

**All Glories to Srila Prabhupada!**  
**All Glories to HH Radhanath Swami Maharaj!**

# Push to GitHub - Step by Step Guide

## ⚠️ Git Not Installed

Git is not currently installed on your system. Here are your options:

---

## 🚀 EASIEST METHOD: GitHub Web Upload (No Git Required)

### Step 1: Create GitHub Account & Repository

1. Go to [github.com](https://github.com) and sign up/login
2. Click the **"+"** button (top right) → **"New repository"**
3. Fill in:
   - **Repository name**: `vyasa-puja-2025` (or your choice)
   - **Description**: "75th Vyasa Puja Offerings - HH Radhanath Swami Maharaj"
   - **Public** (so it can be hosted on GitHub Pages)
   - ✅ Check "Add a README file"
4. Click **"Create repository"**

### Step 2: Upload Files via Web

1. On your new repository page, click **"Add file"** → **"Upload files"**
2. Open File Explorer: `C:\vyasPujaProject\vyasPujaSite`
3. **Select ALL files and folders**:
   - index.html
   - offerings.html
   - csvjson.json
   - README.md
   - DEPLOYMENT.md
   - .gitignore
   - styles/ (folder)
   - scripts/ (folder)
   - assets/ (folder)
4. **Drag and drop** them onto the GitHub page
5. Scroll down, write commit message: "Initial commit - Vyasa Puja website"
6. Click **"Commit changes"**

### Step 3: Enable GitHub Pages

1. Go to **Settings** tab (in your repository)
2. Click **"Pages"** in left sidebar
3. Under "Build and deployment":
   - **Source**: Deploy from a branch
   - **Branch**: `main`
   - **Folder**: `/ (root)`
4. Click **"Save"**
5. Wait 1-2 minutes

### Step 4: Access Your Website

Your site will be live at:
```
https://YOUR-USERNAME.github.io/vyasa-puja-2025/
```

---

## 💻 ALTERNATIVE: Install Git First

### Option A: Install Git for Windows

1. Download from: [git-scm.com/download/win](https://git-scm.com/download/win)
2. Run installer (use default settings)
3. Restart PowerShell
4. Return to this guide and use Git commands below

### Option B: Install GitHub Desktop (Easier)

1. Download from: [desktop.github.com](https://desktop.github.com)
2. Install and sign in with GitHub account
3. Click "Add" → "Add Existing Repository"
4. Browse to: `C:\vyasPujaProject\vyasPujaSite`
5. Click "Publish repository"
6. Choose settings and publish
7. Enable GitHub Pages (see Step 3 above)

---

## 📝 Git Commands (After Installing Git)

Once Git is installed, run these commands in PowerShell:

```powershell
# Navigate to project
cd C:\vyasPujaProject\vyasPujaSite

# Initialize repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Vyasa Puja website"

# Add remote (replace YOUR-USERNAME)
git remote add origin https://github.com/YOUR-USERNAME/vyasa-puja-2025.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🎯 ULTRA FAST: Netlify Drag & Drop

Don't want to use GitHub? Deploy instantly:

1. Go to [app.netlify.com](https://app.netlify.com)
2. Sign up (free)
3. Drag the entire `vyasPujaSite` folder onto the page
4. Wait 30 seconds
5. Your site is LIVE! 🎉

URL will be something like: `random-name-12345.netlify.app`

You can customize it later in settings.

---

## ✅ Recommended Approach

**For beginners**: Use GitHub Web Upload (Method 1)
- No installation needed
- Simple drag & drop
- Free hosting with GitHub Pages
- Professional URL

**For quick deployment**: Use Netlify
- Fastest option (30 seconds)
- No Git knowledge needed
- Auto-deploys on updates

**For developers**: Install Git/GitHub Desktop
- Better version control
- Easier updates
- Professional workflow

---

## 🆘 Need Help?

1. **GitHub Web Upload** is the easiest - just drag files
2. **Netlify** is the fastest - instant deployment
3. **Git commands** require installation first

Choose whichever method you're comfortable with!

---

**All Glories to Srila Prabhupada!**  
**All Glories to HH Radhanath Swami Maharaj!**

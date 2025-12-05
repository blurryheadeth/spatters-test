# GitHub + Vercel Automatic Deployment Guide

## 🎯 Goal

Set up automatic deployments so that pushing to GitHub automatically updates your Vercel deployment.

---

## 📋 Prerequisites

- ✅ GitHub account
- ✅ Repository: https://github.com/blurryheadeth/spatters
- ✅ Vercel account (free tier works)
- ✅ API code in `/api` folder
- ⚠️ Alchemy API key (see API_RPC_SOLUTION.md first!)

---

## Part 1: Prepare Your Repository

### Step 1: Create `.gitignore` for API (if not exists)

Create `/api/.gitignore`:
```
node_modules/
.env
.env.local
dist/
*.log
.DS_Store
```

### Step 2: Create Vercel Configuration

Create `/api/vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.ts"
    }
  ],
  "env": {
    "NETWORK": "sepolia",
    "PORT": "3000"
  }
}
```

### Step 3: Update `package.json`

Ensure `/api/package.json` has:
```json
{
  "name": "spatters-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch server.ts",
    "start": "node --loader tsx server.ts",
    "build": "tsc"
  },
  "dependencies": {
    "express": "^4.18.2",
    "viem": "^2.0.0",
    "puppeteer": "^21.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

### Step 4: Commit and Push to GitHub

```bash
cd /Users/glenalbo/Desktop/spatters

# Check status
git status

# Add the API folder
git add api/

# Commit
git commit -m "Add Spatters API with Vercel config"

# Push to GitHub
git push origin main
```

---

## Part 2: Connect GitHub to Vercel

### Step 1: Go to Vercel Dashboard

1. Visit https://vercel.com/dashboard
2. Click "Add New..." → "Project"

### Step 2: Import GitHub Repository

1. Click "Import Git Repository"
2. If not connected, click "Connect GitHub Account"
3. Authorize Vercel to access your repositories
4. Find and select `blurryheadeth/spatters`

### Step 3: Configure Project Settings

**Root Directory:**
```
api
```
(Important! Tell Vercel the API is in the `/api` folder)

**Framework Preset:**
```
Other (or leave as "Other")
```

**Build Command:** (leave default or empty)
```
npm run build
```

**Output Directory:** (leave default)
```
(empty)
```

**Install Command:**
```
npm install
```

### Step 4: Add Environment Variables

Click "Environment Variables" and add:

| Name | Value | Environment |
|------|-------|-------------|
| `NETWORK` | `sepolia` | Production, Preview, Development |
| `PORT` | `3000` | Production, Preview, Development |
| `ALCHEMY_API_KEY` | `your_alchemy_key` | Production, Preview, Development |

**Important:** Get your Alchemy API key from https://www.alchemy.com/ first!

### Step 5: Deploy!

Click "Deploy" and wait 1-2 minutes.

---

## Part 3: Verify Deployment

### Step 1: Check Deployment Status

Vercel will show:
- ✅ Building...
- ✅ Deploying...
- ✅ Ready!

You'll get a URL like:
```
https://spatters-api-abc123.vercel.app
```

### Step 2: Test Your API

```bash
# Health check:
curl https://your-deployment-url.vercel.app/health

# Expected response:
{
  "status": "ok",
  "network": "sepolia",
  "totalSupply": "1",
  "contracts": {
    "spatters": "0xb974f4e503E18d03533d0E64692E927d806677b0",
    "generator": "0x0e0BA1EE77567b99ab4aEde8AC10C4C4874d4530"
  }
}
```

### Step 3: Test Token Endpoint

```bash
# Token HTML (requires Alchemy key to work):
curl https://your-deployment-url.vercel.app/token/1

# Should return full HTML with embedded p5.js and spatters.js
```

---

## Part 4: Set Up Automatic Deployments

### ✅ Automatic Deployments Are Already Active!

Once you've connected GitHub to Vercel:

**Every push to `main` branch:**
- Triggers automatic deployment
- Vercel builds and deploys your API
- Updates live URL automatically
- Takes ~1-2 minutes

**Every pull request:**
- Gets its own preview deployment
- Unique URL for testing
- Doesn't affect production

### Test It:

1. Make a change to `/api/server.ts`
2. Commit and push:
   ```bash
   git add api/server.ts
   git commit -m "Update API"
   git push origin main
   ```
3. Go to Vercel dashboard
4. Watch automatic deployment happen!

---

## Part 5: Custom Domain (Optional)

### Step 1: Buy Domain

Buy from: Namecheap, GoDaddy, or Vercel

### Step 2: Add to Vercel

1. Go to Project Settings → Domains
2. Add your domain: `api.spatters.art`
3. Follow DNS instructions

### Step 3: Update Contract

```bash
npx hardhat console --network sepolia

> const s = await ethers.getContractAt("Spatters", "0xb974f4e503E18d03533d0E64692E927d806677b0")
> await s.setBaseURI("https://api.spatters.art/token/")
```

---

## Part 6: Update Spatters Contract

Once your API is deployed and working:

```bash
cd /Users/glenalbo/Desktop/spatters
npx hardhat console --network sepolia
```

In the console:
```javascript
// Get contract instance
const spatters = await ethers.getContractAt(
  "Spatters", 
  "0xb974f4e503E18d03533d0E64692E927d806677b0"
);

// Set baseURI to your Vercel URL (replace with your actual URL!)
await spatters.setBaseURI("https://your-deployment-url.vercel.app/token/");

// Wait for transaction...

// Verify:
await spatters.baseURI();
// Should return: "https://your-deployment-url.vercel.app/token/"

// Test tokenURI:
await spatters.tokenURI(1);
// Should return: "https://your-deployment-url.vercel.app/token/1"
```

---

## Part 7: Monitoring & Debugging

### View Logs in Vercel

1. Go to your project in Vercel dashboard
2. Click "Deployments"
3. Click on a deployment
4. Click "Functions" → "server"
5. View real-time logs

### Common Issues

#### Issue: "Runtime Error"
**Check:**
- All environment variables are set
- Alchemy API key is correct
- All dependencies installed

#### Issue: "404 Not Found"
**Check:**
- `vercel.json` is in `/api` folder
- Root directory is set to `api`
- Routes are configured correctly

#### Issue: "Timeout"
**Check:**
- Alchemy API key is working
- RPC endpoint is accessible
- Token actually exists on-chain

#### Issue: "Build Failed"
**Check:**
- `package.json` has all dependencies
- TypeScript compiles without errors
- Node version is >= 18

---

## Part 8: GitHub Workflow Summary

### Your New Workflow:

```
1. Make changes locally
   ↓
2. git add, commit, push
   ↓
3. Vercel auto-detects push
   ↓
4. Vercel builds & deploys
   ↓
5. New version live in ~2 min
```

### Branch Strategy:

- **`main` branch** → Production deployment
- **`develop` branch** → Staging deployment (optional)
- **Pull requests** → Preview deployments

### Setting Up Staging (Optional):

1. Create `develop` branch:
   ```bash
   git checkout -b develop
   git push origin develop
   ```

2. In Vercel project settings:
   - Go to Settings → Git
   - Set production branch: `main`
   - Enable preview deployments for: `develop`

Now:
- Push to `main` → Updates production
- Push to `develop` → Creates preview URL

---

## ✅ Checklist

Before going live:

- [ ] Repository pushed to GitHub
- [ ] Vercel connected to GitHub
- [ ] Alchemy API key added to Vercel
- [ ] API successfully deployed
- [ ] Health endpoint works
- [ ] Token endpoint works (with Alchemy)
- [ ] Contract baseURI updated
- [ ] OpenSea can fetch metadata
- [ ] Automatic deployments tested

---

## 🎉 You're Done!

Your setup:
- ✅ Push to GitHub → Auto-deploy to Vercel
- ✅ Custom domain (optional)
- ✅ Preview deployments for PRs
- ✅ Fully automated workflow

**Next time you want to update the API:**
```bash
# Make changes
git add .
git commit -m "Your change"
git push

# Vercel does the rest!
```

---

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Actions (Advanced)](https://docs.github.com/en/actions)
- [Alchemy Documentation](https://docs.alchemy.com/)





# Cron Jobs Configuration for Render

This document describes the cron job setup for Render.com to sync affiliate feeds.

## Available Cron Jobs

### 1. CJ Feed Sync (Padel Nuestro)
- **Script**: `dist/server/scripts/cjCronJob.js`
- **Purpose**: Syncs product data from CJ affiliate feed (Padel Nuestro)
- **Frequency**: Daily (recommended: once or twice per day)

### 2. Padel Market Feed Sync
- **Script**: `dist/server/scripts/padelMarketCronJob.js`
- **Purpose**: Syncs alternative affiliate links from Padel Market (Awin feed)
- **Frequency**: Daily at 4pm GMT (as specified)

### 3. Combined Feed Sync (Recommended)
- **Script**: `dist/server/scripts/combinedFeedSyncCronJob.js`
- **Purpose**: Runs both CJ Feed Sync and Padel Market Feed Sync sequentially
- **Frequency**: Daily (recommended: once or twice per day)
- **Benefits**: Single cron job runs both syncs, easier to manage

## Render Cron Job Commands

### CJ Feed Sync - Quick Price Update (Recommended for frequent runs)
```
node dist/server/scripts/cjCronJob.js --quick
```
- Updates prices only (no AI generation)
- Faster execution (~10-15 seconds)
- Good for daily price updates

### CJ Feed Sync - Full Sync (Recommended for weekly runs)
```
node dist/server/scripts/cjCronJob.js
```
- Full sync with AI-generated ratings and reviews
- Slower execution (~60-90 seconds)
- Creates new rackets if found in feed

### Padel Market Feed Sync (Daily at 4pm GMT)
```
node dist/server/scripts/padelMarketCronJob.js
```
- Downloads and processes Padel Market feed
- Matches products to existing rackets
- Updates alternative affiliate links

### Combined Feed Sync (Recommended - Single Cron Job)
```
node dist/server/scripts/combinedFeedSyncCronJob.js --quick
```
- Runs CJ Feed Sync first (quick price update)
- Then runs Padel Market Feed Sync
- Single command for both syncs
- Use `--quick` for faster execution (price updates only for CJ)
- Without `--quick`: Full sync with AI generation for CJ

## Build Process

The build script (`npm run build`) automatically builds all cron job scripts:
- `dist/server/scripts/cjCronJob.js`
- `dist/server/scripts/padelMarketCronJob.js`
- `dist/server/scripts/combinedFeedSyncCronJob.js`

Make sure the build runs before deploying to Render.

## Environment Variables Required

### For CJ Feed Sync:
- `DATABASE_URL` - PostgreSQL connection string
- `CJ_SFTP_HOST` - SFTP host (default: datatransfer.cj.com)
- `CJ_SFTP_USERNAME` - SFTP username
- `CJ_SFTP_PASSWORD` - SFTP password
- `OPENAI_API_KEY` - (optional, only needed for full sync with AI)

### For Padel Market Feed Sync:
- `DATABASE_URL` - PostgreSQL connection string
- `PADEL_MARKET_FEED_URL` - (optional, has default URL)

## Recommended Schedule

1. **CJ Quick Sync**: Every 6-12 hours
   - Command: `node dist/server/scripts/cjCronJob.js --quick`
   - Keeps prices up to date

2. **CJ Full Sync**: Once per day (e.g., 2am GMT)
   - Command: `node dist/server/scripts/cjCronJob.js`
   - Imports new products and generates reviews

3. **Padel Market Sync**: Once per day at 4pm GMT
   - Command: `node dist/server/scripts/padelMarketCronJob.js`
   - Updates alternative affiliate links

**OR use Combined Sync (Recommended):**

4. **Combined Sync**: Once or twice per day
   - Command: `node dist/server/scripts/combinedFeedSyncCronJob.js --quick`
   - Runs both CJ and Padel Market syncs sequentially
   - Single cron job for both feeds

## Troubleshooting

If you see `Cannot find module` errors:
1. Ensure the build has run: `npm run build`
2. Verify files exist in `dist/server/scripts/`
3. Check that the working directory in Render cron job is set to the project root
4. Ensure the command uses the correct path: `node dist/server/scripts/cjCronJob.js`

## Testing Locally

You can test cron jobs locally using:
```bash
# CJ Quick Sync
npm run cj:sync:quick

# CJ Full Sync
npm run cj:sync

# Padel Market Sync (add to package.json if needed)
npx tsx server/scripts/padelMarketCronJob.ts
```


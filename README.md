# FinEase

FinEase shows the amount available until payday after savings, investments, bills and renewals. A bill uses the planned bills reserve first. Any amount above the reserve also reduces Safe-to-Spend. Charges on payday belong to the new pay cycle.

## Run locally

Use Node.js and npm from the project directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Complete payday setup or choose **Explore an example plan**. The local workspace stores records and document attachments in IndexedDB.

Bills, subscriptions, the document vault, reminders and settings work entirely in this browser workspace without any external cloud backend. A payment link opens the banking app for the user to confirm. A CSV import accepts `date` (YYYY-MM-DD), `merchant` and `amount`. Optional columns are `category`, `direction` (debit or credit) and `cycle` (weekly, monthly, quarterly or yearly).

## Verify and build

```sh
npm test
npm run lint
npm run build
```

The build produces optimized assets in `dist/client` and `dist/server`. The test suite verifies pay-cycle boundaries, month-end renewals, fractional allocations, trial conversions, price increases and duplicate statements.

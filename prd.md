
## The problem it solves

Money stress rarely comes from big purchases. It comes from the small, invisible ones: the subscription that quietly went up by 20%, the free trial that converted while you slept, the insurance policy that expired last week, the bill due two days before salary lands.

FinEase turns that noise into one number and one list:

- **One number:** how much is genuinely safe to spend until your next payday, after savings, investments, bills and upcoming renewals are set aside.
- **One list:** everything that needs a decision before payday, with the amount, the date, and a way to act on it.

FinEase is an advisor, not a bank. It never moves money for you. Instead it prepares the exact amount and hands you a deep link into your own banking app, pre-filled.

---

## Features built so far

### Onboarding and payday profile

A short setup flow captures monthly take-home pay, payday, the split between savings / investments / bills, currency, bank app deep link and alert preferences. Until it is complete, every other page redirects to onboarding.

### Safe-to-Spend dashboard (`/`)

The home screen leads with the Safe-to-Spend hero: the amount left after planned savings and investments, a bills reserve, and every subscription due before payday. It shows days until payday, the individual commitments that consume the number, and turns to a warning state when the figure goes negative.

Supporting widgets:

- **Split tiles** — how income divides across savings, investments, bills and free spending.
- **Spending by category** — a donut chart built from the last 30 days of transactions, falling back to recurring bills and subscriptions when no statement has been imported yet.
- **Upcoming list** — bills, renewals and trials sorted by urgency with due-date badges.
- **Renewal watch** — flagged subscriptions needing a decision.
- **Expiring documents** — vault items with an expiry inside the next 30 days.

### Bills (`/bills`)

Full CRUD for recurring bills: amount, due day of month, category, autopay flag, payment link and notes. Bills due before payday feed directly into the Safe-to-Spend calculation, and each row shows how many days are left.

### Subscriptions (`/subscriptions`)

The subscription guardian:

- **Statement upload** — drop a PDF, CSV or image bank statement; AI reads every transaction and every recurring charge out of it.
- **Automatic detection** — new subscriptions are created, existing ones refreshed, and price increases flagged against the previous amount.
- **Renewal timeline** — upcoming charges grouped by time horizon (this week, this month, later) with per-group totals, trial badges and price-hike warnings.
- **Review workflow** — filter by *Needs review*, *Active* or *Cancelled*; keep, cancel, edit or delete each one, with a link to the provider's own cancellation page.
- **Manual entry** — a dialog to add or edit a subscription by hand.
- Monthly-equivalent normalisation so weekly, quarterly and yearly charges are comparable.

### Document vault (`/vault`)

Upload insurance policies, vehicle papers, medical records, IDs, leases, warranties and tax notices (stored privately). AI extracts the title, document type, issuer, expiry date, renewal link and key notes. Documents are sorted with expiring ones surfaced first, and every file can be opened through a short-lived signed link.

### Alerts (`/alerts`)

A payday-aware reminder centre. It lists every bill, renewal and document expiring inside your chosen alert window (default 7 days), and can send the same digest as a formatted email. WhatsApp delivery is wired into the backend but waits on a messaging provider connection.

### Settings (`/settings`)

Edit the finance profile (income, split, currency, payday, bank deep link, WhatsApp number, alert window) with a live preview of how the split lands, plus sign out.

### Authentication

Email and password sign-up with OTP verification, Google sign-in, password reset, and optional two-factor authentication (authenticator app or SMS). Every finance page sits behind a login gate; the server renders public pages anonymously and personal data only after hydration.

### Design

A calm, editorial finance look: warm off-white paper background, deep green primary, `Fraunces` for headings and `Inter Tight` for body text, generous rounding, tabular numerals for money, and a full dark theme.

---

## Tech stack

| Layer     | Choice                                                                                      |
| --------- | ------------------------------------------------------------------------------------------- |
| Framework | TanStack Start + TanStack Router (file-based routes, SSR, server functions)                 |
| UI        | React 19, JavaScript/JSX, Tailwind CSS, shadcn/ui (Radix primitives)                        |
| Data      | Base44 entities with row-level security, accessed through the Base44 SDK and TanStack Query |
| Server    | TanStack Start server functions on Cloudflare Workers (`nodejs_compat`)                   |
| AI        | Base44 Core `InvokeLLM` with JSON-schema responses for statement and document extraction  |
| Auth      | Base44 platform auth (email/password + OTP, Google, reset, MFA)                             |
| Email     | Base44 Core `SendEmail` for the reminder digest                                           |
| Charts    | Recharts                                                                                    |
| Icons     | lucide-react                                                                                |
| Build     | Vite 8 + Cloudflare Vite plugin, Wrangler                                                   |

### Key dependencies

**Runtime:** `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query`, `react`, `react-dom`, `@base44/sdk`, `zod`, `recharts`, `lucide-react`, `sonner`, `next-themes`, `date-fns`, `moment`, `lodash`, `framer-motion`, `class-variance-authority`, `clsx`, `tailwind-merge`, plus the `@radix-ui/*` primitives behind shadcn/ui.

**Development:** `vite`, `@vitejs/plugin-react`, `@cloudflare/vite-plugin`, `wrangler`, `tailwindcss`, `postcss`, `autoprefixer`, `eslint`.

The complete, versioned list lives in [`package.json`](./package.json).

---

## Project structure

```
base44/
  entities/            Data schemas (Bill, Subscription, Transaction, VaultDocument, FinanceProfile, User)
  config.jsonc         Build and serve configuration
src/
  routes/
    __root.jsx         HTML document, providers, theme, toaster
    _authed.jsx        Login gate for every signed-in page
    _authed/
      index.jsx        Safe-to-Spend dashboard
      onboarding.jsx   Payday profile setup
      bills.jsx        Bill management
      subscriptions.jsx Subscription guardian
      vault.jsx        Document vault
      alerts.jsx       Reminder centre
      settings.jsx     Profile and alerts settings
    login.jsx · register.jsx · forgot-password.jsx · reset-password.jsx · mfa.jsx
  components/
    AppShell.jsx       App chrome and navigation
    finance/           Safe-to-Spend hero, split tiles, category chart, upcoming list, renewal watch, profile form
    subscriptions/     Renewal timeline, statement upload, subscription row and dialog
    bills/             Bill dialog
    vault/             Document upload and card
    auth/              Platform auth pages, login gate, MFA flow
    ui/                shadcn/ui primitives
  hooks/
    use-finance.js     TanStack Query hooks for every finance entity plus cache refresh
  lib/
    finance.js         Pure money and date helpers (safe-to-spend maths, cycles, formatting, aggregation)
    server-fns.js      Server functions: statement parsing, document extraction, alert sending
    AuthContext.jsx    Session state for the app
    auth-middleware.js Caller authentication for server functions
  index.css            Design tokens (light and dark)
tailwind.config.js     Token-to-class mapping, fonts, animation
```

---

## Data model

Every record is owned by the user who created it. Each entity's row-level security allows the creator and admins only, for read, update and delete, and stamps `created_by_id` on create.

| Entity             | Purpose                   | Notable fields                                                                                                                                              |
| ------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FinanceProfile` | Payday and split settings | `monthly_income`, `payday_day`, `savings_pct`, `investments_pct`, `bills_pct`, `bank_link_template`, `whatsapp_number`, `alert_window_days` |
| `Bill`           | Recurring fixed bills     | `amount`, `due_day`, `category`, `autopay`, `payment_link`, `active`                                                                            |
| `Subscription`   | Recurring charges         | `amount`, `previous_amount`, `cycle`, `next_charge_date`, `trial_end_date`, `status`, `flagged_reason`, `source`, `confidence`            |
| `Transaction`    | Statement line items      | `merchant`, `amount`, `date`, `category`, `source_document`, `is_recurring`                                                                     |
| `VaultDocument`  | Expiring documents        | `title`, `doc_type`, `issuer`, `expiry_date`, `renewal_url`, `file_uri`                                                                         |

---

## Server functions and AI

All three live in `src/lib/server-fns.js`, require a signed-in caller, and validate their input with zod.

- **`parseStatement`** — sends an uploaded statement to `InvokeLLM` with a strict JSON schema, then bulk-creates transactions and creates or refreshes subscriptions, flagging price increases and trials. Returns counts so the UI can summarise the import.
- **`extractDocument`** — reads a policy, lease, ID or warranty and stores the extracted metadata alongside the private file reference.
- **`sendAlerts`** — builds the payday-aware digest, emails it as branded HTML, and attempts a WhatsApp message when a number is configured and messaging credentials are present.

Money and date logic is kept out of components in `src/lib/finance.js`: `computeSummary`, `monthlyEquivalent`, `spendingByCategory`, `upcomingCharges`, `nextChargeDate`, `nextOnDay` and formatting helpers.

---

## Running locally

```bash
npm ci
base44 login   # one-time per machine
base44 link    # one-time per clone
base44 dev     # local backend + app together
```

The app opens with a login screen. Sign in, complete onboarding, then add a bill or upload a statement to see the dashboard come alive.

## Build and deploy

```bash
npm run build     # -> dist/client (assets) + dist/server (the Worker)
npm run lint
base44 deploy     # or publish from the Base44 builder
```

There is no `index.html`: the document is rendered on the server from `src/routes/__root.jsx`, and the build runs through the Cloudflare Vite plugin so server code executes in `workerd` in both dev and production.

---

## Current status and next steps

**Working today:** onboarding, Safe-to-Spend dashboard with spending breakdown, bills CRUD, AI statement parsing, subscription detection with renewal timeline and review workflow, document vault with AI extraction, email reminder digests, settings, and the full auth surface.

**Known gaps:**

- **WhatsApp delivery** is implemented server-side but inactive until a messaging provider (for example Twilio) is connected through app secrets.
- **Statement accuracy** depends on how clean the uploaded PDF or photo is; the extraction prompt is deliberately conservative and returns only what it can read.
- **Bank deep links** are prepared but not auto-executed — the user always confirms the transfer in their own banking app.
- The app is not published yet; it has no public URL until it is published from the builder.

**Next steps under consideration:** connecting the messaging provider, scheduled alert runs before each payday, and richer category rules for transaction classification.

---

## Notes for contributors

- Pages are files in `src/routes/`; signed-in pages live under `_authed/` and inherit the login gate. Search params go through `validateSearch`, never `window.location` in render.
- Server functions are RPCs (`createServerFn`), validated with zod, and receive a visitor-scoped Base44 client via `context.getBase44()`. Use `asServiceRole` only after authenticating the caller.
- Entities are always read through the SDK with server-side filtering and pagination; lists load a page at a time.
- Style with design tokens (`bg-card`, `text-muted-foreground`, `font-display`) rather than hardcoded colours, and keep both `:root` and `.dark` in sync.
- Money formatting and date maths belong in `src/lib/finance.js`, not in components.

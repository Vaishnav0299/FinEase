const DAY = 86_400_000
const ACTIVE_SUBSCRIPTIONS = new Set(['active', 'review'])

export function localDay(date = new Date()) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

export function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return NaN
  const day = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(day) && dayInput(day) === value ? day : NaN
}

export function dayInput(day) {
  return new Date(day).toISOString().slice(0, 10)
}

export function formatDay(day) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(day)
}

export function daysBetween(start, end) {
  return (end - start) / DAY
}

export function addDays(day, count) {
  return day + count * DAY
}

export function onMonthDay(day, offset, preferredDay) {
  const date = new Date(day)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + offset
  const monthEnd = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return Date.UTC(year, month, Math.min(preferredDay, monthEnd))
}

export function nextOnDay(day, preferredDay) {
  const thisMonth = onMonthDay(day, 0, preferredDay)
  return thisMonth >= day ? thisMonth : onMonthDay(day, 1, preferredDay)
}

export function money(amount, currency, digits = Number.isInteger(amount) ? 0 : 2) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', {
    style: 'currency', currency, minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
}

export const cycleLabels = {
  weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
}

export function monthlyEquivalent({ amount, cycle }) {
  const multiplier = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }
  return amount * multiplier[cycle]
}

function nextOccurrence(subscription, start) {
  const anchor = parseDay(subscription.next_charge_date)
  if (!Number.isFinite(anchor)) return null

  const interval = { monthly: 1, quarterly: 3, yearly: 12 }[subscription.cycle]
  if (!interval && subscription.cycle !== 'weekly') return null
  const preferredDay = new Date(anchor).getUTCDate()
  const anchorDate = new Date(anchor)
  const startDate = new Date(start)
  const elapsedMonths = (startDate.getUTCFullYear() - anchorDate.getUTCFullYear()) * 12
    + startDate.getUTCMonth() - anchorDate.getUTCMonth()
  const periods = interval ? Math.floor(elapsedMonths / interval) : Math.floor(daysBetween(anchor, start) / 7)
  const dateAt = (occurrence) => interval
      ? onMonthDay(anchor, occurrence * interval, preferredDay)
      : addDays(anchor, occurrence * 7)
  let occurrence = Math.max(0, periods)
  if (dateAt(occurrence) < start) occurrence++
  return { occurrence, dateAt }
}

export function nextChargeDate(subscription, start) {
  const next = nextOccurrence(subscription, start)
  return next ? next.dateAt(next.occurrence) : NaN
}

function subscriptionCharges(subscription, start, end) {
  if (!ACTIVE_SUBSCRIPTIONS.has(subscription.status)) return []
  const next = nextOccurrence(subscription, start)
  if (!next) return []
  const charges = []
  for (let count = next.occurrence; next.dateAt(count) < end; count++) {
    charges.push({ ...subscription, due: next.dateAt(count), kind: 'Subscription' })
  }

  return charges
}

export function upcomingCharges(bills, subscriptions, start, end) {
  const billCharges = bills.filter((bill) => bill.active && bill.due_day >= 1 && bill.due_day <= 31).flatMap((bill) => {
    const charges = []
    let due = nextOnDay(start, bill.due_day)
    while (due < end) {
      charges.push({ ...bill, due, kind: 'Bill' })
      due = onMonthDay(due, 1, bill.due_day)
    }
    return charges
  })
  return [...billCharges, ...subscriptions.flatMap((item) => subscriptionCharges(item, start, end))]
    .sort((a, b) => a.due - b.due || a.name.localeCompare(b.name))
}

export function computeSummary(profile, bills, subscriptions, today) {
  const payday = nextOnDay(addDays(today, 1), profile.payday_day)
  const charges = upcomingCharges(bills, subscriptions, today, payday)
  // Calculate the split in minor units so rounding cannot introduce a balance difference.
  const income = Math.round(profile.monthly_income * 100)
  const savings = Math.round(income * profile.savings_pct / 100)
  const investments = Math.round(income * profile.investments_pct / 100)
  const plannedBills = Math.round(income * profile.bills_pct / 100)
  const total = (kind) => charges.filter((row) => row.kind === kind)
    .reduce((sum, row) => sum + Math.round(row.amount * 100), 0)
  const reserve = Math.max(plannedBills, total('Bill'))
  const renewals = total('Subscription')
  return {
    payday, charges, days: daysBetween(today, payday),
    savings: savings / 100, investments: investments / 100,
    reserve: reserve / 100, renewals: renewals / 100,
    remaining: (income - savings - investments - reserve - renewals) / 100,
  }
}

export function webLink(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

export function bankLink(template, amount, currency) {
  if (!template?.includes('{amount}') || !Number.isFinite(amount) || amount <= 0) return ''
  const expanded = template.replaceAll('{amount}', amount.toFixed(2)).replaceAll('{currency}', currency)
  try {
    const url = new URL(expanded)
    if (['https:', 'upi:', 'gpay:', 'phonepe:', 'paytmmp:'].includes(url.protocol)) return url.href
  } catch { /* An incomplete template has no payable link. */ }
  return ''
}

export function dueLabel(today, date) {
  const days = daysBetween(today, date)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 0) return 'Expired'
  return 'In ' + days + ' days'
}

export function spendingByCategory(workspace, today) {
  const transactions = workspace.transactions.filter((item) => {
    const date = parseDay(item.date)
    return item.direction !== 'credit' && date >= addDays(today, -29) && date <= today
  })
  const imported = workspace.transactions.length > 0
  const records = imported ? transactions : [
    ...workspace.bills.filter((item) => item.active),
    ...workspace.subscriptions.filter((item) => ACTIVE_SUBSCRIPTIONS.has(item.status))
      .map((item) => ({ ...item, amount: monthlyEquivalent(item) })),
  ]
  const totals = new Map()
  for (const item of records) {
    const name = item.category || 'Other'
    totals.set(name, (totals.get(name) || 0) + Math.round(item.amount * 100))
  }
  return { imported, entries: Array.from(totals, ([name, cents]) => ({ name, amount: cents / 100 }))
    .filter((entry) => entry.amount > 0).sort((a, b) => b.amount - a.amount) }
}

export function decisions(workspace, start, end) {
  const charges = upcomingCharges(workspace.bills, workspace.subscriptions, start, end)
  const trials = workspace.subscriptions.flatMap((item) => {
    const due = parseDay(item.trial_end_date)
    if (!ACTIVE_SUBSCRIPTIONS.has(item.status) || !(due >= start && due < end)) return []
    if (charges.some((row) => row.kind === 'Subscription' && row.id === item.id && row.due === due)) return []
    return [{ ...item, due, kind: 'Trial' }]
  })
  const documents = workspace.documents.map((item) => ({
    ...item, name: item.title, due: parseDay(item.expiry_date), kind: 'Document',
  })).filter((item) => item.due >= start && item.due < end)
  return [...charges, ...trials, ...documents].sort((a, b) => a.due - b.due || a.name.localeCompare(b.name))
}

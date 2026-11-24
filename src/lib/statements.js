import { addDays, dayInput, daysBetween, onMonthDay, parseDay, webLink } from './finance.js'

function readCsv(text) {
  const rows = []
  let row = [], value = '', quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i++ }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(value.trim()); value = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(value.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []; value = ''
    } else value += char
  }
  if (quoted) throw new Error('A quoted field in this CSV is missing its closing quotation mark.')
  row.push(value.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

const cycles = ['weekly', 'monthly', 'quarterly', 'yearly']

export function parseCsv(text, positiveIsDebit = true) {
  const [header = [], ...rows] = readCsv(text)
  const keys = header.map((key) => key.toLowerCase())
  if (!['date', 'merchant', 'amount'].every((key) => keys.includes(key))) {
    throw new Error('The CSV needs date, merchant and amount columns.')
  }
  if (!rows.length) throw new Error('The CSV has a header but no transactions.')
  return rows.map((cells, index) => {
    const row = Object.fromEntries(keys.map((key, i) => [key, cells[i] ?? '']))
    const raw = row.amount.replaceAll(',', '')
    const amount = Number(raw)
    const cycle = row.cycle?.toLowerCase() || ''
    const direction = row.direction?.toLowerCase() || ((amount > 0) === positiveIsDebit ? 'debit' : 'credit')
    if (cells.length !== keys.length || !row.merchant || row.merchant.length > 200 || row.category?.length > 80 || !Number.isFinite(parseDay(row.date)) ||
      !/^[+-]?\d+(\.\d{1,2})?$/.test(raw) || !Number.isFinite(amount) || !amount || Math.abs(amount) > 999999999999 ||
      !['debit', 'credit'].includes(direction) || (cycle && !cycles.includes(cycle))) {
      throw new Error('Check row ' + (index + 2) + '. Use an ISO date, merchant, non-zero amount and valid direction or cycle.')
    }
    return { merchant: row.merchant, amount: Math.abs(amount), date: row.date, direction, cycle, category: row.category || 'Other' }
  })
}

const merchantKey = (name) => name.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ')

function inferredCycle(history) {
  const latest = history.at(-1)
  if (latest.cycle) return latest.cycle
  const dates = [...new Set(history.map((item) => item.date))].slice(-3).map(parseDay)
  if (dates.length < 3) return ''
  const gaps = dates.slice(1).map((date, i) => daysBetween(dates[i], date))
  const windows = [['weekly', 6, 8], ['monthly', 27, 32], ['quarterly', 88, 94], ['yearly', 364, 367]]
  return windows.find(([, low, high]) => gaps.every((gap) => gap >= low && gap <= high))?.[0] || ''
}

export function planImport(workspace, rows, source, renewals = []) {
  const known = new Set(workspace.transactions.map((row) => row.import_key))
  const ordinal = new Map()
  const transactions = []
  for (const row of rows) {
    const signature = JSON.stringify([merchantKey(row.merchant), row.date, Math.round(row.amount * 100), row.direction])
    const index = ordinal.get(signature) || 0
    ordinal.set(signature, index + 1)
    const import_key = signature + '#' + index
    if (known.has(import_key)) continue
    transactions.push({ ...row, import_key, source_document: source, is_recurring: Boolean(row.cycle) })
  }
  const merchants = new Set(transactions.filter((row) => row.direction === 'debit').map((row) => merchantKey(row.merchant)))
  const byMerchant = new Map()
  for (const row of [...workspace.transactions, ...transactions]) {
    const key = merchantKey(row.merchant)
    if (!merchants.has(key) || row.direction === 'credit') continue
    if (!byMerchant.has(key)) byMerchant.set(key, [])
    byMerchant.get(key).push(row)
  }
  const updates = new Map()
  const recurring = new Set()
  for (const [key, history] of byMerchant) {
    history.sort((a, b) => a.date.localeCompare(b.date))
    const latest = history.at(-1)
    const existing = workspace.subscriptions.find((item) => merchantKey(item.name) === key)
    const cycle = inferredCycle(history) || existing?.cycle
    if (!cycle) continue
    recurring.add(key)
    if (existing?.last_seen_date && existing.last_seen_date >= latest.date) continue
    const day = parseDay(latest.date)
    const due = cycle === 'weekly' ? addDays(day, 7) : onMonthDay(day, { monthly: 1, quarterly: 3, yearly: 12 }[cycle], new Date(day).getUTCDate())
    const oldPrice = existing?.amount ?? history.at(-2)?.amount
    const increased = oldPrice !== undefined && latest.amount > oldPrice
    const flagged = increased ? 'Price increased' : existing ? existing.flagged_reason : 'Check recurring charge'
    const values = {
      name: existing?.name ?? latest.merchant, amount: latest.amount, cycle,
      next_charge_date: dayInput(due), category: latest.category === 'Other' ? existing?.category || 'Other' : latest.category,
      status: existing?.status === 'cancelled' ? 'cancelled' : (increased || !existing ? 'review' : existing.status),
      flagged_reason: flagged || '', last_seen_date: latest.date, source: existing?.source || 'statement',
    }
    if (increased) values.previous_amount = oldPrice
    updates.set(key, { id: existing?.id, values, merchant_key: key })
  }
  for (const renewal of renewals) {
    const key = merchantKey(renewal.name)
    recurring.add(key)
    const existing = workspace.subscriptions.find((item) => merchantKey(item.name) === key)
    const evidence = JSON.stringify([renewal.observed_date, renewal.amount, renewal.next_charge_date, renewal.cycle, renewal.trial_end_date])
    if (existing?.statement_evidence === evidence || (renewal.observed_date && existing?.last_seen_date > renewal.observed_date)) continue
    const inferred = updates.get(key)?.values
    const prior = existing?.amount ?? renewal.previous_amount ?? inferred?.previous_amount
    const increased = prior != null && renewal.amount > prior
    const reason = increased ? 'Price increased' : renewal.trial_end_date ? 'Trial ending' : existing?.flagged_reason
    const values = {
      ...inferred, name: existing?.name ?? renewal.name, amount: renewal.amount, cycle: renewal.cycle,
      category: renewal.category || existing?.category || 'Other', next_charge_date: renewal.next_charge_date,
      trial_end_date: renewal.trial_end_date, confidence: renewal.confidence,
      statement_evidence: evidence, source: existing?.source || 'statement',
      status: existing?.status === 'cancelled' ? 'cancelled' : (reason || !existing ? 'review' : existing.status),
      flagged_reason: reason || (existing ? '' : 'Check recurring charge'),
    }
    if (renewal.observed_date) values.last_seen_date = renewal.observed_date
    if (increased) values.previous_amount = prior
    if (webLink(renewal.cancellation_url)) values.cancellation_url = webLink(renewal.cancellation_url)
    updates.set(key, { id: existing?.id, merchant_key: key, values })
  }
  for (const row of transactions) {
    if (row.direction === 'debit' && recurring.has(merchantKey(row.merchant))) row.is_recurring = true
  }
  return { transactions, subscriptions: Array.from(updates.values()) }
}

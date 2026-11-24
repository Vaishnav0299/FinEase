export const appId = import.meta.env.VITE_BASE44_APP_ID
export const entities = {
  profile: 'FinanceProfile', bills: 'Bill', subscriptions: 'Subscription',
  transactions: 'Transaction', documents: 'VaultDocument',
}

let browserClient

export async function platformClient() {
  if (!browserClient) {
    const { createClient, getAccessToken } = await import('@base44/sdk')
    browserClient = createClient({
      appId, appBaseUrl: import.meta.env.VITE_BASE44_APP_URL,
      token: getAccessToken() || undefined, requiresAuth: false,
    })
  }
  return browserClient
}

export async function ownedRows(client, collection, userId) {
  const api = client.entities[entities[collection]]
  const records = []
  let cursor
  do {
    const page = await api.filter({ created_by_id: userId }, { limit: 100, cursor })
    records.push(...page.items)
    cursor = page.next_cursor
  } while (cursor)
  return records
}

export async function cloudPlan(client, userId) {
  const collections = Object.keys(entities)
  const rows = await Promise.all(collections.map((key) => ownedRows(client, key, userId)))
  const plan = Object.fromEntries(collections.map((key, index) => [key, rows[index]]))
  plan.profile = plan.profile[0] ?? null
  return plan
}

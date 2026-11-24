import { addDays, dayInput, onMonthDay } from './finance.js'

export const defaultProfile = {
  monthly_income: '', payday_day: 1, currency: 'INR',
  savings_pct: 20, investments_pct: 10, bills_pct: 30, alert_window_days: 7,
  bank_link_template: '', whatsapp_number: '',
}

export function emptyWorkspace() {
  return { profile: null, bills: [], subscriptions: [], documents: [], transactions: [] }
}

export function sampleWorkspace(today) {
  return {
    ...emptyWorkspace(),
    profile: {
      ...defaultProfile, monthly_income: 85000, payday_day: new Date(addDays(today, 9)).getUTCDate(),
    },
    bills: [
      { id: 'rent', name: 'Rent', category: 'Housing', amount: 18000, due_day: new Date(addDays(today, 3)).getUTCDate(), active: true },
      { id: 'internet', name: 'Home internet', category: 'Utilities', amount: 999, due_day: new Date(addDays(today, 6)).getUTCDate(), active: true, autopay: true },
    ],
    subscriptions: [
      { id: 'spotify', name: 'Spotify', category: 'Entertainment', amount: 119, cycle: 'monthly', next_charge_date: dayInput(addDays(today, 2)), status: 'active' },
      { id: 'netflix', name: 'Netflix', category: 'Entertainment', amount: 649, previous_amount: 599, flagged_reason: 'Price increased', cycle: 'monthly', next_charge_date: dayInput(addDays(today, 5)), status: 'review' },
      { id: 'storage', name: 'Cloud storage', category: 'Software', amount: 900, cycle: 'yearly', next_charge_date: dayInput(onMonthDay(today, 2, 15)), status: 'active' },
    ],
  }
}

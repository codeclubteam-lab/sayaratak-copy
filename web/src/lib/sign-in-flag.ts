// Set by a sign in, taken once by the dashboard: reminders that run "once per sign in" read it. Session storage can be missing or blocked, which only skips the reminder.
const KEY = "sy_signed_in"

export function markSignIn() {
  try {
    sessionStorage.setItem(KEY, "1")
  } catch {
    // no storage, no reminder
  }
}

export function takeSignIn() {
  try {
    const set = sessionStorage.getItem(KEY) === "1"
    sessionStorage.removeItem(KEY)
    return set
  } catch {
    return false
  }
}

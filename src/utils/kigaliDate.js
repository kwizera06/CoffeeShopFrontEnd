const KIGALI_TZ = 'Africa/Kigali'

/** Current calendar date in Rwanda as YYYY-MM-DD */
export function getKigaliToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KIGALI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function formatKigaliTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KIGALI_TZ,
  })
}

export function formatShiftRange(shift) {
  if (!shift) return ''
  const opened = formatKigaliTime(shift.opened_at)
  const closed = shift.closed_at ? formatKigaliTime(shift.closed_at) : 'now'
  return `${opened} → ${closed}`
}

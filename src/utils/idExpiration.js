/**
 * Helper for KYC Identity Document Expiration Date
 * Prevents past dates and enforces a minimum validity threshold of at least 1 month.
 */

export const getMinExpirationDate = (baseDate = new Date()) => {
  const d = new Date(baseDate)
  d.setHours(0, 0, 0, 0)
  const targetMonth = d.getMonth() + 1
  d.setMonth(targetMonth)
  // Protect against JS Date overflow (e.g., Jan 31 -> March)
  if (d.getMonth() !== (targetMonth % 12)) {
    d.setDate(0)
  }
  return d
}

export const formatIsoDate = (year, month, day) => {
  if (!year || !month || !day) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export const getDaysInMonth = (month, year) => {
  if (!month) return 31
  const m = parseInt(month, 10)
  const y = parseInt(year, 10) || 2024
  return new Date(y, m, 0).getDate()
}

export const getMonthsList = (isEn = false) => [
  { value: '1', label: isEn ? 'January' : 'Janvier' },
  { value: '2', label: isEn ? 'February' : 'Février' },
  { value: '3', label: isEn ? 'March' : 'Mars' },
  { value: '4', label: isEn ? 'April' : 'Avril' },
  { value: '5', label: isEn ? 'May' : 'Mai' },
  { value: '6', label: isEn ? 'June' : 'Juin' },
  { value: '7', label: isEn ? 'July' : 'Juillet' },
  { value: '8', label: isEn ? 'August' : 'Août' },
  { value: '9', label: isEn ? 'September' : 'Septembre' },
  { value: '10', label: isEn ? 'October' : 'Octobre' },
  { value: '11', label: isEn ? 'November' : 'Novembre' },
  { value: '12', label: isEn ? 'December' : 'Décembre' }
]

export const getValidExpirationYears = (minDate = getMinExpirationDate(), futureCount = 30) => {
  const startYear = minDate.getFullYear()
  const years = []
  for (let y = startYear; y <= startYear + futureCount; y++) {
    years.push(String(y))
  }
  return years
}

export const getValidExpirationMonths = (selectedYear, isEn = false, minDate = getMinExpirationDate()) => {
  const allMonths = getMonthsList(isEn)
  if (!selectedYear) return allMonths

  const y = parseInt(selectedYear, 10)
  const minY = minDate.getFullYear()
  const minM = minDate.getMonth() + 1

  if (y === minY) {
    return allMonths.filter(m => parseInt(m.value, 10) >= minM)
  }
  if (y < minY) {
    return []
  }
  return allMonths
}

export const getValidExpirationDays = (selectedYear, selectedMonth, minDate = getMinExpirationDate()) => {
  const maxDay = getDaysInMonth(selectedMonth, selectedYear)
  if (!selectedYear || !selectedMonth) {
    return Array.from({ length: maxDay }, (_, i) => String(i + 1))
  }

  const y = parseInt(selectedYear, 10)
  const m = parseInt(selectedMonth, 10)
  const minY = minDate.getFullYear()
  const minM = minDate.getMonth() + 1
  const minD = minDate.getDate()

  let startDay = 1
  if (y === minY && m === minM) {
    startDay = minD
  } else if (y < minY || (y === minY && m < minM)) {
    return []
  }

  const days = []
  for (let d = startDay; d <= maxDay; d++) {
    days.push(String(d))
  }
  return days
}

export const isExpirationDateValid = (dateString, minDate = getMinExpirationDate()) => {
  if (!dateString) return false
  const parts = String(dateString).split('-').map(num => parseInt(num, 10))
  if (parts.length !== 3 || parts.some(isNaN)) return false
  const [y, m, d] = parts
  const selected = new Date(y, m - 1, d)
  selected.setHours(0, 0, 0, 0)

  const threshold = new Date(minDate)
  threshold.setHours(0, 0, 0, 0)
  return selected.getTime() >= threshold.getTime()
}

export const getExpirationErrorMessage = (isEn = false, minDate = getMinExpirationDate()) => {
  const y = minDate.getFullYear()
  const m = String(minDate.getMonth() + 1).padStart(2, '0')
  const d = String(minDate.getDate()).padStart(2, '0')
  const formattedDate = isEn ? `${y}-${m}-${d}` : `${d}/${m}/${y}`

  return isEn
    ? `The ID document must have a minimum validity of at least 1 month (at least until ${formattedDate}).`
    : `La pièce d'identité doit avoir une validité minimale d'au moins 1 mois (au minimum jusqu'au ${formattedDate}).`
}

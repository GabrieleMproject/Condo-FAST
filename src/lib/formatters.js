// src/lib/formatters.js

/**
 * Formatta un valore numerico in valuta Euro
 */
export function formattaValuta(valore) {
  if (valore === undefined || valore === null || isNaN(valore)) return '€ 0,00'
  return `€ ${parseFloat(valore).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Formatta una stringa data in formato GG/MM/AAAA
 */
export function formattaData(dataInput) {
  if (!dataInput) return 'N/D'
  try {
    const d = new Date(dataInput)
    if (isNaN(d.getTime())) return 'N/D'
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return 'N/D'
  }
}

/**
 * Formatta una stringa data in formato GG/MM/AAAA HH:MM
 */
export function formattaDataOra(dataInput) {
  if (!dataInput) return '—'
  try {
    const d = new Date(dataInput)
    if (isNaN(d.getTime())) return '—'
    return `${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return '—'
  }
}

/**
 * Gestore universale di log e monitoraggio eccezioni per CondoSmart.
 * Minimizza l'esposizione di dati sensibili nei log (GDPR compliant).
 */

class Logger {
  constructor() {
    this.isProduction = import.meta.env.PROD
  }

  /**
   * Pulisce un oggetto o una stringa da dati sensibili (CF, IBAN, Token) prima del logging.
   */
  sanitize(data) {
    if (!data) return data
    if (typeof data === 'string') {
      // Maschera eventuali IBAN o CF
      return data
        .replace(/[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}/gi, '[IBAN_PROTECTED]')
        .replace(/[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]/gi, '[CF_PROTECTED]')
    }
    if (typeof data === 'object') {
      try {
        const copy = JSON.parse(JSON.stringify(data))
        if (copy.iban) copy.iban = '[IBAN_PROTECTED]'
        if (copy.codice_fiscale) copy.codice_fiscale = '[CF_PROTECTED]'
        if (copy.password) delete copy.password
        if (copy.token) delete copy.token
        return copy
      } catch {
        return '[COMPLEX_OBJECT]'
      }
    }
    return data
  }

  info(message, context = null) {
    if (!this.isProduction) {
      console.log(`[INFO] ${message}`, context ? this.sanitize(context) : '')
    }
  }

  warn(message, context = null) {
    console.warn(`[WARN] ${message}`, context ? this.sanitize(context) : '')
  }

  error(message, error = null, context = null) {
    console.error(`[ERROR] ${message}`, error, context ? this.sanitize(context) : '')
    
    // Gancio pronto per Sentry / LogRocket in produzione
    if (this.isProduction && window.Sentry) {
      window.Sentry.captureException(error || new Error(message), {
        extra: this.sanitize(context)
      })
    }
  }
}

export const logger = new Logger()

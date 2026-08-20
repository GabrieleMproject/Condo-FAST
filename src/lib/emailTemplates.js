/**
 * emailTemplates.js
 * Generatore di template email responsive in stile CondoFast
 * con footer istituzionale minimale ed essenziale M PROJECT S.R.L.
 */

export const COMPANY_INFO = {
  name: 'M PROJECT S.R.L.',
  brand: 'CondoFast',
  piva: '04314510134',
  address: 'Via Civati 23, 22031 Albavilla (CO)',
  supportEmail: 'info@condofast.it',
  privacyUrl: 'https://condofast.it/privacy',
  termsUrl: 'https://condofast.it/termini',
  appUrl: 'https://app.condofast.it',
  logoUrl: 'https://condofast.it/assets/logo.png'
};

/**
 * Footer minimale ed essenziale per tutte le comunicazioni
 */
export function getEmailFooterHtml() {
  return `
    <div style="margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 18px; color: #94a3b8;">
      <p style="margin: 0 0 6px 0;">
        <strong style="color: #64748b;">CondoFast</strong> · Prodotto da <strong style="color: #64748b;">${COMPANY_INFO.name}</strong> (P.IVA ${COMPANY_INFO.piva})<br>
        ${COMPANY_INFO.address}
      </p>
      <p style="margin: 0;">
        <a href="${COMPANY_INFO.privacyUrl}" style="color: #3b82f6; text-decoration: none;">Privacy Policy</a> · 
        <a href="${COMPANY_INFO.termsUrl}" style="color: #3b82f6; text-decoration: none;">Termini di Servizio</a> · 
        <a href="mailto:${COMPANY_INFO.supportEmail}" style="color: #3b82f6; text-decoration: none;">Assistenza: ${COMPANY_INFO.supportEmail}</a>
      </p>
    </div>
  `;
}

/**
 * Wrapper base HTML responsive stile CondoFast
 */
export function wrapEmailHtml({ preheader = '', contentHtml = '' }) {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>CondoFast</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #1e293b;">
  ${preheader ? `<div style="display: none; max-height: 0px; overflow: hidden;">${preheader}</div>` : ''}
  
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); padding: 36px 32px; text-align: left;">
          
          <!-- Header / Logo -->
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                      Condo<span style="color: #2563eb;">FAST</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.5px;">
                      Smart Cloud
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding-top: 28px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Minimal Footer -->
          <tr>
            <td>
              ${getEmailFooterHtml()}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * 1. Template: Email di Benvenuto (Welcome & Quickstart)
 */
export function getWelcomeEmailHtml({ nome = 'Amministratore', confirmationUrl = '', dashboardUrl = 'https://app.condofast.it/dashboard' }) {
  const content = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a;">
      Benvenuto su CondoFast, ${nome}! 🚀
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #475569;">
      Il tuo account è pronto. Da oggi puoi gestire i tuoi condomini, automatizzare la contabilità con l'Intelligenza Artificiale e redigere i rendiconti in pochi secondi.
    </p>

    ${confirmationUrl ? `
    <div style="margin: 28px 0; text-align: center;">
      <a href="${confirmationUrl}" style="background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
        Conferma la tua Email ed Entra
      </a>
    </div>
    ` : `
    <div style="margin: 28px 0; text-align: center;">
      <a href="${dashboardUrl}" style="background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
        Vai alla tua Dashboard
      </a>
    </div>
    `}

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
        💡 3 Passi Rapidi per Iniziare:
      </h3>
      <table width="100%" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #475569;">
            <strong style="color: #2563eb;">1.</strong> Crea o importa il tuo primo condominio
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #475569;">
            <strong style="color: #2563eb;">2.</strong> Trascina una fattura PDF o estratto conto per la scansione AI
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #475569;">
            <strong style="color: #2563eb;">3.</strong> Genera il rendiconto di legge A→E con 1 click
          </td>
        </tr>
      </table>
    </div>

    <p style="margin: 0; font-size: 14px; line-height: 22px; color: #64748b;">
      Hai domande o vuoi un supporto per la migrazione dal vecchio gestionale? Rispondi direttamente a questa email: il nostro team è a tua disposizione.
    </p>
  `;

  return wrapEmailHtml({
    preheader: 'Benvenuto su CondoFast: il tuo account è attivo con 14 giorni di prova gratuita.',
    contentHtml: content
  });
}

/**
 * 2. Template: Recupero Password (Password Reset)
 */
export function getPasswordResetEmailHtml({ resetUrl = '' }) {
  const content = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a;">
      Reimpostazione della Password 🔐
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #475569;">
      Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account CondoFast. Clicca sul pulsante qui sotto per sceglierne una nuova:
    </p>

    <div style="margin: 32px 0; text-align: center;">
      <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
        Reimposta Password
      </a>
    </div>

    <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 20px; color: #64748b;">
      Questo link è monouso e scadrà tra <strong>60 minuti</strong> per motivi di sicurezza.
    </p>
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #94a3b8;">
      Se non hai richiesto tu il ripristino della password, puoi tranquillamente ignorare questo messaggio: il tuo account rimane protetto.
    </p>
  `;

  return wrapEmailHtml({
    preheader: 'Richiesta di reimpostazione password per il tuo account CondoFast.',
    contentHtml: content
  });
}

/**
 * 3. Template: Avviso Scadenza Prova Gratuita (Trial Expiration Nudge)
 */
export function getTrialExpirationEmailHtml({ nome = 'Amministratore', giorniRimasti = 3, upgradeUrl = 'https://app.condofast.it/impostazioni' }) {
  const content = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a;">
      La tua prova gratuita scade tra ${giorniRimasti} giorni ⏳
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #475569;">
      Ciao ${nome}, speriamo che l'automazione e le funzionalità AI di CondoFast stiano semplificando la gestione del tuo studio!
    </p>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #475569;">
      Tra <strong>${giorniRimasti} giorni</strong> il tuo periodo di prova si concluderà. Per continuare a gestire i tuoi condomini e usufruire dell'OCR e dei rendiconti automatici senza interruzioni, attiva il piano più adatto al tuo studio.
    </p>

    <div style="margin: 32px 0; text-align: center;">
      <a href="${upgradeUrl}" style="background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
        Scegli il tuo Piano
      </a>
    </div>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 24px 0; text-align: center;">
      <span style="font-size: 14px; font-weight: 600; color: #166534;">
        🔒 Nessun dato verrà cancellato o perso alla scadenza.
      </span>
    </div>
  `;

  return wrapEmailHtml({
    preheader: `Mancano solo ${giorniRimasti} giorni alla fine della tua prova gratuita di CondoFast.`,
    contentHtml: content
  });
}

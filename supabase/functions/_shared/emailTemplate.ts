// supabase/functions/_shared/emailTemplate.ts

export const COMPANY_INFO = {
  name: 'M PROJECT S.R.L.',
  brand: 'CondoFast',
  piva: '04314510134',
  address: 'Via Civati 23, 22031 Albavilla (CO)',
  supportEmail: 'info@condofast.it',
  privacyUrl: 'https://condofast.it/privacy',
  termsUrl: 'https://condofast.it/termini',
  appUrl: 'https://app.condofast.it'
}

/**
 * Footer minimale ed essenziale per tutte le comunicazioni M Project SRL
 */
export function getEmailFooterHtml(): string {
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
  `
}

/**
 * Wrapper base HTML responsive stile CondoFast
 */
export function wrapEmailHtml({ preheader = '', contentHtml = '' }: { preheader?: string; contentHtml: string }): string {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>CondoFast</title>
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
  `.trim()
}

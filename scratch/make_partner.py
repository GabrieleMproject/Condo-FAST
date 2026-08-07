import re

with open('website/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

payload = """
  <main id="main" style="padding-top: var(--nav-h); padding-bottom: 80px;">
    <section class="hero" style="min-height: 60vh; display: flex; align-items: center; justify-content: center; text-align: center; background: linear-gradient(to bottom, var(--bg) 0%, #1e1b4b 100%); padding: 60px 24px;">
      <div style="max-width: 600px; width: 100%;">
        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 99px; background: rgba(124, 58, 237, 0.15); border: 1px solid rgba(124, 58, 237, 0.3); margin-bottom: 24px;">
          <span style="font-size: 14px; font-weight: 700; color: #a78bfa;">Pioneer Partner</span>
        </div>
        <h1 style="font-size: 42px; font-weight: 800; line-height: 1.1; margin-bottom: 24px; background: linear-gradient(135deg, #fff 0%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          Diventa Fornitore Esclusivo
        </h1>
        <p style="font-size: 18px; color: var(--text); opacity: 0.8; margin-bottom: 32px; line-height: 1.6;">
          Sei stato invitato da un amministratore CondoFAST. Ottieni l'esclusiva territoriale per la tua categoria e ricevi richieste di intervento qualificate direttamente sul tuo telefono.
        </p>
        
        <form id="partner-form" action="mailto:info@condofast.it" method="POST" enctype="text/plain" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; text-align: left; backdrop-filter: blur(12px);">
          <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 24px;">Richiedi informazioni senza impegno</h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div>
              <label style="display: block; font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Ragione Sociale / Nome</label>
              <input type="text" name="Nome" required style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; font-family: inherit;">
            </div>
            <div>
              <label style="display: block; font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Partita IVA</label>
              <input type="text" name="PIVA" id="piva-input" required style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; font-family: inherit;">
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div>
              <label style="display: block; font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Categoria (es. Idraulico)</label>
              <input type="text" name="Categoria" id="cat-input" required style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; font-family: inherit;">
            </div>
            <div>
              <label style="display: block; font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Provincia</label>
              <input type="text" name="Provincia" id="prov-input" required style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; font-family: inherit;">
            </div>
          </div>
          
          <div style="margin-bottom: 24px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Email di Contatto</label>
            <input type="email" name="Email" required style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; font-family: inherit;">
          </div>
          
          <input type="hidden" name="SponsorID" id="sponsor-input">
          
          <button type="submit" style="width: 100%; background: #7c3aed; color: white; border: none; padding: 14px; border-radius: 8px; font-weight: 700; font-family: inherit; font-size: 16px; cursor: pointer; transition: background 0.2s;">
            Invia Richiesta
          </button>
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 16px;">
            Verrai ricontattato da un nostro consulente per spiegarti i dettagli dell'esclusiva.
          </p>
        </form>
      </div>
    </section>
    <script>
      // Precompila campi da query string
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('piva')) document.getElementById('piva-input').value = urlParams.get('piva');
      if (urlParams.has('cat')) document.getElementById('cat-input').value = urlParams.get('cat');
      if (urlParams.has('prov')) document.getElementById('prov-input').value = urlParams.get('prov');
      if (urlParams.has('sponsor_id')) document.getElementById('sponsor-input').value = urlParams.get('sponsor_id');
      
      // Update title
      document.title = "Diventa Partner - CondoFAST";
    </script>
  </main>
"""

new_html = re.sub(r'<main id="main">.*?</main>', payload, html, flags=re.DOTALL)

with open('website/partner.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

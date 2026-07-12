import { useState, useEffect } from 'react';
import { Package, CheckCircle2, AlertTriangle, Download, X, FileSpreadsheet, FolderArchive, ShieldCheck, Loader2 } from 'lucide-react';
import { exportPassaggioConsegneZip } from '../lib/exportPassaggioConsegne';
import { useUnita } from '../hooks/useUnita';
import { useDocumenti } from '../hooks/useDocumenti';
import { useEsercizi } from '../hooks/useEsercizi';
import { supabase } from '../lib/supabaseClient';

export default function PassaggioConsegneSection({ condominioId, condominio }) {
  const { unita = [] } = useUnita(condominioId);
  const { documenti = [], getSignedUrl } = useDocumenti(condominioId);
  const { esercizi = [] } = useEsercizi(condominioId);

  const [persone, setPersone] = useState([]);
  const [tabelle, setTabelle] = useState([]);
  const [spese, setSpese] = useState([]);
  const [saldi, setSaldi] = useState([]);

  // Caricamento dati aggiuntivi e calcolo saldi da Supabase
  useEffect(() => {
    if (!condominioId) return;
    async function fetchExtraData() {
      try {
        // 1) Persone e loro ruoli/unità tramite occupanti_unita
        const { data: dataPers } = await supabase
          .from('persone')
          .select(`
            id, nome, cognome, codice_fiscale, email, telefono, indirizzo, citta,
            occupanti_unita!inner(id, ruolo, attivo, unita!inner(id, numero, nome, scala, condominio_id))
          `)
          .eq('occupanti_unita.unita.condominio_id', condominioId)
          .eq('occupanti_unita.attivo', true);

        const personeMappate = (dataPers || []).map(p => {
          const occupazioni = p.occupanti_unita || [];
          const unitaNomi = occupazioni.map(o => `${o.unita.nome || o.unita.numero}${o.unita.scala ? ` (Sc. ${o.unita.scala})` : ''}`).join(', ');
          const ruoli = Array.from(new Set(occupazioni.map(o => o.ruolo))).map(r => r === 'proprietario' ? 'Proprietario' : r === 'inquilino' ? 'Inquilino' : r).join(' / ');
          return { ...p, unitaNomi, ruoli };
        });
        setPersone(personeMappate);

        // 2) Tabelle Millesimali
        const { data: dataTab } = await supabase
          .from('tabelle_millesimali')
          .select('*')
          .eq('condominio_id', condominioId);
        if (dataTab) setTabelle(dataTab);

        // 3) Spese con join su fornitori e esercizi
        const { data: dataSpese } = await supabase
          .from('spese')
          .select('*, fornitori(ragione_sociale), esercizi(anno, nome)')
          .eq('condominio_id', condominioId);
        if (dataSpese) setSpese(dataSpese);

        // 4) Saldi contabili per unità (saldi_iniziali_unita + rate_unita)
        const { data: dataSaldi } = await supabase
          .from('saldi_iniziali_unita')
          .select('*')
          .eq('condominio_id', condominioId);

        const { data: dataRateUnita } = await supabase
          .from('rate_unita')
          .select('unita_id, importo, importo_pagato, rate!inner(condominio_id)')
          .eq('rate.condominio_id', condominioId);

        const saldiElaborati = (unita || []).map(u => {
          const sIniz = (dataSaldi || []).filter(s => s.unita_id === u.id).reduce((acc, curr) => acc + (Number(curr.saldo) || 0), 0);
          const rateU = (dataRateUnita || []).filter(r => r.unita_id === u.id);
          const dovuto = rateU.reduce((acc, curr) => acc + (Number(curr.importo) || 0), 0);
          const versato = rateU.reduce((acc, curr) => acc + (Number(curr.importo_pagato) || 0), 0);
          const saldo = sIniz + versato - dovuto;
          const arretrati = Math.max(0, dovuto - versato - Math.max(0, sIniz));
          
          const prop = u.occupanti_unita?.find(o => o.ruolo === 'proprietario' && o.attivo !== false)?.persone;
          const propNome = prop ? `${prop.cognome || ''} ${prop.nome || ''}`.trim() : '—';

          return {
            unita_nome: u.nome || u.numero || 'Unità',
            proprietario: propNome,
            saldo,
            arretrati,
            versato,
            dovuto
          };
        });
        setSaldi(saldiElaborati);
      } catch (err) {
        console.error('Errore nel caricamento dati per passaggio consegne:', err);
      }
    }
    fetchExtraData();
  }, [condominioId, unita]);

  const [showModal, setShowModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Calcolo di conformità normativa in tempo reale
  const checkAnagrafe = unita.length > 0 && persone.length > 0;
  const checkRegolamento = documenti.some(d => d.tipo === 'regolamento');
  const checkMillesimi = tabelle.length > 0 || documenti.some(d => d.tipo === 'tabella_millesimale_doc');
  const checkVerbali = documenti.some(d => d.tipo === 'verbale');
  const checkFinanze = saldi.length > 0 || documenti.some(d => d.tipo === 'estratto_conto' || d.tipo === 'estratto_conto_archivio');

  const requisiti = [
    {
      titolo: 'Registro Anagrafe Condominiale',
      norma: 'Art. 1130 c. 1 n. 6 c.c.',
      ok: checkAnagrafe,
      dettaglioOk: `${persone.length} persone e ${unita.length} unità immobiliari censite in Excel.`,
      dettaglioErr: 'Mancano persone o unità immobiliari censite nell\'anagrafica del condominio.'
    },
    {
      titolo: 'Regolamento di Condominio',
      norma: 'Art. 1138 c.c.',
      ok: checkRegolamento,
      obbligatorio: unita.length > 10,
      dettaglioOk: 'Regolamento condominiale presente in archivio documenti.',
      dettaglioErr: unita.length > 10
        ? 'MANCANTE: Obbligatorio per legge per condomini con più di 10 condòmini.'
        : 'Non caricato (facoltativo per condomini fino a 10 condòmini).'
    },
    {
      titolo: 'Tabelle Millesimali e Quote',
      norma: 'Art. 68 disp. att. c.c.',
      ok: checkMillesimi,
      dettaglioOk: `${tabelle.length} tabelle millesimali strutturate incluse nell\'export.`,
      dettaglioErr: 'Nessuna tabella millesimale trovata o associata all\'edificio.'
    },
    {
      titolo: 'Registro dei Verbali di Assemblea',
      norma: 'Art. 1130 c. 1 n. 7 c.c.',
      ok: checkVerbali,
      dettaglioOk: `${documenti.filter(d => d.tipo === 'verbale').length} verbali assembleari pronti per l'inclusione.`,
      dettaglioErr: 'Nessun verbale di assemblea caricato nel cassetto documenti.'
    },
    {
      titolo: 'Rendiconto e Situazione Contabile',
      norma: 'Art. 1130-bis c.c.',
      ok: checkFinanze,
      dettaglioOk: 'Saldi contabili delle unità, storico spese ed estratti conto bancari presenti.',
      dettaglioErr: 'Nessun saldo finanziario o estratto conto registrato.'
    }
  ];

  const allOk = requisiti.every(r => r.ok || (!r.obbligatorio && !r.ok));

  const handleDownload = async () => {
    setDownloading(true);
    setProgressMsg('Avvio esportazione in corso...');
    try {
      await exportPassaggioConsegneZip({
        condominio,
        unita,
        persone,
        tabelle,
        spese,
        esercizi,
        saldi,
        documenti,
        getSignedUrl,
        onProgress: (msg) => setProgressMsg(msg)
      });
      setShowModal(false);
    } catch (e) {
      alert('Errore durante la creazione del pacchetto ZIP: ' + e.message);
    } finally {
      setDownloading(false);
      setProgressMsg('');
    }
  };

  return (
    <>
      {/* Card UI nella Panoramica */}
      <div style={{
        background: 'var(--gradient-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: '20px 24px',
        marginTop: 24,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa'
              }}>
                <Package size={20} />
              </div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 16, fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>
                Passaggio di Consegne & Conformità Normativa
              </h3>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
              Esporta in un unico pacchetto compresso (<strong>.ZIP</strong>) il Registro Anagrafico e Contabile multifoglio Excel e tutti i documenti istituzionali del condominio richiesti dalla normativa italiana (Artt. 1129, 1130 e 1130-bis c.c.).
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 20px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Sora, sans-serif',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            <FolderArchive size={16} />
            <span>Esporta Pacchetto (.ZIP)</span>
          </button>
        </div>
      </div>

      {/* Modale Checklist Normativa e Conferma */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 16,
            width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto',
            padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative'
          }}>
            <button
              onClick={() => !downloading && setShowModal(false)}
              disabled={downloading}
              style={{
                position: 'absolute', top: 20, right: 20, background: 'transparent',
                border: 'none', color: 'var(--text-muted)', cursor: downloading ? 'not-allowed' : 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: allOk ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: allOk ? '#10b981' : '#f59e0b'
              }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 18, fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>
                  Checklist Normativa Passaggio di Consegne
                </h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Verifica di conformità prima della generazione dell'archivio digitale
                </p>
              </div>
            </div>

            {/* Banner riassuntivo */}
            <div style={{
              background: allOk ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: `1px solid ${allOk ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
              borderRadius: 10, padding: 14, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start'
            }}>
              {allOk ? <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />}
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {allOk ? (
                  <span><strong>Conformità Eccellente:</strong> Tutti i requisiti e i documenti di legge sono presenti nel gestionale. L'archivio conterrà una documentazione completa ai sensi del Codice Civile.</span>
                ) : (
                  <span><strong>Attenzione:</strong> Alcuni documenti previsti dalla normativa non risultano caricati in archivio. Il pacchetto conterrà comunque il registro Excel e i documenti disponibili.</span>
                )}
              </div>
            </div>

            {/* Lista controlli normativi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {requisiti.map((r, i) => (
                <div key={i} style={{
                  background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10,
                  padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12
                }}>
                  <div style={{ marginTop: 2 }}>
                    {r.ok ? <CheckCircle2 size={18} color="#10b981" /> : <AlertTriangle size={18} color="#f59e0b" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>{r.titolo}</span>
                      <span style={{
                        background: 'var(--app-bg)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border-color)'
                      }}>{r.norma}</span>
                    </div>
                    <p style={{ margin: 0, color: r.ok ? '#94a3b8' : '#cbd5e1', fontSize: 12, lineHeight: 1.4 }}>
                      {r.ok ? r.dettaglioOk : r.dettaglioErr}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Cosa contiene il pacchetto */}
            <div style={{ background: '#090d16', border: '1px solid var(--border-color-2)', borderRadius: 10, padding: 14, marginBottom: 24 }}>
              <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Contenuto della Cartella (.ZIP)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileSpreadsheet size={16} color="#3b82f6" />
                  <span><strong>1_REGISTRO_CONTABILE_E_ANAGRAFICO.xlsx</strong> (6 fogli contabili e anagrafici completi)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderArchive size={16} color="#0ea5e9" />
                  <span><strong>2_DOCUMENTI_E_ARCHIVIO/</strong> ({documenti.length} file PDF/DOCX organizzati per cartelle)</span>
                </div>
              </div>
            </div>

            {/* Barra di progresso o bottoni d'azione */}
            {downloading ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Loader2 size={28} color="#3b82f6" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ margin: 0, color: '#f8fafc', fontSize: 14, fontWeight: 600 }}>{progressMsg || 'Generazione pacchetto ZIP...'}</p>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>Attendere il completamento della compressione</p>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                    borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={handleDownload}
                  style={{
                    background: '#2563eb', color: '#ffffff', border: 'none',
                    borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <Download size={16} />
                  <span>Scarica Cartella (.ZIP)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

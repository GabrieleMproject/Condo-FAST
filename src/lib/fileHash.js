// src/lib/fileHash.js
/**
 * Calcola l'hash SHA-256 nativo di un oggetto File/Blob in ambiente Browser Web Crypto API.
 * @param {File|Blob} file
 * @returns {Promise<string>} Stringa esadecimale a 64 caratteri (es. "a3f5...")
 */
export async function calcolaFileHash(file) {
  if (!file) return '';
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (err) {
    console.warn('[fileHash] Impossibile calcolare SHA-256 del file:', err);
    return '';
  }
}

// Il file del nucleo che l'estensione esegue, verificato prima: l'impronta sha256 dichiarata in nucleo.json (scritta nel codice
// dalla costruzione del pacchetto). La pagina lo fa fare al browser con l'attributo `integrity`; qui lo fa l'estensione, prima del
// `require`. Senza editor si prova su una copia del file; con l'editor, su un'estensione installata con il file già cambiato.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/** Il motivo per cui il file non ha l'impronta dichiarata; null se ce l'ha. */
export function diversoDalDichiarato(file: string, sha256: string): string | null {
  let dati: Buffer;
  try {
    dati = readFileSync(file);
  } catch (e) {
    return `non si legge: ${e instanceof Error ? e.message : String(e)}`;
  }
  const misurata = createHash("sha256").update(dati).digest("hex");
  if (misurata !== sha256) return `${dati.length} byte e impronta ${misurata}, dichiarata ${sha256}`;
  return null;
}

/** Il nucleo caricato da `carica` solo se il file ha l'impronta dichiarata; se no null, e `carica` non si chiama. */
export function nucleoVerificato<T>(file: string, sha256: string, carica: () => T): { nucleo: T | null; motivo: string | null } {
  const motivo = diversoDalDichiarato(file, sha256);
  return motivo === null ? { nucleo: carica(), motivo: null } : { nucleo: null, motivo };
}

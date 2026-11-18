// Il file del nucleo che l'estensione esegue, verificato prima: byte e impronta sha256 dichiarati in nucleo.json (scritti nel
// codice dalla costruzione). La pagina lo fa fare al browser con l'attributo `integrity`; qui lo fa l'estensione, prima del
// `require`. Senza editor: si prova senza finestra, su una copia del file.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/** `byte` null: non dichiarati (il nucleo dal file di una release, dove nucleo.json dà la sola impronta). */
export type Dichiarato = { readonly byte: number | null; readonly sha256: string };

/** Il motivo per cui il file non è quello dichiarato; null se lo è. */
export function diversoDalDichiarato(file: string, dichiarato: Dichiarato): string | null {
  let dati: Buffer;
  try {
    dati = readFileSync(file);
  } catch (e) {
    return `non si legge: ${e instanceof Error ? e.message : String(e)}`;
  }
  const sha256 = createHash("sha256").update(dati).digest("hex");
  if ((dichiarato.byte !== null && dati.length !== dichiarato.byte) || sha256 !== dichiarato.sha256) return `${dati.length} byte e impronta ${sha256}, dichiarati ${dichiarato.byte ?? "?"} byte e ${dichiarato.sha256}`;
  return null;
}

/** Il nucleo caricato da `carica` solo se il file è quello dichiarato; se no null, e `carica` non si chiama. */
export function nucleoVerificato<T>(file: string, dichiarato: Dichiarato, carica: () => T): { nucleo: T | null; motivo: string | null } {
  const motivo = diversoDalDichiarato(file, dichiarato);
  return motivo === null ? { nucleo: carica(), motivo: null } : { nucleo: null, motivo };
}

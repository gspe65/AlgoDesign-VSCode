// Ciò che usano gli strumenti e le prove: le uscite a tre valori, le impronte, il lettore degli zip, il nucleo dichiarato.
//
// Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare). Un'eccezione non catturata è un fermo, non un rosso: i due
// gestori qui sotto valgono per chiunque importi questo modulo.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

export const RADICE = join(import.meta.dir, "..");

export function fermo(motivo: string): never {
  console.log(`FERMO: ${motivo}`);
  process.exit(2);
}

export function rosso(motivo: string): never {
  console.log(`ROSSO: ${motivo}`);
  process.exit(1);
}

process.on("uncaughtException", (e) => fermo(`eccezione: ${e instanceof Error ? e.stack ?? e.message : String(e)}`));
process.on("unhandledRejection", (e) => fermo(`eccezione: ${e instanceof Error ? e.stack ?? e.message : String(e)}`));

export function impronta(dati: Uint8Array): string {
  return createHash("sha256").update(dati).digest("hex");
}

/** Il nucleo che l'estensione usa: il file della release di AlgoDesign (`zip` e `file`, con le loro impronte), e i sorgenti al
 *  commit dell'etichetta, che danno i tipi, l'icona e i file di prova. `licenza` è un percorso nello zip. */
export type Nucleo = {
  etichetta: string;
  repository: string;
  commit: string;
  zip: { indirizzo: string; nome: string; sha256: string };
  file: { percorso: string; sha256: string };
  licenza: string;
  sorgenti: { punto_ingresso: string; punto_ingresso_sha256: string; icona: string; icona_sha256: string; casi: string };
};

const CHIAVI_DEL_NUCLEO = ["commit", "etichetta", "file", "licenza", "repository", "sorgenti", "zip"];
const IMPRONTA = /^[0-9a-f]{64}$/;
/** I motivi per cui il contenuto di nucleo.json non dichiara il file di una release; vuoto se lo dichiara. Il nucleo si prende
 *  solo dal file di una release: una chiave in più (come un modo di costruirlo dai sorgenti) è un motivo, col suo nome. */
export function motiviDelNucleo(n: unknown): string[] {
  if (typeof n !== "object" || n === null || Array.isArray(n)) return ["nucleo.json non è un oggetto"];
  const o = n as Record<string, unknown>;
  const motivi: string[] = [];
  const chiavi = differenze(Object.keys(o), CHIAVI_DEL_NUCLEO);
  for (const c of chiavi.soloA) motivi.push(`nucleo.json ha la chiave «${c}», che non si usa: il nucleo si prende solo dal file di una release (zip e file)`);
  for (const c of chiavi.soloB) motivi.push(`nucleo.json non ha la chiave «${c}»`);
  const zip = o["zip"] as Record<string, unknown> | undefined;
  const file = o["file"] as Record<string, unknown> | undefined;
  if (zip !== undefined && (typeof zip["indirizzo"] !== "string" || typeof zip["nome"] !== "string" || !IMPRONTA.test(String(zip["sha256"])))) motivi.push("nucleo.json: «zip» vuole indirizzo, nome e un'impronta sha256");
  if (file !== undefined && (typeof file["percorso"] !== "string" || !IMPRONTA.test(String(file["sha256"])))) motivi.push("nucleo.json: «file» vuole il percorso nello zip e un'impronta sha256");
  return motivi;
}

const nucleoLetto: unknown = JSON.parse(readFileSync(join(RADICE, "nucleo.json"), "utf8"));
const motiviDiNucleoJson = motiviDelNucleo(nucleoLetto);
if (motiviDiNucleoJson.length > 0) rosso(motiviDiNucleoJson.join("; "));
export const NUCLEO = nucleoLetto as Nucleo;
/** L'impronta che il file del nucleo deve avere. */
export const IMPRONTA_DEL_NUCLEO: string = NUCLEO.file.sha256;
/** Dove `bun run nucleo` mette ciò che scarica (cartella ignorata). */
export const CARTELLA_DEL_NUCLEO = join(RADICE, "nucleo");
export const FILE_DEL_NUCLEO = join(CARTELLA_DEL_NUCLEO, "algodesign-core.cjs");
export const LICENZA_DEL_NUCLEO = join(CARTELLA_DEL_NUCLEO, "LICENSE");
export const SORGENTI = join(CARTELLA_DEL_NUCLEO, "sorgenti");

/** Le voci di uno zip lette dal suo indice in coda al file, coi contenuti: il nome di ogni file (le cartelle no) e i suoi byte.
 *  Uno zip che non si legge è un'eccezione col motivo: chi chiama decide se è un rosso o un fermo. */
export function vociDelloZip(archivio: Uint8Array): Map<string, Uint8Array> {
  const z = Buffer.from(archivio.buffer, archivio.byteOffset, archivio.byteLength);
  if (z.length < 22) throw new Error(`troppo corto per uno zip: ${z.length} byte`);
  let fine = z.length - 22;
  while (fine >= Math.max(0, z.length - 22 - 0xffff) && z.readUInt32LE(fine) !== 0x06054b50) fine--;
  if (fine < 0 || z.readUInt32LE(fine) !== 0x06054b50) throw new Error("manca la fine dell'indice");
  const quante = z.readUInt16LE(fine + 10);
  const voci = new Map<string, Uint8Array>();
  let p = z.readUInt32LE(fine + 16);
  for (let i = 0; i < quante; i++) {
    if (p + 46 > z.length || z.readUInt32LE(p) !== 0x02014b50) throw new Error(`voce ${i} dell'indice senza la sua firma`);
    const lunghezzaNome = z.readUInt16LE(p + 28);
    const nome = z.toString("utf8", p + 46, p + 46 + lunghezzaNome);
    const testata = z.readUInt32LE(p + 42);
    if (testata + 30 > z.length || z.readUInt32LE(testata) !== 0x04034b50) throw new Error(`${nome}: testata locale senza la sua firma`);
    const inizio = testata + 30 + z.readUInt16LE(testata + 26) + z.readUInt16LE(testata + 28);
    const grandezza = z.readUInt32LE(p + 20);
    if (inizio + grandezza > z.length) throw new Error(`${nome}: i dati escono dal file`);
    const dati = z.subarray(inizio, inizio + grandezza);
    const metodo = z.readUInt16LE(p + 10);
    if (metodo !== 0 && metodo !== 8) throw new Error(`${nome}: metodo di compressione sconosciuto ${metodo}`);
    if (voci.has(nome)) throw new Error(`${nome}: voce ripetuta nell'indice`);
    if (!nome.endsWith("/")) voci.set(nome, metodo === 0 ? new Uint8Array(dati) : new Uint8Array(inflateRawSync(dati)));
    p += 46 + lunghezzaNome + z.readUInt16LE(p + 30) + z.readUInt16LE(p + 32);
  }
  return voci;
}

/** Due elenchi confrontati nei due versi: ciò che sta solo nel primo e ciò che sta solo nel secondo. */
export function differenze(a: Iterable<string>, b: Iterable<string>): { soloA: string[]; soloB: string[] } {
  const A = new Set(a);
  const B = new Set(b);
  return { soloA: [...A].filter((x) => !B.has(x)).sort(), soloB: [...B].filter((x) => !A.has(x)).sort() };
}

export function esegui(comando: string[], cwd = RADICE): { uscita: number; testo: string } {
  const p = Bun.spawnSync(comando, { cwd, stdout: "pipe", stderr: "pipe" });
  return { uscita: p.exitCode ?? -1, testo: `${p.stdout.toString()}${p.stderr.toString()}` };
}

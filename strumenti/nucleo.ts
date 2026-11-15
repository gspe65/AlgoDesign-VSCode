// Il nucleo di AlgoDesign dichiarato in nucleo.json: il file della release, confrontato con le impronte dello zip e del file,
// e i sorgenti al commit dell'etichetta (per i tipi, l'icona e i file di prova). Tutto in nucleo/ (ignorata).
//
//   bun run nucleo        atteso: ESITO: VERDE
//
// Uscite: 0 verde, 1 rosso, 2 fermo. Un'impronta sbagliata è un rosso, e lo zip sbagliato non resta in nucleo/.
//
// Che cosa NON guarda:
// - che il file della release sia stato costruito da quei sorgenti: lo dichiara AlgoDesign, e la sua conformità lo prova;
// - gli altri file dello zip, a parte la licenza;
// - i sorgenti fuori da `app/`.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CARTELLA_DEL_NUCLEO, esegui, fermo, FILE_DEL_NUCLEO, impronta, LICENZA_DEL_NUCLEO, NUCLEO, rosso, SORGENTI, vociDelloZip } from "./comune";

console.log(`nucleo: AlgoDesign ${NUCLEO.etichetta}, commit ${NUCLEO.commit.slice(0, 12)}`);
mkdirSync(CARTELLA_DEL_NUCLEO, { recursive: true });

// --- Lo zip della release: dalla cartella se c'è già, altrimenti dalla rete.
const fileZip = join(CARTELLA_DEL_NUCLEO, NUCLEO.zip.nome);
let zip: Uint8Array;
if (existsSync(fileZip)) zip = readFileSync(fileZip);
else {
  const r = await fetch(NUCLEO.zip.indirizzo).catch((e: unknown) => fermo(`non si è potuto scaricare ${NUCLEO.zip.indirizzo}: ${String(e)}`));
  if (!r.ok) fermo(`non si è potuto scaricare ${NUCLEO.zip.indirizzo}: risposta ${r.status}`);
  zip = new Uint8Array(await r.arrayBuffer());
}
console.log(`zip ${existsSync(fileZip) ? "già scaricato" : "dalla rete"}: ${zip.length} byte, impronta ${impronta(zip).slice(0, 12)}`);
if (impronta(zip) !== NUCLEO.zip.sha256) {
  rmSync(fileZip, { force: true });
  rosso(`l'impronta dello zip non torna: dichiarata ${NUCLEO.zip.sha256}, misurata ${impronta(zip)}`);
}
if (!existsSync(fileZip)) writeFileSync(fileZip, zip);

let voci: Map<string, Uint8Array>;
try {
  voci = vociDelloZip(zip);
} catch (e) {
  rosso(`lo zip della release non si legge: ${e instanceof Error ? e.message : String(e)}`);
}
const file = voci.get(NUCLEO.file.percorso) ?? rosso(`il file non è nello zip: ${NUCLEO.file.percorso}`);
if (impronta(file) !== NUCLEO.file.sha256) rosso(`l'impronta del file non torna: dichiarata ${NUCLEO.file.sha256}, misurata ${impronta(file)}`);
writeFileSync(FILE_DEL_NUCLEO, file);
const licenza = voci.get(NUCLEO.licenza) ?? rosso(`la licenza non è nello zip: ${NUCLEO.licenza}`);
writeFileSync(LICENZA_DEL_NUCLEO, licenza);
console.log(`file ${NUCLEO.file.percorso}: ${file.length} byte, impronta ${impronta(file).slice(0, 12)}; licenza ${licenza.length} byte`);

// --- I sorgenti al commit dell'etichetta, solo `app/`: un clone parziale, che git verifica per impronta del commit.
const git = (...a: string[]) => esegui(["git", "-C", SORGENTI, ...a]);
if (!existsSync(join(SORGENTI, ".git"))) {
  const c = esegui(["git", "clone", "--quiet", "--filter=blob:none", "--no-checkout", NUCLEO.repository, SORGENTI]);
  if (c.uscita !== 0) fermo(`il clone dei sorgenti non è riuscito:\n${c.testo}`);
  const s = git("sparse-checkout", "set", "app");
  if (s.uscita !== 0) fermo(`sparse-checkout non riuscito:\n${s.testo}`);
}
const etichetta = git("rev-parse", `refs/tags/${NUCLEO.etichetta}^{commit}`);
if (etichetta.uscita !== 0) fermo(`l'etichetta ${NUCLEO.etichetta} non c'è nei sorgenti:\n${etichetta.testo}`);
if (etichetta.testo.trim() !== NUCLEO.commit) rosso(`l'etichetta ${NUCLEO.etichetta} punta a ${etichetta.testo.trim()}, nucleo.json dichiara ${NUCLEO.commit}`);
const co = git("checkout", "--quiet", "--detach", NUCLEO.commit);
if (co.uscita !== 0) fermo(`il checkout del commit non è riuscito:\n${co.testo}`);
const testa = git("rev-parse", "HEAD").testo.trim();
if (testa !== NUCLEO.commit) rosso(`i sorgenti sono a ${testa}, attesi a ${NUCLEO.commit}`);
const sporchi = git("status", "--porcelain").testo.trim();
if (sporchi !== "") rosso(`i sorgenti hanno modifiche:\n${sporchi}`);

const ingresso = readFileSync(join(SORGENTI, ...NUCLEO.sorgenti.punto_ingresso.split("/")));
if (impronta(ingresso) !== NUCLEO.sorgenti.punto_ingresso_sha256) rosso(`il punto d'ingresso ha l'impronta ${impronta(ingresso)}, dichiarata ${NUCLEO.sorgenti.punto_ingresso_sha256}`);
const icona = readFileSync(join(SORGENTI, ...NUCLEO.sorgenti.icona.split("/")));
if (impronta(icona) !== NUCLEO.sorgenti.icona_sha256) rosso(`l'icona ha l'impronta ${impronta(icona)}, dichiarata ${NUCLEO.sorgenti.icona_sha256}`);
console.log(`sorgenti al commit ${testa.slice(0, 12)}: punto d'ingresso ${impronta(ingresso).slice(0, 12)}, icona ${impronta(icona).slice(0, 12)}`);
console.log("ESITO: VERDE");

// Il nucleo di AlgoDesign dichiarato in nucleo.json, in uno dei due modi: il file della release (confrontato con le impronte dello
// zip e del file), o il file costruito dai sorgenti all'etichetta con le opzioni di AlgoDesign (confrontato con byte e impronta
// dichiarati), quando l'etichetta non ha una release. In tutti e due i sorgenti al commit dell'etichetta (per i tipi, l'icona e i
// file di prova). Tutto in nucleo/ (ignorata).
//
//   bun run nucleo        atteso: ESITO: VERDE
//
// Uscite: 0 verde, 1 rosso, 2 fermo. Un'impronta sbagliata è un rosso, e il file sbagliato non resta in nucleo/.
//
// Che cosa NON guarda:
// - nel modo della release, che il file sia stato costruito da quei sorgenti: lo dichiara AlgoDesign, e la sua conformità lo prova;
// - gli altri file dello zip, a parte la licenza;
// - i sorgenti fuori da `app/`, a parte i file della radice (la licenza);
// - nel modo della costruzione, una versione di Bun diversa da quella dichiarata: è un fermo, perché i byte non sono confrontabili.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CARTELLA_DEL_NUCLEO, esegui, fermo, FILE_DEL_NUCLEO, impronta, LICENZA_DEL_NUCLEO, NUCLEO, rosso, SORGENTI, vociDelloZip } from "./comune";

console.log(`nucleo: AlgoDesign ${NUCLEO.etichetta}, commit ${NUCLEO.commit.slice(0, 12)}, ${NUCLEO.costruzione !== undefined ? "costruito dai sorgenti" : "file della release"}`);
mkdirSync(CARTELLA_DEL_NUCLEO, { recursive: true });

// --- I sorgenti al commit dell'etichetta, solo `app/` e i file della radice: un clone parziale, che git verifica per impronta
// del commit. Un'etichetta che il clone non ha ancora si chiede al repository.
const git = (...a: string[]) => esegui(["git", "-C", SORGENTI, ...a]);
if (!existsSync(join(SORGENTI, ".git"))) {
  const c = esegui(["git", "clone", "--quiet", "--filter=blob:none", "--no-checkout", NUCLEO.repository, SORGENTI]);
  if (c.uscita !== 0) fermo(`il clone dei sorgenti non è riuscito:\n${c.testo}`);
  const s = git("sparse-checkout", "set", "app");
  if (s.uscita !== 0) fermo(`sparse-checkout non riuscito:\n${s.testo}`);
}
let etichetta = git("rev-parse", `refs/tags/${NUCLEO.etichetta}^{commit}`);
if (etichetta.uscita !== 0) {
  const f = git("fetch", "--quiet", "origin", "tag", NUCLEO.etichetta);
  if (f.uscita !== 0) fermo(`l'etichetta ${NUCLEO.etichetta} non c'è nel repository:\n${f.testo}`);
  etichetta = git("rev-parse", `refs/tags/${NUCLEO.etichetta}^{commit}`);
}
if (etichetta.uscita !== 0) fermo(`l'etichetta ${NUCLEO.etichetta} non c'è nei sorgenti:\n${etichetta.testo}`);
if (etichetta.testo.trim() !== NUCLEO.commit) rosso(`l'etichetta ${NUCLEO.etichetta} punta a ${etichetta.testo.trim()}, nucleo.json dichiara ${NUCLEO.commit}`);
const co = git("checkout", "--quiet", "--detach", NUCLEO.commit);
if (co.uscita !== 0) fermo(`il checkout del commit non è riuscito:\n${co.testo}`);
const testa = git("rev-parse", "HEAD").testo.trim();
if (testa !== NUCLEO.commit) rosso(`i sorgenti sono a ${testa}, attesi a ${NUCLEO.commit}`);
const sporchi = git("status", "--porcelain").testo.trim();
if (sporchi !== "") rosso(`i sorgenti hanno modifiche:\n${sporchi}`);

const percorsoIngresso = join(SORGENTI, ...NUCLEO.sorgenti.punto_ingresso.split("/"));
const ingresso = readFileSync(percorsoIngresso);
if (impronta(ingresso) !== NUCLEO.sorgenti.punto_ingresso_sha256) rosso(`il punto d'ingresso ha l'impronta ${impronta(ingresso)}, dichiarata ${NUCLEO.sorgenti.punto_ingresso_sha256}`);
const icona = readFileSync(join(SORGENTI, ...NUCLEO.sorgenti.icona.split("/")));
if (impronta(icona) !== NUCLEO.sorgenti.icona_sha256) rosso(`l'icona ha l'impronta ${impronta(icona)}, dichiarata ${NUCLEO.sorgenti.icona_sha256}`);
console.log(`sorgenti al commit ${testa.slice(0, 12)}: punto d'ingresso ${impronta(ingresso).slice(0, 12)}, icona ${impronta(icona).slice(0, 12)}`);

if (NUCLEO.costruzione !== undefined) {
  // --- Il file costruito dai sorgenti, con le opzioni del pacchetto di AlgoDesign. Si scrive solo se byte e impronta tornano.
  const c = NUCLEO.costruzione;
  if (Bun.version !== c.bun) fermo(`bun ${Bun.version}, nucleo.json dichiara la costruzione con bun ${c.bun}: i byte non sono confrontabili`);
  const costruito = join(CARTELLA_DEL_NUCLEO, "costruito.cjs");
  rmSync(costruito, { force: true });
  const b = esegui([process.execPath, "build", percorsoIngresso, "--target=node", "--format=cjs", "--minify-whitespace", `--outfile=${costruito}`]);
  if (b.uscita !== 0 || !existsSync(costruito)) fermo(`la costruzione del nucleo non è riuscita, uscita ${b.uscita}:\n${b.testo}`);
  const file = readFileSync(costruito);
  rmSync(costruito, { force: true });
  console.log(`costruito con bun ${Bun.version}: ${file.length} byte, impronta ${impronta(file)}`);
  if (impronta(file) !== c.sha256 || file.length !== c.byte) {
    rmSync(FILE_DEL_NUCLEO, { force: true });
    rosso(`il file costruito non torna: dichiarati ${c.byte} byte e l'impronta ${c.sha256}`);
  }
  writeFileSync(FILE_DEL_NUCLEO, file);
  const licenza = join(SORGENTI, ...NUCLEO.licenza.split("/"));
  if (!existsSync(licenza)) rosso(`la licenza non è nei sorgenti: ${NUCLEO.licenza}`);
  writeFileSync(LICENZA_DEL_NUCLEO, readFileSync(licenza));
  console.log(`licenza ${NUCLEO.licenza} dei sorgenti: ${readFileSync(licenza).length} byte`);
} else {
  // --- Lo zip della release: dalla cartella se c'è già, altrimenti dalla rete.
  const zipDichiarato = NUCLEO.zip!;
  const fileDichiarato = NUCLEO.file!;
  const fileZip = join(CARTELLA_DEL_NUCLEO, zipDichiarato.nome);
  let zip: Uint8Array;
  if (existsSync(fileZip)) zip = readFileSync(fileZip);
  else {
    const r = await fetch(zipDichiarato.indirizzo).catch((e: unknown) => fermo(`non si è potuto scaricare ${zipDichiarato.indirizzo}: ${String(e)}`));
    if (!r.ok) fermo(`non si è potuto scaricare ${zipDichiarato.indirizzo}: risposta ${r.status}`);
    zip = new Uint8Array(await r.arrayBuffer());
  }
  console.log(`zip ${existsSync(fileZip) ? "già scaricato" : "dalla rete"}: ${zip.length} byte, impronta ${impronta(zip).slice(0, 12)}`);
  if (impronta(zip) !== zipDichiarato.sha256) {
    rmSync(fileZip, { force: true });
    rosso(`l'impronta dello zip non torna: dichiarata ${zipDichiarato.sha256}, misurata ${impronta(zip)}`);
  }
  if (!existsSync(fileZip)) writeFileSync(fileZip, zip);

  let voci: Map<string, Uint8Array>;
  try {
    voci = vociDelloZip(zip);
  } catch (e) {
    rosso(`lo zip della release non si legge: ${e instanceof Error ? e.message : String(e)}`);
  }
  const file = voci.get(fileDichiarato.percorso) ?? rosso(`il file non è nello zip: ${fileDichiarato.percorso}`);
  if (impronta(file) !== fileDichiarato.sha256) rosso(`l'impronta del file non torna: dichiarata ${fileDichiarato.sha256}, misurata ${impronta(file)}`);
  writeFileSync(FILE_DEL_NUCLEO, file);
  const licenza = voci.get(NUCLEO.licenza) ?? rosso(`la licenza non è nello zip: ${NUCLEO.licenza}`);
  writeFileSync(LICENZA_DEL_NUCLEO, licenza);
  console.log(`file ${fileDichiarato.percorso}: ${file.length} byte, impronta ${impronta(file).slice(0, 12)}; licenza ${licenza.length} byte`);
}
console.log("ESITO: VERDE");

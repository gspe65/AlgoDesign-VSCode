// La prova dell'estensione: il pacchetto, la logica e, con `--editor`, l'estensione dentro l'editor indicato.
//
//   bun prove/prova.ts                                   costruisce il pacchetto e lo prova senza aprire nulla
//   bun prove/prova.ts --editor <eseguibile>             lo stesso, poi apre quell'editor per pochi secondi, con un profilo temporaneo
//   opzioni: --pacchetto <file .vsix>  prova quel pacchetto invece di costruirlo (la corsa delle Actions: costruito una volta sola)
//            --rapporto <file>         scrive l'esito in JSON (sistema, impronta del pacchetto, prove, fallite, esito)
//
// Atteso: ESITO: VERDE, prove N/N. Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare). Prima: bun run nucleo.
//
// Che cosa NON guarda:
// - che il file del nucleo generi ciò che generano i sorgenti di AlgoDesign su tutto il corpus: è la conformità del nucleo; qui il
//   documento nell'editor si confronta con ciò che lo STESSO file del pacchetto produce fuori dall'editor;
// - un valore di linguaggio o di lingua scritto a mano nelle impostazioni, fuori dall'elenco del manifesto: nell'editor no, l'errore
//   col nome lo prova la logica;
// - l'aggiornamento del documento senza rilanciare il comando, che non c'è;
// - la condizione del comando nella palette: il comando si chiama direttamente, e quella condizione distingue le maiuscole;
// - un editor diverso da quello dato con `--editor`;
// - il primo piano del sistema; il fuoco dentro l'editor invece è una prova.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { documento, testoDelRifiuto, type Libreria } from "../src/documento";
import { differenze, esegui, fermo, FILE_DEL_NUCLEO, impronta, LICENZA_DEL_NUCLEO, NUCLEO, RADICE, SORGENTI, vociDelloZip } from "../strumenti/comune";

const { values: opzioni } = parseArgs({
  args: Bun.argv.slice(2),
  options: { editor: { type: "string" }, pacchetto: { type: "string" }, rapporto: { type: "string" } },
  strict: true,
});

/** I denominatori, dichiarati prima della corsa: le chiamate a `prova` senza editor, e quelle in più con l'editor. */
const PROVE_SENZA_EDITOR = 23;
const PROVE_DELL_EDITOR = 19;
const TEST_ATTESI = 15;

/** Ciò che il pacchetto contiene, e nient'altro. */
const NEL_PACCHETTO = ["[Content_Types].xml", "extension.vsixmanifest", "extension/LICENSE.txt", "extension/LICENZA-ALGODESIGN.txt", "extension/dist/extension.cjs", "extension/dist/libreria.cjs", "extension/icona.png", "extension/package.json", "extension/readme.md"];
/** Le voci che sono file del repository così come sono: si confrontano byte per byte con quei file. Il README vsce lo mette
 *  sempre, anche se .vscodeignore esclude tutto: l'editor lo mostra nei dettagli dell'estensione. */
const DAL_REPOSITORY: Record<string, string> = { "extension/package.json": "package.json", "extension/LICENSE.txt": "LICENSE", "extension/LICENZA-ALGODESIGN.txt": "LICENZA-ALGODESIGN.txt", "extension/icona.png": "icona.png", "extension/readme.md": "README.md" };
const IMPORT_ATTESI = ["./libreria.cjs", "vscode"];
const PERCORSO_ASSOLUTO = /(?<![A-Za-z])[A-Za-z]:[\\/]/;
/** Stringhe che nel pacchetto non devono esserci: il motore con cui si costruisce e si prova. */
const VIETATE = [/bun:/, /Bun\./];

/** Un file vero del corpus di AlgoDesign, e le combinazioni che l'editor guarda: un testo in due lingue, e un rifiuto. */
const FILE = "tappa-1/arrotonda-meta";
const CASI = [["python", "en"], ["python", "it"], ["accademico", "en"]] as const;

if (!existsSync(FILE_DEL_NUCLEO) || !existsSync(join(SORGENTI, ".git"))) fermo("manca il nucleo: prima bun run nucleo");
if (impronta(readFileSync(FILE_DEL_NUCLEO)) !== NUCLEO.file.sha256) fermo("il file del nucleo non ha l'impronta di nucleo.json: si rifà bun run nucleo");

const cartella = mkdtempSync(join(tmpdir(), "algo  prova-"));
process.on("exit", () => rmSync(cartella, { recursive: true, force: true }));

let fatte = 0;
const fallite: string[] = [];
function prova(nome: string, buona: boolean, dettaglio = ""): void {
  fatte++;
  console.log(`${buona ? "PASS" : "FAIL"}  ${nome}${buona ? "" : `\n      ${dettaglio}`}`);
  if (!buona) fallite.push(nome);
}

const manifestoDelRepository = JSON.parse(readFileSync(join(RADICE, "package.json"), "utf8")) as { name: string; version: string };

// --- Il pacchetto: costruito ora, o quello dato.
let VSIX: string;
if (opzioni.pacchetto !== undefined) {
  VSIX = opzioni.pacchetto;
  if (!existsSync(VSIX)) fermo(`non c'è il pacchetto ${VSIX}`);
  console.log(`pacchetto dato: ${VSIX}`);
} else {
  VSIX = join(RADICE, "dist", `${manifestoDelRepository.name}-${manifestoDelRepository.version}.vsix`);
  const costruzione = esegui(["bun", "run", "costruisci"]);
  prova("la costruzione: estensione, nucleo, pacchetto", costruzione.uscita === 0 && existsSync(VSIX), costruzione.testo);
  if (!existsSync(VSIX)) fermo(`il pacchetto non c'è:\n${costruzione.testo}`);
}
const pacchetto = readFileSync(VSIX);
console.log(`pacchetto: ${pacchetto.length} byte, impronta ${impronta(pacchetto)}`);

// --- I tipi: l'estensione contro il punto d'ingresso del nucleo; le prove e gli strumenti.
const tsc = join(RADICE, "node_modules", "typescript", "bin", "tsc");
if (!existsSync(tsc)) fermo("tsc non c'è: prima bun install --frozen-lockfile");
for (const [nome, conf] of [["l'estensione", "tsconfig.json"], ["le prove e gli strumenti", join("prove", "tsconfig.json")]] as const) {
  const t = esegui(["node", tsc, "-p", conf]);
  prova(`tsc su ${nome}`, t.uscita === 0, t.testo);
}

// --- La logica. L'esito si legge dal rapporto che il programma scrive, non dalla sola uscita.
const rapportoDeiTest = join(cartella, "test.xml");
const test = esegui(["bun", "test", "./prove/documento.test.ts", "--reporter=junit", `--reporter-outfile=${rapportoDeiTest}`]);
if (!existsSync(rapportoDeiTest)) fermo(`bun test non ha scritto il rapporto, uscita ${test.uscita}:\n${test.testo}`);
const radiceDelRapporto = /<testsuites\b[^>]*>/.exec(readFileSync(rapportoDeiTest, "utf8"))?.[0] ?? "";
const numero = (nome: string) => Number(new RegExp(`\\b${nome}="(\\d+)"`).exec(radiceDelRapporto)?.[1] ?? "-1");
console.log(`logica: ${numero("tests")} prove, fallite ${numero("failures")}, saltate ${numero("skipped")}; dichiarate ${TEST_ATTESI}`);
// `tests` conta anche quelle saltate: una prova saltata non è una prova passata.
prova("la logica, senza editor", test.uscita === 0 && numero("tests") === TEST_ATTESI && numero("failures") === 0 && numero("skipped") === 0, test.testo);

// --- Il verdetto sul pacchetto: una funzione sola, per il file vero e per le mutazioni. Vuoto è verde; ogni motivo nomina la voce.
const colpiIn = (testo: string): string[] => [PERCORSO_ASSOLUTO, ...VIETATE].flatMap((rx) => rx.exec(testo)?.[0] ?? []);
const importDi = (testo: string): string[] => [...new Set(new Bun.Transpiler({ loader: "js" }).scanImports(testo).map((i) => i.path))].sort();
type ManifestoDelleIcone = { icon?: string; license?: string; contributes?: { languages?: { id: string; extensions?: string[]; icon?: { light?: string; dark?: string } }[] } };
/** Il manifesto dà l'icona al pannello e al linguaggio dei file `.algo`, chiara e scura. */
const iconaDichiarata = (m: ManifestoDelleIcone): boolean => {
  const l = m.contributes?.languages?.find((x) => x.extensions?.includes(".algo"));
  return m.icon === "icona.png" && l !== undefined && [l.icon?.light, l.icon?.dark].every((p) => p?.replace(/^\.\//, "") === "icona.png");
};
const licenzaDelNucleo = readFileSync(LICENZA_DEL_NUCLEO);
const iconaDelNucleo = readFileSync(join(SORGENTI, ...NUCLEO.sorgenti.icona.split("/")));

function motiviDelleVoci(voci: ReadonlyMap<string, Uint8Array>): string[] {
  const motivi: string[] = [];
  const elenco = differenze(voci.keys(), NEL_PACCHETTO);
  for (const v of elenco.soloA) motivi.push(`voce in più: ${v}`);
  for (const v of elenco.soloB) motivi.push(`voce mancante: ${v}`);
  for (const [voce, file] of Object.entries(DAL_REPOSITORY)) {
    const d = voci.get(voce);
    if (d !== undefined && impronta(d) !== impronta(readFileSync(join(RADICE, file)))) motivi.push(`${voce}: non è ${file} del repository`);
  }
  const libreria = voci.get("extension/dist/libreria.cjs");
  if (libreria !== undefined && impronta(libreria) !== NUCLEO.file.sha256) motivi.push(`extension/dist/libreria.cjs: non è il file del nucleo (${impronta(libreria).slice(0, 12)})`);
  const licenza = voci.get("extension/LICENZA-ALGODESIGN.txt");
  if (licenza !== undefined && impronta(licenza) !== impronta(licenzaDelNucleo)) motivi.push("extension/LICENZA-ALGODESIGN.txt: non è la licenza dello zip del nucleo");
  const icona = voci.get("extension/icona.png");
  if (icona !== undefined && impronta(icona) !== impronta(iconaDelNucleo)) motivi.push("extension/icona.png: non è l'icona di AlgoDesign al commit");
  const codice = voci.get("extension/dist/extension.cjs");
  if (codice !== undefined && importDi(new TextDecoder().decode(codice)).join() !== IMPORT_ATTESI.join()) motivi.push(`extension/dist/extension.cjs: importa ${importDi(new TextDecoder().decode(codice)).join(", ")}`);
  const manifesto = voci.get("extension/package.json");
  if (manifesto !== undefined) {
    const m = JSON.parse(new TextDecoder().decode(manifesto)) as ManifestoDelleIcone;
    if (!iconaDichiarata(m)) motivi.push("extension/package.json: l'icona non è dichiarata per il pannello e per i file .algo, chiara e scura");
    if (m.license !== "MIT") motivi.push(`extension/package.json: licenza ${m.license}`);
  }
  const vsixManifest = voci.get("extension.vsixmanifest");
  if (vsixManifest !== undefined && !new TextDecoder().decode(vsixManifest).includes("<License>extension/LICENSE.txt</License>")) motivi.push("extension.vsixmanifest: non indica la licenza");
  // Ogni voce tranne l'icona, che è un'immagine confrontata per impronta: anche le voci in più.
  for (const [v, d] of voci) if (v !== "extension/icona.png") for (const c of colpiIn(new TextDecoder().decode(d))) motivi.push(`${v}: ${c}`);
  return motivi;
}
/** Il verdetto su un file: uno zip che non si legge è un rosso di questa prova, col motivo, come ogni altro. */
function motiviDelFile(dati: Uint8Array): string[] {
  let voci: Map<string, Uint8Array>;
  try {
    voci = vociDelloZip(dati);
  } catch (e) {
    return [`il pacchetto non si legge: ${e instanceof Error ? e.message : String(e)}`];
  }
  return motiviDelleVoci(voci);
}

const motiviVeri = motiviDelFile(pacchetto);
const voci = (() => {
  try {
    return vociDelloZip(pacchetto);
  } catch {
    return new Map<string, Uint8Array>();
  }
})();
console.log(`voci: ${voci.size}, attese ${NEL_PACCHETTO.length}; voci di testo guardate dai cercatori ${[...voci.keys()].filter((v) => v !== "extension/icona.png").length}; motivi ${motiviVeri.length}`);
prova("il pacchetto: le voci attese nei due versi, i file del repository, il file e la licenza del nucleo, l'icona, gli import, il manifesto, nessun percorso assoluto né stringa vietata", motiviVeri.length === 0, motiviVeri.join("; "));

// Il lettore dello zip di queste prove contro un lettore del sistema, sullo stesso file: lo stesso elenco nei due versi, e ogni
// voce con gli stessi byte. Su Windows il `tar` di System32 (quello di una shell può essere GNU tar, che uno zip non lo apre);
// altrove `unzip`.
const estratto = join(cartella, "estratto  dal pacchetto");
mkdirSync(estratto);
const [elencoDelSistema, estrazione] = process.platform === "win32"
  ? (() => {
      const tar = join(process.env.SystemRoot ?? fermo("manca SystemRoot"), "System32", "tar.exe");
      return [esegui([tar, "-tf", VSIX]), esegui([tar, "-xf", VSIX, "-C", estratto])];
    })()
  : [esegui(["unzip", "-Z1", VSIX]), esegui(["unzip", "-q", VSIX, "-d", estratto])];
if (elencoDelSistema.uscita !== 0 || estrazione.uscita !== 0) fermo(`il lettore del sistema non apre il pacchetto:\n${elencoDelSistema.testo}\n${estrazione.testo}`);
const contenuto = elencoDelSistema.testo.split(/\r?\n/).filter((r) => r !== "" && !r.endsWith("/"));
const lettoreContro = differenze(voci.keys(), contenuto);
const lettoreDiverse = [...voci].filter(([v, d]) => !existsSync(join(estratto, v)) || impronta(d) !== impronta(readFileSync(join(estratto, v)))).map(([v]) => v);
console.log(`lettore dello zip: ${voci.size} voci, lettore del sistema ${contenuto.length}; solo nel nostro ${lettoreContro.soloA.length}, solo nel sistema ${lettoreContro.soloB.length}, byte diversi ${lettoreDiverse.length}`);
prova("il lettore dello zip vede il pacchetto come il lettore del sistema: stesso elenco, stessi byte", voci.size > 0 && lettoreContro.soloA.length + lettoreContro.soloB.length + lettoreDiverse.length === 0, `solo nel nostro: ${lettoreContro.soloA.join(", ")}; solo nel sistema: ${lettoreContro.soloB.join(", ")}; diversi: ${lettoreDiverse.join(", ")}`);

const manifesto = JSON.parse(readFileSync(join(estratto, "extension", "package.json"), "utf8")) as { contributes: { configuration: { properties: { "algo.linguaggio": { enum: string[] } } } } };
const offerti = manifesto.contributes.configuration.properties["algo.linguaggio"].enum;
const { linguaggi } = (await import(join(SORGENTI, "app", "core", "genera", "linguaggi.ts"))) as { linguaggi: { id: string }[] };
const registro = differenze(offerti, linguaggi.map((v) => v.id));
console.log(`linguaggi offerti: ${offerti.length}, nel registro del nucleo ${linguaggi.length}; solo offerti ${registro.soloA.length}, solo nel registro ${registro.soloB.length}`);
prova("l'impostazione offre le voci del registro del nucleo, elemento per elemento", registro.soloA.length === 0 && registro.soloB.length === 0, `${registro.soloA.join(", ")}; ${registro.soloB.join(", ")}`);

// --- Le mutazioni del verdetto: ognuna deve dare rosso col suo motivo, e lei solo. Si guarda anche quante voci ha toccato.
function mutazione(nome: string, toccate: number, motivi: string[], attesi: string[]): void {
  console.log(`  ${nome}: toccate ${toccate}, motivi ${motivi.length}: ${motivi.join("; ")}`);
  prova(`mutazione: ${nome}`, toccate > 0 && motivi.length === attesi.length && attesi.every((a, i) => motivi[i] === a), `toccate ${toccate}; motivi: ${motivi.join("; ")}`);
}
const mutata = (cambia: (m: Map<string, Uint8Array>) => number): { voci: Map<string, Uint8Array>; toccate: number } => {
  const m = new Map(voci);
  return { toccate: cambia(m), voci: m };
};
const testo = (s: string) => new TextEncoder().encode(s);
const EXTRA = "extension/dist/extra.cjs";
prova("controllo: le voci vere, copiate senza mutazioni, sono verdi", motiviDelleVoci(new Map(voci)).length === 0);
{
  const m = mutata((v) => (v.set(EXTRA, testo("module.exports = 1;\n")), 1));
  mutazione("una voce in più", m.toccate, motiviDelleVoci(m.voci), [`voce in più: ${EXTRA}`]);
}
{
  const m = mutata((v) => Number(v.delete("extension/LICENSE.txt")));
  mutazione("una voce mancante", m.toccate, motiviDelleVoci(m.voci), ["voce mancante: extension/LICENSE.txt"]);
}
{
  const m = mutata((v) => (v.set("extension/dist/libreria.cjs", Buffer.concat([v.get("extension/dist/libreria.cjs") ?? new Uint8Array(), Buffer.from("\n")])), 1));
  mutazione("un byte in più nel file del nucleo", m.toccate, motiviDelleVoci(m.voci), [`extension/dist/libreria.cjs: non è il file del nucleo (${impronta(m.voci.get("extension/dist/libreria.cjs")!).slice(0, 12)})`]);
}
{
  const m = mutata((v) => (v.set("extension/package.json", Buffer.concat([v.get("extension/package.json") ?? new Uint8Array(), Buffer.from(" ")])), 1));
  mutazione("un manifesto diverso da quello del repository", m.toccate, motiviDelleVoci(m.voci), ["extension/package.json: non è package.json del repository"]);
}
{
  const m = mutata((v) => (v.set("extension/icona.png", Buffer.concat([v.get("extension/icona.png") ?? new Uint8Array(), Buffer.from([0])])), 1));
  mutazione("un'icona diversa", m.toccate, motiviDelleVoci(m.voci), ["extension/icona.png: non è icona.png del repository", "extension/icona.png: non è l'icona di AlgoDesign al commit"]);
}
{
  const m = mutata((v) => (v.set("extension/dist/extension.cjs", Buffer.concat([v.get("extension/dist/extension.cjs") ?? new Uint8Array(), Buffer.from('\nif (false) require("altro");')])), 1));
  mutazione("un import in più", m.toccate, motiviDelleVoci(m.voci), ["extension/dist/extension.cjs: importa ./libreria.cjs, altro, vscode"]);
}
// I percorsi assoluti delle sonde si compongono qui: scritti per intero, il controllo di confine li troverebbe in questo file.
const assoluto = (disco: string, barra: string): string => `${disco}:${barra}`;
{
  const m = mutata((v) => (v.set(EXTRA, testo(`module.exports = ["${assoluto("C", "\\\\")}a", "${assoluto("D", "/")}b", "bun:sqlite", "Bun.spawn"];`)), 1));
  mutazione("una voce in più con un percorso assoluto e le stringhe vietate", m.toccate, motiviDelleVoci(m.voci), [`voce in più: ${EXTRA}`, `${EXTRA}: ${assoluto("C", "\\")}`, `${EXTRA}: bun:`, `${EXTRA}: Bun.`]);
}
const troncato = pacchetto.subarray(0, pacchetto.length - 30);
mutazione("un pacchetto troncato", pacchetto.length - troncato.length, motiviDelFile(troncato), ["il pacchetto non si legge: manca la fine dell'indice"]);
prova("mutazione: un percorso assoluto si vede, con la barra e con la rovescia", colpiIn(`x = '${assoluto("D", "/")}a'`).length === 1 && colpiIn(`x = '${assoluto("C", "\\")}a'`).length === 1);
const manifestoDelleIcone = JSON.parse(readFileSync(join(estratto, "extension", "package.json"), "utf8")) as ManifestoDelleIcone;
prova("mutazione: senza l'icona del linguaggio il manifesto non basta", iconaDichiarata(manifestoDelleIcone) && !iconaDichiarata({ ...manifestoDelleIcone, contributes: { languages: [] } }));
prova("mutazione: senza l'icona del pannello il manifesto non basta", !iconaDichiarata({ ...manifestoDelleIcone, icon: undefined }));
prova("mutazione: un'icona solo chiara non basta", !iconaDichiarata({ ...manifestoDelleIcone, contributes: { languages: (manifestoDelleIcone.contributes?.languages ?? []).map((l) => ({ ...l, icon: { light: l.icon?.light } })) } }));
prova("mutazione: un linguaggio in più nell'impostazione si vede", differenze([...offerti, "basic"], linguaggi.map((v) => v.id)).soloA.join() === "basic");
prova("mutazione: un linguaggio del registro tolto dall'impostazione si vede", differenze(offerti.slice(1), linguaggi.map((v) => v.id)).soloB.join() === offerti[0]);
prova("mutazione: il lettore del sistema con una voce in più non torna", differenze(voci.keys(), [...contenuto, "extension/x"]).soloB.join() === "extension/x");

// --- Nell'editor dato.
async function nellEditor(eseguibile: string): Promise<void> {
  if (!existsSync(eseguibile)) fermo(`non c'è ${eseguibile}`);
  const node = Bun.which("node") ?? fermo("node non c'è");
  const libreria = require(join(estratto, "extension", "dist", "libreria.cjs")) as Libreria;

  // Il file del corpus in una cartella con spazi doppi; gli attesi dallo stesso file del nucleo, fuori dall'editor.
  const dove = join(cartella, "cartella  con  spazi");
  mkdirSync(dove);
  const fileAlgo = join(dove, "arrotonda-meta.algo");
  const originale = readFileSync(join(SORGENTI, ...NUCLEO.sorgenti.casi.split("/"), ...`${FILE}.algo`.split("/")));
  writeFileSync(fileAlgo, originale);
  const attesoDi = (linguaggio: string, lingua: "it" | "en"): string => documento(libreria, originale.toString("utf8"), linguaggio, lingua).testo;
  // Il controllo degli attesi: un testo per i due casi di Python, e il rifiuto di Accademico con le sue mancanze.
  console.log(`attesi: ${CASI.map(([l, g]) => `${l} ${g} ${Buffer.byteLength(attesoDi(l, g))} byte`).join(", ")}`);
  if (!attesoDi("accademico", "en").startsWith(testoDelRifiuto({ generato: false, perche: "non-ci-sta", mancanze: [] }, "accademico", "en").trimEnd())) fermo("l'atteso di accademico non è il rifiuto che il caso deve dare");

  const uscita = join(cartella, "esiti.json");
  const dati = join(cartella, "dati  editor");
  console.log(`APRO L'EDITOR: ${eseguibile}, una finestra per pochi secondi, con un profilo temporaneo`);
  const inizio = performance.now();
  const figlio = Bun.spawn([node, join(RADICE, "prove", "lancia.cjs"), eseguibile, join(estratto, "extension"), fileAlgo, uscita, dati, JSON.stringify(CASI)], { cwd: cartella, stdout: "pipe", stderr: "pipe" });
  const [fuori, errori] = await Promise.all([new Response(figlio.stdout).text(), new Response(figlio.stderr).text()]);
  const codiceUscita = await figlio.exited;
  if (codiceUscita !== 0 || !existsSync(uscita)) fermo(`l'editor non ha scritto gli esiti, uscita ${codiceUscita}:\n${fuori.slice(-3000)}\n${errori.slice(-3000)}`);
  console.log(`editor: ${((performance.now() - inizio) / 1000).toFixed(1)} s`);

  type DiUnCaso = { testo: string; fuocoDopoIlComando: string; fuocoNelDocumento: string; invariatoDopoAverDigitato: boolean; sporco: boolean; idLinguaggio: string };
  const e = JSON.parse(readFileSync(uscita, "utf8")) as { casi: Record<string, DiUnCaso>; alterato: string; illeggibile: string; illeggibileIdLinguaggio: string; rimesso: string; controlloDigitazione: boolean; salvatoNonDetto: boolean; nonSalvatoDetto: boolean; nonSalvato: string };
  for (const [linguaggio, lingua] of CASI) {
    const nome = `${linguaggio} ${lingua}`;
    const c = e.casi[nome] ?? fermo(`manca l'esito di ${nome}`);
    const atteso = attesoDi(linguaggio, lingua);
    console.log(`${nome}: ${Buffer.byteLength(c.testo)} byte, sha256 ${impronta(testo(c.testo)).slice(0, 12)}, colore ${c.idLinguaggio}`);
    prova(`${nome}: il documento è identico all'atteso`, c.testo === atteso, `documento:\n${c.testo.slice(0, 300)}\natteso:\n${atteso.slice(0, 300)}`);
    prova(`${nome}: colore`, c.idLinguaggio === documento(libreria, originale.toString("utf8"), linguaggio, lingua).idLinguaggio, c.idLinguaggio);
    prova(`${nome}: dopo il comando il fuoco resta sul file`, c.fuocoDopoIlComando === "file", c.fuocoDopoIlComando);
    prova(`${nome}: digitando col fuoco nel documento non cambia nulla`, c.fuocoNelDocumento === "algo-codice" && c.invariatoDopoAverDigitato && !c.sporco, JSON.stringify(c));
  }
  const [primo, lingua] = CASI[0];
  const atteso = attesoDi(primo, lingua);
  prova("controllo positivo: la stessa digitazione su un documento vero lo cambia", e.controlloDigitazione);
  prova("con modifiche non salvate il codice è quello del file salvato, e il comando lo dice solo in quel caso", e.nonSalvato === atteso && e.nonSalvatoDetto && e.salvatoNonDetto, `${e.salvatoNonDetto}, ${e.nonSalvatoDetto}: ${e.nonSalvato.slice(0, 300)}`);
  prova("un file alterato cambia il documento, e non è più l'atteso", e.alterato !== atteso && e.alterato.includes("3.5"), e.alterato.slice(0, 300));
  prova("un file illeggibile: il documento lo dice, senza il codice di prima", e.illeggibile === documento(libreria, "questo non è un file", primo, lingua).testo && e.illeggibileIdLinguaggio === "plaintext", `${e.illeggibileIdLinguaggio}: ${e.illeggibile.slice(0, 300)}`);
  prova("rimesso il file, il documento torna identico all'atteso", e.rimesso === atteso, e.rimesso.slice(0, 300));
  prova("il file non è rimasto alterato", Buffer.compare(readFileSync(fileAlgo), originale) === 0);
  prova("nessun download dell'editor", !existsSync(join(RADICE, ".vscode-test")) && !existsSync(join(cartella, ".vscode-test")), readdirSync(cartella).join(", "));
}

if (opzioni.editor !== undefined) await nellEditor(opzioni.editor);

const provePreviste = PROVE_SENZA_EDITOR - (opzioni.pacchetto !== undefined ? 1 : 0) + (opzioni.editor !== undefined ? PROVE_DELL_EDITOR : 0);
console.log(`prove: ${fatte}/${provePreviste}, fallite ${fallite.length}${opzioni.editor !== undefined ? "" : "; l'editor non è stato aperto"}`);
const esito = fatte !== provePreviste ? "FERMO" : fallite.length > 0 ? "ROSSO" : "VERDE";
if (opzioni.rapporto !== undefined) {
  mkdirSync(dirname(opzioni.rapporto), { recursive: true });
  writeFileSync(opzioni.rapporto, `${JSON.stringify({ sistema: process.platform, architettura: process.arch, editor: opzioni.editor ?? null, pacchetto: { nome: VSIX.split(/[\\/]/).pop(), byte: pacchetto.length, sha256: impronta(pacchetto) }, fatte, previste: provePreviste, fallite, esito }, null, 2)}\n`);
}
if (esito === "FERMO") {
  console.log(`FERMO: il denominatore non torna: dichiarate ${provePreviste}, eseguite ${fatte}`);
  process.exit(2);
}
console.log(`ESITO: ${esito === "ROSSO" ? "ROSSO" : opzioni.editor !== undefined ? "VERDE" : "VERDE, senza l'editor: il documento nell'editor non è stato provato"}`);
process.exit(fallite.length === 0 ? 0 : 1);

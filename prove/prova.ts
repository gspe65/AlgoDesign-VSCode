// La prova dell'estensione: il pacchetto, la logica e, con `--editor`, l'estensione dentro l'editor indicato.
//
//   bun prove/prova.ts                                   costruisce il pacchetto e lo prova senza aprire nulla
//   bun prove/prova.ts --editor <eseguibile>             lo stesso, poi apre quell'editor per pochi secondi, con un profilo temporaneo
//   opzioni: --pacchetto <file .vsix>  prova quel pacchetto invece di costruirlo (la corsa delle Actions: costruito una volta sola)
//            --rapporto <file>         scrive l'esito in JSON (sistema, impronta del pacchetto, prove, fallite, esito)
//
// L'editor della prova è in inglese: con un profilo nuovo `--locale it` non basta, e nemmeno il pacchetto della lingua copiato fra
// le estensioni (misurato: la lingua la decide `languagepacks.json` del profilo). La pagina in italiano la provano il modello qui
// sotto e l'editor dell'unità.
//
// Atteso: ESITO: VERDE, prove N/N. Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare). Prima: bun run nucleo.
//
// Che cosa NON guarda:
// - che il file del nucleo generi ciò che generano i sorgenti di AlgoDesign su tutto il corpus: è la conformità del nucleo; qui la
//   pagina nell'editor si confronta con ciò che lo STESSO file del pacchetto produce fuori dall'editor (il modello);
// - la scheda della pagina alla riapertura dell'editor: la modalità di prova non conserva le schede (misura a parte, con l'editor
//   vero chiuso dalla X);
// - che un file aperto una volta come testo resti testo: nell'editor vero succede, in modalità di prova no (misurato: il
//   controllo positivo non si accende), quindi la prova sta nella misura con l'editor vero, non qui;
// - l'aspetto della pagina (colori dei comandi, spaziature, contrasto) e ciò che la lettura dello schermo pronuncia davvero (qui
//   solo i nomi scritti nel DOM): il giro col valutatore;
// - il disegno con la misura VERA confrontato coi byte del nucleo: dipende dai caratteri della macchina; si confronta con la misura
//   fissa della conformità, e della misura vera si prova che il canvas tiene il carattere chiesto;
// - i gesti del puntatore sul divisore (il trascinamento): si provano i tasti, che passano dallo stesso codice del valore;
// - l'ordine del tabulatore fra due bollini della stessa funzione su un file vero (nel corpus nessuna funzione ne ha due);
// - la condizione del comando «Apri come testo» nella palette: si usa il pulsante della pagina;
// - un editor diverso da quello dato con `--editor`; il primo piano del sistema.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { linguaggiOfferti, modello, testiDellInterfaccia, type Libreria, type Modello } from "../src/documento";
import type { Fotografia } from "../src/messaggi";
import { differenze, esegui, fermo, FILE_DEL_NUCLEO, impronta, IMPRONTA_DEL_NUCLEO, LICENZA_DEL_NUCLEO, NUCLEO, RADICE, SORGENTI, vociDelloZip } from "../strumenti/comune";

const { values: opzioni } = parseArgs({
  args: Bun.argv.slice(2),
  options: { editor: { type: "string" }, pacchetto: { type: "string" }, rapporto: { type: "string" } },
  strict: true,
});

/** I denominatori, dichiarati prima della corsa: le chiamate a `prova` senza editor, e quelle in più con l'editor. */
const PROVE_SENZA_EDITOR = 25;
const PROVE_DELL_EDITOR = 36;
const TEST_ATTESI = 29;

/** Ciò che il pacchetto contiene, e nient'altro. */
const NEL_PACCHETTO = ["[Content_Types].xml", "extension.vsixmanifest", "extension/LICENSE.txt", "extension/LICENZA-ALGODESIGN.txt", "extension/dist/extension.cjs", "extension/dist/libreria.cjs", "extension/dist/pagina.js", "extension/dist/pagina.css", "extension/icona.png", "extension/package.json", "extension/readme.md"];
/** Le voci che sono file del repository così come sono: si confrontano byte per byte con quei file. Il README vsce lo mette
 *  sempre, anche se .vscodeignore esclude tutto: l'editor lo mostra nei dettagli dell'estensione. */
const DAL_REPOSITORY: Record<string, string> = { "extension/package.json": "package.json", "extension/LICENSE.txt": "LICENSE", "extension/LICENZA-ALGODESIGN.txt": "LICENZA-ALGODESIGN.txt", "extension/icona.png": "icona.png", "extension/readme.md": "README.md", "extension/dist/pagina.css": "src/web/pagina.css" };
/** Gli import dell'estensione: il nucleo, l'editor e tre moduli di Node dell'host delle estensioni (il nonce della pagina, il
 *  file del tema, i percorsi del tema). */
const IMPORT_ATTESI = ["./libreria.cjs", "node:crypto", "node:fs", "node:path", "vscode"];
/** La pagina è un modulo per il browser con tutto dentro: nessun import. */
const IMPORT_DELLA_PAGINA: string[] = [];
const PERCORSO_ASSOLUTO = /(?<![A-Za-z])[A-Za-z]:[\\/]/;
/** Stringhe che nel pacchetto non devono esserci: il motore con cui si costruisce e si prova. */
const VIETATE = [/bun:/, /Bun\./];

/** I due file veri del corpus di AlgoDesign degli scenari S-E3: uno che genera, uno che non genera (una segnalazione). */
const FILE = "tappa-1/lettura-intero";
const ERRATO = "tappa-2/per-passo-zero";
/** Un file vero con più funzioni (S-E11: una scheda per funzione). */
const FUNZIONI = "tappa-3/copia-di-un-vettore";

if (!existsSync(FILE_DEL_NUCLEO) || !existsSync(join(SORGENTI, ".git"))) fermo("manca il nucleo: prima bun run nucleo");
if (impronta(readFileSync(FILE_DEL_NUCLEO)) !== IMPRONTA_DEL_NUCLEO) fermo("il file del nucleo non ha l'impronta di nucleo.json: si rifà bun run nucleo");

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
for (const [nome, conf] of [["l'estensione", "tsconfig.json"], ["la pagina", join("src", "web", "tsconfig.json")], ["le prove e gli strumenti", join("prove", "tsconfig.json")]] as const) {
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
  if (libreria !== undefined && impronta(libreria) !== IMPRONTA_DEL_NUCLEO) motivi.push(`extension/dist/libreria.cjs: non è il file del nucleo (${impronta(libreria).slice(0, 12)})`);
  const licenza = voci.get("extension/LICENZA-ALGODESIGN.txt");
  if (licenza !== undefined && impronta(licenza) !== impronta(licenzaDelNucleo)) motivi.push("extension/LICENZA-ALGODESIGN.txt: non è la licenza dello zip del nucleo");
  const icona = voci.get("extension/icona.png");
  if (icona !== undefined && impronta(icona) !== impronta(iconaDelNucleo)) motivi.push("extension/icona.png: non è l'icona di AlgoDesign al commit");
  const codice = voci.get("extension/dist/extension.cjs");
  if (codice !== undefined && importDi(new TextDecoder().decode(codice)).join() !== IMPORT_ATTESI.join()) motivi.push(`extension/dist/extension.cjs: importa ${importDi(new TextDecoder().decode(codice)).join(", ")}`);
  const paginaJs = voci.get("extension/dist/pagina.js");
  if (paginaJs !== undefined && importDi(new TextDecoder().decode(paginaJs)).join() !== IMPORT_DELLA_PAGINA.join()) motivi.push(`extension/dist/pagina.js: importa ${importDi(new TextDecoder().decode(paginaJs)).join(", ")}`);
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

// Il manifesto della pagina: l'editor personalizzato predefinito per i .algo, e una sola impostazione, la pseudocodifica
// spenta di partenza; nessuna impostazione del linguaggio o della lingua (la scelta sta sulla pagina).
type ManifestoDellaPagina = { contributes?: { customEditors?: { viewType: string; selector: { filenamePattern: string }[]; priority?: string }[]; configuration?: { properties?: Record<string, { type?: string; default?: unknown }> } } };
function motiviDelManifesto(m: ManifestoDellaPagina): string[] {
  const motivi: string[] = [];
  const pagine = m.contributes?.customEditors ?? [];
  const p = pagine.find((e) => e.viewType === "algo.pagina");
  if (pagine.length !== 1 || p === undefined) motivi.push(`editor personalizzati: ${pagine.map((e) => e.viewType).join(", ") || "nessuno"}`);
  else {
    if (p.selector.map((s) => s.filenamePattern).join() !== "*.algo") motivi.push(`la pagina vale per ${p.selector.map((s) => s.filenamePattern).join(", ")}`);
    if ((p.priority ?? "default") !== "default") motivi.push(`la pagina non è l'editor predefinito: ${p.priority}`);
  }
  const impostazioni = m.contributes?.configuration?.properties ?? {};
  const nomi = Object.keys(impostazioni).sort();
  if (nomi.join() !== "algo.pseudocodifica") motivi.push(`impostazioni: ${nomi.join(", ")}`);
  const ps = impostazioni["algo.pseudocodifica"];
  if (ps !== undefined && (ps.type !== "boolean" || ps.default !== false)) motivi.push(`algo.pseudocodifica: ${ps.type}, predefinito ${String(ps.default)}`);
  return motivi;
}
const manifestoDellaPagina = JSON.parse(readFileSync(join(estratto, "extension", "package.json"), "utf8")) as ManifestoDellaPagina;
const motiviManifesto = motiviDelManifesto(manifestoDellaPagina);
prova("il manifesto: la pagina predefinita per i .algo, la sola impostazione della pseudocodifica, spenta", motiviManifesto.length === 0, motiviManifesto.join("; "));
const { linguaggi } = (await import(join(SORGENTI, "app", "core", "genera", "linguaggi.ts"))) as { linguaggi: { id: string }[] };
const fuoriRegistro = differenze(linguaggiOfferti(true), linguaggi.map((v) => v.id)).soloA;
console.log(`linguaggi offerti: ${linguaggiOfferti(false).join(", ")} (con la pseudocodifica: ${linguaggiOfferti(true).join(", ")}); nel registro del nucleo ${linguaggi.length}; fuori registro ${fuoriRegistro.length}`);
prova("i linguaggi della pagina sono voci del registro del nucleo", fuoriRegistro.length === 0, fuoriRegistro.join(", "));

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
  mutazione("un import in più", m.toccate, motiviDelleVoci(m.voci), ["extension/dist/extension.cjs: importa ./libreria.cjs, altro, node:crypto, node:fs, node:path, vscode"]);
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
prova("mutazione: un linguaggio fuori registro si vede", differenze([...linguaggiOfferti(true), "basic"], linguaggi.map((v) => v.id)).soloA.join() === "basic");
{
  const conf = manifestoDellaPagina.contributes?.configuration?.properties ?? {};
  const conLinguaggio = { contributes: { ...manifestoDellaPagina.contributes, configuration: { properties: { ...conf, "algo.linguaggio": { type: "string" } } } } };
  const accesa = { contributes: { ...manifestoDellaPagina.contributes, configuration: { properties: { ...conf, "algo.pseudocodifica": { type: "boolean", default: true } } } } };
  const facoltativa = { contributes: { ...manifestoDellaPagina.contributes, customEditors: (manifestoDellaPagina.contributes?.customEditors ?? []).map((e) => ({ ...e, priority: "option" })) } };
  prova(
    "mutazione: un'impostazione del linguaggio, la pseudocodifica accesa, la pagina facoltativa si vedono, ciascuna col suo motivo",
    motiviDelManifesto(conLinguaggio).join() === "impostazioni: algo.linguaggio, algo.pseudocodifica" && motiviDelManifesto(accesa).join() === "algo.pseudocodifica: boolean, predefinito true" && motiviDelManifesto(facoltativa).join() === "la pagina non è l'editor predefinito: option",
    `${motiviDelManifesto(conLinguaggio).join("; ")} | ${motiviDelManifesto(accesa).join("; ")} | ${motiviDelManifesto(facoltativa).join("; ")}`,
  );
}
prova("mutazione: il lettore del sistema con una voce in più non torna", differenze(voci.keys(), [...contenuto, "extension/x"]).soloB.join() === "extension/x");

// --- Nell'editor dato.
async function nellEditor(eseguibile: string): Promise<void> {
  if (!existsSync(eseguibile)) fermo(`non c'è ${eseguibile}`);
  const node = Bun.which("node") ?? fermo("node non c'è");
  const libreria = require(join(estratto, "extension", "dist", "libreria.cjs")) as Libreria;

  // I due file del corpus in una cartella con spazi doppi; gli attesi dal modello, con lo stesso file del nucleo, fuori dall'editor.
  // Sul percorso reale (su macOS /var è un collegamento a /private/var, e «Problemi» si cerca per indirizzo); il profilo
  // dell'editor no: il percorso più lungo supera la lunghezza del socket (misurato con l'estensione per il C).
  const dove = join(realpathSync(cartella), "cartella  con  spazi");
  mkdirSync(dove);
  const casi = join(SORGENTI, ...NUCLEO.sorgenti.casi.split("/"));
  const fileAlgo = join(dove, "lettura-intero.algo");
  const fileErrato = join(dove, "per-passo-zero.algo");
  const originale = readFileSync(join(casi, ...`${FILE}.algo`.split("/")));
  const originaleErrato = readFileSync(join(casi, ...`${ERRATO}.algo`.split("/")));
  const fileFunzioni = join(dove, "copia-di-un-vettore.algo");
  const originaleFunzioni = readFileSync(join(casi, ...`${FUNZIONI}.algo`.split("/")));
  writeFileSync(fileAlgo, originale);
  writeFileSync(fileErrato, originaleErrato);
  writeFileSync(fileFunzioni, originaleFunzioni);

  const uscita = join(cartella, "esiti.json");
  const dati = join(cartella, "dati  editor");
  console.log(`APRO L'EDITOR: ${eseguibile}, una finestra per pochi secondi, con un profilo temporaneo`);
  const inizio = performance.now();
  const ambiente = JSON.stringify({ ALGO_FILE: fileAlgo, ALGO_ERRATO: fileErrato, ALGO_FUNZIONI: fileFunzioni, ALGO_USCITA: uscita });
  const figlio = Bun.spawn([node, join(RADICE, "prove", "lancia.cjs"), eseguibile, join(estratto, "extension"), dove, dati, ambiente], { cwd: cartella, stdout: "pipe", stderr: "pipe" });
  const [fuori, errori] = await Promise.all([new Response(figlio.stdout).text(), new Response(figlio.stderr).text()]);
  const codiceUscita = await figlio.exited;
  if (codiceUscita !== 0 || !existsSync(uscita)) fermo(`l'editor non ha scritto gli esiti, uscita ${codiceUscita}:\n${fuori.slice(-3000)}\n${errori.slice(-3000)}`);
  console.log(`editor: ${((performance.now() - inizio) / 1000).toFixed(1)} s`);

  type Attesa = { f: Fotografia | null; ms: number; riuscita: boolean };
  const e = JSON.parse(readFileSync(uscita, "utf8")) as {
    lingua: string;
    prima: Fotografia | null;
    vista: { tipo: string; viewType?: string };
    colori: { colori: Record<string, string>; fonte: string; dalTema: string[] };
    python: Fotografia | null;
    inglese: Fotografia | null;
    erratoPrima: Fotografia | null;
    errato: Fotografia | null;
    problemiErrato: { messaggio: string; gravita: number }[];
    dopoIlClic: Fotografia | null;
    digitazioneSullaPagina?: string;
    dopoLaDigitazione: Fotografia | null;
    erratoIntatto: boolean;
    sporchiDopoLaDigitazione: string[];
    comeTesto: { tipo: string };
    schemaDelTesto: string | null;
    testoAperto: string | null;
    idLinguaggioDelTesto: string | null;
    vistaInvariata: boolean;
    controlloDigitazione: boolean;
    riaperto: Fotografia | null;
    problemiFile: number;
    alteratoDiverso: boolean;
    aggiornamento: Attesa;
    senzaOsservatore: Attesa;
    rimesso: Fotografia | null;
    fileIntatto: boolean;
    e11: {
      errato: Fotografia | null;
      dalBollino: Fotografia | null;
      dalBollinoConInvio: Fotografia | null;
      dallaVoce: Fotografia | null;
      chiuso: Fotografia | null;
      riapertoDallaVoce: Fotografia | null;
      divisore: Fotografia | null;
      fissaErrato: Fotografia | null;
      carattereIgnorato: Fotografia | null;
      carattereRimesso: Fotografia | null;
      funzioni: Fotografia | null;
      fisse: { lingua: "it" | "en"; funzione: string; svg: string | null; attiva: string | null }[];
      primaDelloZoom: Fotografia | null;
      zoom: { comando: string; scala?: number; adattata?: boolean; sta?: boolean; nomi?: { nome: string; testo: string }[] }[];
      divisoreFunzioni: Fotografia | null;
      erratoRiaperto: Fotografia | null;
      funzioniRiaperto: Fotografia | null;
      nucleoMutato: Fotografia | null;
      nucleoRimesso: Fotografia | null;
      nucleoIntatto: boolean;
    };
  };
  // L'interfaccia nella lingua dell'editor (partito con --locale it): gli attesi la seguono.
  const interfaccia = e.lingua.toLowerCase().startsWith("it") ? "it" : "en";
  const testi = testiDellInterfaccia(interfaccia);
  const atteso = (t: Buffer | string, linguaggio: string, lingua: "it" | "en"): Modello => modello(libreria, t.toString(), linguaggio, lingua, interfaccia);
  const codiceDi = (m: Modello) => ("assente" in m.codice ? null : m.codice.testo.replace(/\n$/, ""));
  const scelte = (f: Fotografia | null) => `${f?.linguaggi.filter((x) => x.attivo).map((x) => x.nome).join()} ${f?.lingue.filter((x) => x.attivo).map((x) => x.nome).join()}`;
  console.log(`interfaccia ${e.lingua}; colori: ${e.colori.fonte}, dal tema ${e.colori.dalTema.join(", ")}`);

  const m0 = atteso(originale, "c", "it");
  const p = e.prima;
  prova("doppio clic: si apre la pagina del flowchart, col nome del flowchart", e.vista.tipo === "pagina" && e.vista.viewType === "algo.pagina" && p?.titolo === m0.titolo, JSON.stringify(e.vista));
  prova("la prima volta C in italiano; le scelte sono esattamente Python e C, italiano e inglese", scelte(p) === `${testi.linguaggi["c"]} ${testi.lingue.it}` && p?.linguaggi.map((x) => x.nome).join() === linguaggiOfferti(false).map((l) => testi.linguaggi[l]).join() && p?.lingue.map((x) => x.nome).join() === `${testi.lingue.it},${testi.lingue.en}`, JSON.stringify([p?.linguaggi, p?.lingue]));
  prova("il codice C sulla pagina è quello del nucleo", p?.codice === codiceDi(m0), `${p?.codice?.slice(0, 200)}`);
  prova("il codice si apre sulla riga di main", "rigaDiMain" in m0.codice && p?.rigaInCima === m0.codice.rigaDiMain, `in cima ${p?.rigaInCima}, main ${"rigaDiMain" in m0.codice ? m0.codice.rigaDiMain : "-"}`);
  const rgb = (h: string) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
  const coloriDiversi = Object.entries(p?.colori ?? {}).filter(([s, c]) => c !== null && c !== rgb(e.colori.colori[s] ?? "")).map(([s, c]) => `${s} ${c} invece di ${e.colori.colori[s]}`);
  const coloriVisti = Object.values(p?.colori ?? {}).filter((c) => c !== null).length;
  console.log(`colori sulla pagina: ${coloriVisti} specie viste nel codice, diverse dal tema ${coloriDiversi.length}`);
  prova("i colori del codice sono quelli del tema in uso, letto dal suo file", e.colori.fonte.startsWith("tema ") && e.colori.dalTema.length >= 4 && coloriVisti >= 4 && coloriDiversi.length === 0, `${e.colori.fonte}; ${coloriDiversi.join("; ")}`);
  prova("S-E3a: «Python» → il codice Python, in un passo", scelte(e.python) === `Python ${testi.lingue.it}` && e.python?.codice === codiceDi(atteso(originale, "python", "it")), scelte(e.python));
  prova("S-E3a: «inglese» → il codice Python in inglese, in un passo", scelte(e.inglese) === `Python ${testi.lingue.en}` && e.inglese?.codice === codiceDi(atteso(originale, "python", "en")), scelte(e.inglese));
  prova("RU-02: un flowchart mai aperto prende l'ultima scelta", scelte(e.erratoPrima) === `Python ${testi.lingue.en}`, scelte(e.erratoPrima));
  prova("RU-02: riaperto, il primo flowchart torna con la sua scelta, non con quella dell'altro", scelte(e.riaperto) === `Python ${testi.lingue.en}` && scelte(e.errato) === `C ${testi.lingue.it}`, `${scelte(e.riaperto)} / ${scelte(e.errato)}`);

  const mErr = atteso(originaleErrato, "c", "it");
  const voceAttesa = mErr.segnalazioni.map((s) => `${s.genere === "errore" ? "!" : "?"}\n${s.testo}\n${s.spiegazione}`);
  // `innerText` separa i paragrafi con una riga vuota (il margine del paragrafo): si confronta il testo, non l'impaginazione.
  const vociViste = (e.errato?.voci ?? []).map((v) => v.replace(/\r/g, "").replace(/\n{2,}/g, "\n").trim());
  prova("S-E3c: la segnalazione sulla pagina è intera, col segno, nella forma di AlgoDesign", vociViste.length === 1 && vociViste.join() === voceAttesa.join(), `${JSON.stringify(vociViste)} / ${JSON.stringify(voceAttesa)}`);
  prova("S-E3c: al posto del codice il rimando alle segnalazioni", e.errato?.codice === null && "assente" in mErr.codice && e.errato?.assente === mErr.codice.assente, `${e.errato?.assente}`);
  const interniSulloSchermo = (testo: string) => (testo.match(/\b(b\d+|f\d+|invalid_step|E\d{3})\b/g) ?? []);
  prova("S-E3c: nessun id interno sullo schermo (b1, f1, invalid_step, il numero del codice)", interniSulloSchermo(e.errato?.testoVisibile ?? "b1").length === 0, interniSulloSchermo(e.errato?.testoVisibile ?? "").join(", "));
  prova("controllo positivo: un b1 e un invalid_step nel testo visibile si vedono", interniSulloSchermo(`${e.errato?.testoVisibile ?? ""} b1 invalid_step`).join() === "b1,invalid_step");
  const segnalatoAtteso = testi.bloccoSegnalato.replace("{dove}", mErr.segnalazioni[0]?.dove ?? "?");
  const bloccoAtteso = mErr.segnalazioni[0]?.blocco ?? "?";
  prova("S-E3c: il clic sulla segnalazione porta alla scheda della sua funzione e al disegno, col blocco segnalato evidenziato e in vista, e lo annuncia", e.dopoIlClic?.fuoco === "disegno" && e.dopoIlClic.funzioni.filter((f) => f.attiva).map((f) => f.nome).join() === testi.principale && e.dopoIlClic.disegno.evidenziato === bloccoAtteso && e.dopoIlClic.disegno.evidenziatoInVista && e.dopoIlClic.testoVisibile.includes(segnalatoAtteso) && e.errato?.disegno.evidenziato === null && !(e.errato?.testoVisibile ?? segnalatoAtteso).includes(segnalatoAtteso), JSON.stringify([e.dopoIlClic?.fuoco, e.dopoIlClic?.funzioni, e.dopoIlClic?.disegno.evidenziato, e.dopoIlClic?.disegno.evidenziatoInVista, segnalatoAtteso]));
  prova("«Problemi»: la segnalazione intera, come errore; nessuna voce per il file che genera", e.problemiErrato.length === 1 && e.problemiErrato[0]?.messaggio === `${mErr.segnalazioni[0]?.testo} ${mErr.segnalazioni[0]?.spiegazione}` && e.problemiErrato[0]?.gravita === 0 && e.problemiFile === 0, JSON.stringify(e.problemiErrato));

  /** Dove due testi cominciano a essere diversi, coi due pezzi da lì. */
  const divergenza = (a = "", b = "") => {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return i === a.length && i === b.length ? "uguali" : `dal carattere ${i}: «${a.slice(Math.max(0, i - 20), i + 40)}» / «${b.slice(Math.max(0, i - 20), i + 40)}»`;
  };
  prova("S-E3d: sulla pagina nessun elemento modificabile; digitando non cambia nulla, nemmeno il file", e.dopoLaDigitazione?.editabili === 0 && e.dopoLaDigitazione.testoVisibile === e.dopoIlClic?.testoVisibile && e.erratoIntatto && e.sporchiDopoLaDigitazione.length === 0, JSON.stringify({ editabili: e.dopoLaDigitazione?.editabili, sporchi: e.sporchiDopoLaDigitazione, errore: e.digitazioneSullaPagina, testo: divergenza(e.dopoIlClic?.testoVisibile, e.dopoLaDigitazione?.testoVisibile) }));
  prova("S-E3d: «Apri come testo» apre il JSON del file in una vista di sola lettura, che digitando non cambia", e.comeTesto.tipo === "testo" && e.schemaDelTesto === "algo-testo" && e.idLinguaggioDelTesto === "json" && e.testoAperto === originaleErrato.toString("utf8") && e.vistaInvariata, `${e.comeTesto.tipo} ${e.schemaDelTesto} ${e.idLinguaggioDelTesto} invariata ${e.vistaInvariata}`);
  prova("controllo positivo: la stessa digitazione su un documento vero lo cambia", e.controlloDigitazione);

  const mAlt = atteso(originale.toString("utf8").replace('"name": "lettura-intero"', '"name": "lettura-intera"'), "python", "en");
  console.log(`aggiornamento dal disco: ${e.aggiornamento.ms} ms (riuscito ${e.aggiornamento.riuscita}); senza osservatore: aggiornato ${e.senzaOsservatore.riuscita} in ${e.senzaOsservatore.ms} ms`);
  prova("S-E3b: dopo il salvataggio di AlgoDesign la pagina è quella nuova entro 1 s, letta dal disco", e.alteratoDiverso && e.aggiornamento.riuscita && e.aggiornamento.ms <= 1000 && e.aggiornamento.f?.codice === codiceDi(mAlt), `${e.aggiornamento.ms} ms, ${e.aggiornamento.f?.titolo}`);
  prova("controllo positivo: con l'osservatore spento lo stesso salvataggio non arriva alla pagina", !e.senzaOsservatore.riuscita && e.senzaOsservatore.f?.titolo === "lettura-intera", `${e.senzaOsservatore.f?.titolo}`);
  prova("riacceso l'osservatore e rimesso il file, la pagina torna quella di prima", e.rimesso?.titolo === m0.titolo && e.fileIntatto);
  prova("i file non sono rimasti alterati", Buffer.compare(readFileSync(fileAlgo), originale) === 0 && Buffer.compare(readFileSync(fileErrato), originaleErrato) === 0);
  prova("nessun download dell'editor", !existsSync(join(RADICE, ".vscode-test")) && !existsSync(join(cartella, ".vscode-test")), readdirSync(cartella).join(", "));

  // --- S-E11, il disegno nella pagina.
  const k = e.e11;
  const d0 = k.errato?.disegno;
  const integrita = `sha256-${Buffer.from(IMPRONTA_DEL_NUCLEO, "hex").toString("base64")}`;
  console.log(`E11: nucleo ${d0?.nucleo}, integrità ${d0?.integrita.slice(0, 20)}…; carattere ${JSON.stringify(d0?.carattere)}; disegno ${d0?.larghezza}×${d0?.altezza} scala ${d0?.scala}; bollini ${d0?.bollini.length}`);
  prova("E11: la pagina esegue il file del nucleo con l'impronta dichiarata in nucleo.json", d0?.nucleo === "caricato" && d0.integrita === integrita, `${d0?.nucleo} ${d0?.integrita} / ${integrita}`);
  const nm = k.nucleoMutato?.disegno;
  prova("controllo positivo: un byte in più nel file del nucleo, la pagina non lo esegue e lo dice; rimesso il file, sì", nm?.nucleo === "assente" && nm.frase === testi.nucleoAssente && nm.svg === null && k.nucleoRimesso?.disegno.nucleo === "caricato" && k.nucleoRimesso.disegno.svg !== null && k.nucleoIntatto, JSON.stringify([nm?.nucleo, nm?.frase, k.nucleoRimesso?.disegno.nucleo, k.nucleoIntatto]));
  const chiesto = "15px system-ui, sans-serif";
  prova("E11: la misura col canvas, dopo i caratteri pronti: il carattere riletto è quello chiesto", d0?.carattere?.chiesto === chiesto && d0.carattere.riletto === chiesto && d0.svg !== null && k.carattereRimesso?.disegno.carattere?.riletto === chiesto, JSON.stringify(d0?.carattere));
  const ci = k.carattereIgnorato?.disegno;
  prova("controllo positivo: un carattere che il canvas ignora non disegna, e la pagina lo dice", ci?.svg === null && ci.frase === testi.carattereIgnorato.replace("{carattere}", '"non chiuso') && ci.carattere !== null && ci.carattere.riletto !== ci.carattere.chiesto && k.carattereRimesso?.disegno.svg !== null, JSON.stringify([ci?.frase, ci?.carattere]));

  // Con la misura fissa l'SVG della pagina contro quello del file del nucleo fuori dall'editor: ogni funzione, nelle due lingue.
  const nucleoFuori = libreria as unknown as Libreria & { controlla(p: unknown): unknown; disegna(p: unknown, f: string, l: "it" | "en", m: (t: string, s?: string) => number, c: string, o: unknown): { svg: string } };
  const fissa = (t: string, stile?: string) => t.length * 7 + (stile === "grassetto" ? t.length : stile === "corsivo" ? t.length / 2 : 0);
  const svgAtteso = (testo: Buffer, funzione: string, lingua: "it" | "en") => {
    const a = nucleoFuori.apri(testo.toString("utf8"));
    if (!a.ok) return "non si apre";
    return nucleoFuori.disegna(a.progetto, funzione, lingua, fissa, "system-ui, sans-serif", { errori: nucleoFuori.controlla(a.progetto) }).svg;
  };
  const aFunzioni = nucleoFuori.apri(originaleFunzioni.toString("utf8"));
  const funzioniAttese = aFunzioni.ok ? aFunzioni.progetto.functions.map((f) => f.id) : [];
  const diverse = k.fisse.filter((x) => x.svg !== svgAtteso(originaleFunzioni, x.funzione, x.lingua)).map((x) => `${x.funzione} ${x.lingua}`);
  if (k.fissaErrato?.disegno.svg !== svgAtteso(originaleErrato, "f1", "it")) diverse.push("per-passo-zero f1 it");
  const schedeViste = [...new Set(k.fisse.map((x) => x.funzione))];
  console.log(`S-E11: ${k.fisse.length + 1} disegni con la misura fissa (funzioni ${schedeViste.join(", ")}, attese ${funzioniAttese.join(", ")}), diversi ${diverse.length}`);
  // Il confronto sa dire «diverso»: lo stesso disegno nelle due lingue non è uguale.
  const distingue = svgAtteso(originaleFunzioni, "f1", "it") !== svgAtteso(originaleFunzioni, "f1", "en");
  prova("S-E11: con la misura fissa l'SVG della pagina è byte per byte quello del nucleo, per ogni scheda nelle due lingue", distingue && diverse.length === 0 && funzioniAttese.length >= 2 && schedeViste.join() === funzioniAttese.join() && k.fisse.length === funzioniAttese.length * 2, `distingue ${distingue}; diversi: ${diverse.join("; ")}; schede ${schedeViste.join()}`);

  const vErr = mErr.segnalazioni[0];
  const etichettaAttesa = testi.disegnoDi.replace("{funzione}", testi.principale).replace("{conteggio}", testi.errori1);
  prova("E11: il bollino appaiato alla segnalazione, col suo testo per la lettura dello schermo; il disegno col suo nome", JSON.stringify(d0?.bollini) === JSON.stringify([{ id: bloccoAtteso, segno: "errore", codici: vErr?.numero ?? "?", etichetta: vErr?.testo ?? "?" }]) && d0?.appaiamento.length === 0 && d0.etichetta === etichettaAttesa, `${JSON.stringify(d0?.bollini)} ${JSON.stringify(d0?.appaiamento)} «${d0?.etichetta}» / «${etichettaAttesa}»`);
  prova("S-E11: dal bollino alla sua segnalazione, col clic e con Invio", k.dalBollino?.fuoco === "voce-0" && k.dalBollinoConInvio?.fuoco === "voce-0", `${k.dalBollino?.fuoco} ${k.dalBollinoConInvio?.fuoco}`);
  const ch = k.chiuso;
  prova("il riquadro si chiude: niente disegno né divisore, le segnalazioni sopra il codice, il comando dice «Mostra il flowchart»", ch?.disegno.chiuso === true && !ch.disegno.divisoreVisibile && ch.voci.length === 1 && ch.testoVisibile.includes(testi.mostra) && !ch.testoVisibile.includes(testi.nascondi) && ch.testoVisibile.indexOf(testi.segnalazioni) < ch.testoVisibile.indexOf(ch.assente ?? "?"), JSON.stringify([ch?.disegno.chiuso, ch?.disegno.divisoreVisibile, ch?.voci.length]));
  prova("il clic su una segnalazione col riquadro chiuso lo riapre, sul blocco evidenziato", k.riapertoDallaVoce?.disegno.chiuso === false && k.riapertoDallaVoce.disegno.evidenziato === bloccoAtteso && k.riapertoDallaVoce.disegno.evidenziatoInVista, JSON.stringify([k.riapertoDallaVoce?.disegno.chiuso, k.riapertoDallaVoce?.disegno.evidenziato]));
  prova("il divisore con la tastiera: un passo a destra è il 55%", k.divisore?.disegno.divisore === 55 && k.divisore.disegno.divisoreVisibile, `${k.divisore?.disegno.divisore}`);
  const fz = k.funzioni?.disegno;
  const pct = Math.round((fz?.scala ?? 0) * 100);
  const nomiDelloZoom = [testi.zoomRiduci, `${pct}%, ${testi.zoomCento}`, testi.zoomIngrandisci, testi.zoomAdatta];
  const dv = k.dallaVoce?.disegno;
  prova("un flowchart mai aperto: adattato, mai oltre il 100%, e ci sta anche dopo il clic su una segnalazione; il divisore dell'ultimo; i quattro comandi dello zoom col loro nome", fz?.adattata === true && fz.scala <= 1 && fz.staNelFoglio && d0?.staNelFoglio === true && dv?.adattata === true && dv.staNelFoglio && fz.divisore === 55 && JSON.stringify(fz.zoom.map((z) => z.nome)) === JSON.stringify(nomiDelloZoom), JSON.stringify([fz?.adattata, fz?.scala, fz?.staNelFoglio, d0?.staNelFoglio, dv?.staNelFoglio, fz?.divisore, fz?.zoom]));
  const s0 = k.primaDelloZoom?.disegno.scala ?? 0;
  const z = k.zoom;
  const vicino = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 1e-9;
  const zoomGiusto = z.length === 5 && vicino(z[0]?.scala, Math.min(s0 * 1.25, 4)) && z[0]?.adattata === false && vicino(z[1]?.scala, 1) && vicino(z[2]?.scala, 0.8) && z[3]?.adattata === true && z[3]?.nomi?.[3]?.testo === testi.zoomTornaIndietro && vicino(z[4]?.scala, 0.8) && z[4]?.adattata === false && z[4]?.nomi?.[3]?.testo === testi.zoomAdatta;
  // Controllo positivo del rilevatore «sta nel foglio»: al 100% il disegno alto 660 pixel non ci sta; adattato sì.
  prova("lo zoom coi passi di AlgoDesign, un clic ciascuno: «Adatta alla finestra» diventa «Torna indietro» e ci torna", zoomGiusto && z[1]?.sta === false && z[3]?.sta === true, JSON.stringify(z.map((x) => [x.comando, x.scala, x.adattata, x.sta, x.nomi?.[3]?.testo])));
  const er = k.erratoRiaperto?.disegno;
  const fr = k.funzioniRiaperto?.disegno;
  prova("riaperti, ciascuno con la sua vista: lo zoom, il divisore", er?.divisore === 55 && er.adattata && vicino(fr?.scala, 0.8) && fr?.adattata === false && fr.divisore === 60 && k.divisoreFunzioni?.disegno.divisore === 60, JSON.stringify([er?.divisore, er?.adattata, fr?.scala, fr?.adattata, fr?.divisore]));
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

// La prova dell'estensione: il pacchetto, la logica e, con `--editor`, l'estensione dentro l'editor indicato.
//
//   bun prove/prova.ts                                   costruisce il pacchetto e lo prova senza aprire nulla
//   bun prove/prova.ts --editor <eseguibile>             lo stesso, poi apre quell'editor per pochi secondi, con un profilo temporaneo
//   opzioni: --pacchetto <file .vsix>  prova quel pacchetto invece di costruirlo (la corsa delle Actions: costruito una volta sola)
//            --rapporto <file>         scrive l'esito in JSON (sistema, impronta del pacchetto, prove, fallite, esito)
//
// L'editor della prova è in inglese: con un profilo nuovo `--locale it` non basta, e nemmeno il pacchetto della lingua copiato fra
// le estensioni (misurato: la lingua la decide `languagepacks.json` del profilo). La pagina in italiano la prova il modello qui
// sotto (le frasi e i nomi dei pulsanti), non l'editor indicato.
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
// - l'aspetto della pagina (spaziature, contrasto; dei colori solo che «Sostituisci» si distingua da «Annulla») e ciò che la
//   lettura dello schermo pronuncia davvero (qui solo i nomi scritti nel DOM): lo guarda una persona, con la pagina aperta;
// - la pagina a una colonna in una finestra stretta davvero: la si ottiene con lo zoom dell'editor, come chi ingrandisce;
// - il disegno con la misura VERA confrontato coi byte del nucleo: dipende dai caratteri della macchina; si confronta con la misura
//   fissa della conformità, e della misura vera si prova che il canvas tiene il carattere chiesto;
// - i gesti del puntatore sul divisore (il trascinamento): si provano i tasti, che passano dallo stesso codice del valore;
// - l'ordine del tabulatore fra due bollini della stessa funzione su un file vero (nel corpus nessuna funzione ne ha due);
// - la condizione del comando «Apri il file come testo» nella palette: si usa il pulsante della pagina;
// - due aggiornamenti in volo che finiscono al contrario, nell'editor: l'ordine si prova senza editor, sulla regola (`ordine.ts`);
// - un editor diverso da quello dato con `--editor`; il primo piano del sistema;
// - la finestra «Salva con nome» vera del sistema: nelle Actions nessuno la preme, e la sostituiscono le risposte preparate
//   (`algo.prova.dialogo`), che dicono anche se e quando la pagina l'ha aperta; la finestra vera la prova chi usa l'estensione
//   nel suo editor, col suo sistema.

import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { linguaggiOfferti, modello, riempi, testiDellInterfaccia, type Libreria, type Modello } from "../src/documento";
import type { Fotografia } from "../src/messaggi";
import { DIMENSIONE_DEL_CARATTERE } from "../src/vista";
import { differenze, esegui, fermo, FILE_DEL_NUCLEO, impronta, IMPRONTA_DEL_NUCLEO, LICENZA_DEL_NUCLEO, motivoDelFermo, motiviDelNucleo, NUCLEO, RADICE, SORGENTI, vociDelloZip } from "../strumenti/comune";
import { VERSIONE } from "../strumenti/versione-vscodium";
import { PREVISTE } from "./conteggio";

const { values: opzioni } = parseArgs({
  args: Bun.argv.slice(2),
  options: { editor: { type: "string" }, pacchetto: { type: "string" }, rapporto: { type: "string" } },
  strict: true,
});

/** I denominatori, dichiarati prima della corsa: le chiamate a `prova` senza editor, e quelle in più con l'editor. */
const PROVE_SENZA_EDITOR = 35;
const PROVE_DELL_EDITOR = 59;
const TEST_ATTESI = 41;
const provePreviste = PROVE_SENZA_EDITOR - (opzioni.pacchetto !== undefined ? 1 : 0) + (opzioni.editor !== undefined ? PROVE_DELL_EDITOR : 0);

let fatte = 0;
const fallite: string[] = [];
/** Il pacchetto provato, per il rapporto (null finché non c'è). */
let pacchettoDelRapporto: string | null = null;
let rapportoScritto = false;
/** Il rapporto della corsa, in JSON: lo legge il conteggio. */
function scriviIlRapporto(esito: string, motivi: string[]): void {
  if (opzioni.rapporto === undefined) return;
  const p = pacchettoDelRapporto !== null && existsSync(pacchettoDelRapporto) ? readFileSync(pacchettoDelRapporto) : null;
  mkdirSync(dirname(opzioni.rapporto), { recursive: true });
  writeFileSync(opzioni.rapporto, `${JSON.stringify({ sistema: process.platform, architettura: process.arch, editor: opzioni.editor ?? null, pacchetto: { nome: pacchettoDelRapporto?.split(/[\\/]/).pop() ?? null, byte: p?.length ?? 0, sha256: p === null ? "" : impronta(p) }, fatte, previste: provePreviste, fallite: motivi, esito }, null, 2)}\n`);
  rapportoScritto = true;
}
// Un fermo a metà (un editor che non parte, un'eccezione) scrive anche lui il rapporto, con esito FERMO e il suo motivo: senza,
// il conteggio vedrebbe solo un rapporto mancante, e il motivo resterebbe nel registro del lavoro.
process.on("exit", (codice) => {
  if (!rapportoScritto && codice !== 0) scriviIlRapporto("FERMO", [...fallite, `FERMO: ${motivoDelFermo ?? `uscita ${codice}`}`]);
});

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
/** Parole del lavoro su questo repository che nel pacchetto non devono esserci (il foglio di stile e il README ci vanno così come
 *  sono). Si compongono qui a pezzi: scritte per intero, questo file (pubblico) le conterrebbe. Tutte come parole intere (una
 *  parola più lunga che le contiene no), senza distinguere le maiuscole, nella stessa forma del controllo di riservatezza del
 *  repository: singolare e plurale, «con» e «col» con uno o più spazi seguiti da chi prova, e la parola accentata anche con
 *  l'apostrofo al posto dell'accento. Due rilevatori della stessa specie contano allo stesso modo: il più stretto lascerebbe
 *  passare nel pacchetto ciò che l'altro segnala nell'albero. */
const parola = (...pezzi: string[]): string => pezzi.join("");
const NON_PAROLA_PRIMA = "(?<![\\p{L}\\p{N}_])";
const NON_PAROLA_DOPO = "(?![\\p{L}\\p{N}_])";
const LESSICO = [
  new RegExp(`${NON_PAROLA_PRIMA}${parola("ril", "iev")}[oi]${NON_PAROLA_DOPO}`, "giu"),
  new RegExp(`${NON_PAROLA_PRIMA}${parola("valut", "ator")}[ei]${NON_PAROLA_DOPO}`, "giu"),
  new RegExp(`${NON_PAROLA_PRIMA}giro\\s+co[ln]\\s+(?:il\\s+|l'|un\\s+|gli\\s+|due\\s+|tre\\s+)?(?:${parola("valut", "ator")}|utent|alunn)`, "giu"),
  new RegExp(`${NON_PAROLA_PRIMA}(?:${parola("My", "Dev")}|${parola("uni", "tà")}|${parola("uni", "ta'")})${NON_PAROLA_DOPO}`, "giu"),
];
/** Le sigle dei criteri e delle segnalazioni del lavoro (una lettera e un numero, o due lettere e un trattino), maiuscole come si
 *  scrivono: nel pacchetto (tranne il file del nucleo, che ha i suoi codici d'errore di tre cifre) e nell'albero tracciato. Si
 *  compongono a pezzi, come il lessico. */
const SIGLE = new RegExp(`\\b(?:${parola("E", "\\d{1,2}")}|${parola("R", "U-\\d+")}|${parola("S-", "E\\d+[a-z]?")}|${parola("[ACP]", "M\\d+")})\\b`, "g");
/** I file tracciati che la ricerca delle sigle non legge, per nome: l'icona (un'immagine) e il file dei pacchetti (impronte in
 *  base64, dove una lettera e due cifre fra due segni sono un caso, non una sigla). */
const SIGLE_NON_LETTE = ["icona.png", "bun.lock"];
/** Colpi noti e attesi: il file del nucleo, di AlgoDesign e confrontato per impronta, nomina due volte gli elementi di codice
 *  UTF-16 in un suo testo, con la quinta parola del lessico. Si tolgono contandoli: un numero diverso è un motivo. */
const NOTI_NEL_NUCLEO = { voce: "extension/dist/libreria.cjs", testo: `${parola("uni", "tà")} UTF-16`, quanti: 2 };

/** I due file veri del corpus di AlgoDesign delle scelte del codice: uno che genera, uno che non genera (una segnalazione). */
const FILE = "tappa-1/lettura-intero";
const ERRATO = "tappa-2/per-passo-zero";
/** Un file vero con più funzioni (una scheda per funzione). */
const FUNZIONI = "tappa-3/copia-di-un-vettore";
/** Un file vero con un avviso e nessun errore (il codice c'è). */
const AVVISO = "tappa-1/divisione-intera-in-reale";

if (!existsSync(FILE_DEL_NUCLEO) || !existsSync(join(SORGENTI, ".git"))) fermo("manca il nucleo: prima bun run nucleo");
if (impronta(readFileSync(FILE_DEL_NUCLEO)) !== IMPRONTA_DEL_NUCLEO) fermo("il file del nucleo non ha l'impronta di nucleo.json: si rifà bun run nucleo");

const cartella = mkdtempSync(join(tmpdir(), "algo  prova-"));
process.on("exit", () => rmSync(cartella, { recursive: true, force: true }));

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
pacchettoDelRapporto = VSIX;
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
/** Le parole del lessico in una voce, ognuna col suo motivo; nel file del nucleo, tolti i colpi noti (contati). */
function lessicoIn(voce: string, testo: string): string[] {
  const motivi: string[] = [];
  let t = testo;
  if (voce === NOTI_NEL_NUCLEO.voce) {
    const n = t.split(NOTI_NEL_NUCLEO.testo).length - 1;
    if (n !== NOTI_NEL_NUCLEO.quanti) motivi.push(`${voce}: «${NOTI_NEL_NUCLEO.testo}» ${n} volte, attese ${NOTI_NEL_NUCLEO.quanti}`);
    t = t.replaceAll(NOTI_NEL_NUCLEO.testo, "");
  }
  for (const rx of LESSICO) for (const m of t.matchAll(rx)) motivi.push(`${voce}: la parola «${m[0]}»`);
  return motivi;
}
/** Le sigle in un testo, ognuna col suo motivo. */
const sigleIn = (voce: string, testo: string): string[] => [...testo.matchAll(SIGLE)].map((m) => `${voce}: la sigla «${m[0]}»`);
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
  for (const [v, d] of voci) if (v !== "extension/icona.png") motivi.push(...lessicoIn(v, new TextDecoder().decode(d)));
  for (const [v, d] of voci) if (v !== "extension/icona.png" && v !== NOTI_NEL_NUCLEO.voce) motivi.push(...sigleIn(v, new TextDecoder().decode(d)));
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
const nelNucleo = voci.get(NOTI_NEL_NUCLEO.voce);
console.log(`lessico: ${LESSICO.length} parole cercate in ${[...voci.keys()].filter((v) => v !== "extension/icona.png").length} voci; colpi noti nel file del nucleo ${nelNucleo === undefined ? "?" : new TextDecoder().decode(nelNucleo).split(NOTI_NEL_NUCLEO.testo).length - 1}, attesi ${NOTI_NEL_NUCLEO.quanti}`);
prova("il pacchetto: le voci attese nei due versi, i file del repository, il file e la licenza del nucleo, l'icona, gli import, il manifesto, nessun percorso assoluto, stringa vietata né parola del lessico", motiviVeri.length === 0, motiviVeri.join("; "));

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
{
  // Le parole del lessico in una voce che non si confronta col repository (la pagina): ciascuna col suo motivo, nelle forme che
  // un rilevatore stretto perde (il plurale con la maiuscola, tutto maiuscolo, «col» con due spazi e chi prova, l'apostrofo al
  // posto dell'accento); una parola più lunga che ne contiene una no, né «giro col» seguito da altro che chi prova.
  const PAGINA = "extension/dist/pagina.js";
  const prese = [parola("Ril", "ievi"), parola("VALUT", "ATORI"), parola("giro  col  l'", "utent"), parola("giro con gli ", "alunn"), parola("My", "Dev"), parola("Uni", "tà"), parola("uni", "ta'")];
  const scritte = [prese[0], prese[1], `${prese[2]}e`, `${prese[3]}i`, prese[4], `nell'${prese[5]}`, `l'${prese[6]}`, parola("comun", "ità"), "un giro col file tolto"];
  const m = mutata((v) => (v.set(PAGINA, Buffer.concat([v.get(PAGINA) ?? new Uint8Array(), Buffer.from(`\n/* ${scritte.join(", ")} */`)])), 1));
  mutazione("le parole del lessico nella pagina", m.toccate, motiviDelleVoci(m.voci), prese.map((p) => `${PAGINA}: la parola «${p}»`));
}
{
  // I colpi noti nel file del nucleo, contati: uno in più, uno in meno, e una parola del lessico fuori dai colpi noti.
  const NUCLEO_VOCE = NOTI_NEL_NUCLEO.voce;
  const vero = new TextDecoder().decode(voci.get(NUCLEO_VOCE) ?? new Uint8Array());
  const unoInPiu = mutata((v) => (v.set(NUCLEO_VOCE, testo(`${vero}\n// ${NOTI_NEL_NUCLEO.testo}`)), 1));
  mutazione("un colpo noto in più nel file del nucleo", unoInPiu.toccate, lessicoIn(NUCLEO_VOCE, new TextDecoder().decode(unoInPiu.voci.get(NUCLEO_VOCE))), [`${NUCLEO_VOCE}: «${NOTI_NEL_NUCLEO.testo}» ${NOTI_NEL_NUCLEO.quanti + 1} volte, attese ${NOTI_NEL_NUCLEO.quanti}`]);
  const unoInMeno = vero.replace(NOTI_NEL_NUCLEO.testo, "UTF-16");
  mutazione("un colpo noto in meno nel file del nucleo", Number(unoInMeno !== vero), lessicoIn(NUCLEO_VOCE, unoInMeno), [`${NUCLEO_VOCE}: «${NOTI_NEL_NUCLEO.testo}» ${NOTI_NEL_NUCLEO.quanti - 1} volte, attese ${NOTI_NEL_NUCLEO.quanti}`]);
  const fuori = `${vero}\n// ${parola("Uni", "tà")} di misura`;
  mutazione("una parola del lessico nel file del nucleo, fuori dai colpi noti", 1, lessicoIn(NUCLEO_VOCE, fuori), [`${NUCLEO_VOCE}: la parola «${parola("Uni", "tà")}»`]);
}
{
  // Le sigle in una voce del pacchetto (non nel file del nucleo, i cui codici d'errore di tre cifre non sono sigle).
  const PAGINA = "extension/dist/pagina.js";
  const sigle = [parola("E", "11"), parola("R", "U-02"), parola("S-E", "1"), parola("S-E", "4b"), parola("A", "M2")];
  const m = mutata((v) => (v.set(PAGINA, Buffer.concat([v.get(PAGINA) ?? new Uint8Array(), Buffer.from(`\n/* ${sigle.join(" ")} E123 UTF-16 */`)])), 1));
  mutazione("le sigle nella pagina", m.toccate, motiviDelleVoci(m.voci), sigle.map((s) => `${PAGINA}: la sigla «${s}»`));
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

// --- Le sigle nell'albero tracciato: ogni file che git conosce, tranne quelli dichiarati per nome.
const tracciati = esegui(["git", "-C", RADICE, "ls-files", "-z"]);
if (tracciati.uscita !== 0) fermo(`git ls-files non riuscito:\n${tracciati.testo}`);
const fileTracciati = tracciati.testo.split("\0").filter((f) => f !== "");
const lettiPerLeSigle = fileTracciati.filter((f) => !SIGLE_NON_LETTE.includes(f));
const sigleNellAlbero = lettiPerLeSigle.flatMap((f) => sigleIn(f, readFileSync(join(RADICE, f), "utf8")));
const nonLetteMancanti = SIGLE_NON_LETTE.filter((f) => !fileTracciati.includes(f));
console.log(`sigle nell'albero: ${fileTracciati.length} file tracciati, letti ${lettiPerLeSigle.length}, non letti per nome ${SIGLE_NON_LETTE.length} [${SIGLE_NON_LETTE.join(", ")}]; sigle ${sigleNellAlbero.length}`);
const conSigla = sigleIn("x", `/* ${parola("S-E", "2")} */`);
prova("nessuna sigla nell'albero tracciato; mutazione: una sigla in un commento si vede", lettiPerLeSigle.length > 20 && nonLetteMancanti.length === 0 && sigleNellAlbero.length === 0 && conSigla.join() === `x: la sigla «${parola("S-E", "2")}»`, `${sigleNellAlbero.join("; ")}; non letti che non ci sono: ${nonLetteMancanti.join(", ")}`);

// --- La nota della versione dice solo che cosa cambia: chi l'ha provata e l'attestazione li scrive la corsa, dal conteggio.
const RACCONTO_DELLA_CORSA = /provat|attestazion/gi;
const raccontoIn = (t: string): string[] => [...t.matchAll(RACCONTO_DELLA_CORSA)].map((m) => m[0]);
const notaDellaVersione = join(RADICE, "note", `v${manifestoDelRepository.version}.md`);
const testoDellaNota = existsSync(notaDellaVersione) ? readFileSync(notaDellaVersione, "utf8") : null;
console.log(`nota della versione: ${basename(notaDellaVersione)} ${testoDellaNota === null ? "assente" : `${testoDellaNota.length} caratteri, racconto della corsa ${raccontoIn(testoDellaNota).length}`}`);
prova("la nota della versione c'è e non dice né «provat…» né «attestazion…»; mutazione: le due parole, con le maiuscole, si vedono", testoDellaNota !== null && raccontoIn(testoDellaNota).length === 0 && raccontoIn(`${testoDellaNota ?? ""}\nProvato su tre sistemi, con l'ATTESTAZIONE.`).join() === "Provat,ATTESTAZION", `${testoDellaNota === null ? "assente" : raccontoIn(testoDellaNota).join(", ")}`);

// --- nucleo.json dichiara il file di una release, e solo quello: un modo di costruirlo dai sorgenti è un rosso col suo motivo.
const dichiarato = JSON.parse(readFileSync(join(RADICE, "nucleo.json"), "utf8")) as Record<string, unknown>;
const conCostruzione = { ...dichiarato, costruzione: { bun: "1.4.2", byte: 1, sha256: "a".repeat(64) } };
const { zip: _zip, ...senzaZip } = dichiarato;
prova(
  "nucleo.json: il file della release; mutazioni: la chiave «costruzione», lo zip mancante, un'impronta che non è un'impronta",
  motiviDelNucleo(dichiarato).length === 0 &&
    motiviDelNucleo(conCostruzione).join() === "nucleo.json ha la chiave «costruzione», che non si usa: il nucleo si prende solo dal file di una release (zip e file)" &&
    motiviDelNucleo(senzaZip).join() === "nucleo.json non ha la chiave «zip»" &&
    motiviDelNucleo({ ...dichiarato, file: { percorso: "x", sha256: "b89ead06" } }).join() === "nucleo.json: «file» vuole il percorso nello zip e un'impronta sha256",
  `${motiviDelNucleo(dichiarato).join("; ")} | ${motiviDelNucleo(conCostruzione).join("; ")} | ${motiviDelNucleo(senzaZip).join("; ")}`,
);

// --- Il conteggio dei rapporti della corsa: le sue sonde, un rosso per ramo (prove/conteggio.ts --sonde), e le prove che attende
// per ogni sistema contro quelle che dichiara questa prova per la corsa (col pacchetto dato, quindi senza la costruzione).
const sondeDelConteggio = esegui(["bun", join(RADICE, "prove", "conteggio.ts"), "--sonde"]);
console.log(sondeDelConteggio.testo.trim());
prova("il conteggio dei rapporti: ogni ramo rosso si accende da solo, i verdi restano verdi (anche senza la macchina di un sistema, dichiarata), il testo della release nei suoi due casi e la matrice della corsa", sondeDelConteggio.uscita === 0 && /^ESITO: VERDE/m.test(sondeDelConteggio.testo) && /^sonde: \d+ \(2 verdi, \d+ rami rossi\), testi 3, matrici 2; sbagliate 0;/m.test(sondeDelConteggio.testo), sondeDelConteggio.testo);
const dellaCorsa = PROVE_SENZA_EDITOR - 1 + PROVE_DELL_EDITOR;
const conteggioDiverso = Object.entries(PREVISTE).filter(([, n]) => n !== dellaCorsa).map(([s, n]) => `${s} ${n}`);
console.log(`prove della corsa: ${PROVE_SENZA_EDITOR - 1} senza editor + ${PROVE_DELL_EDITOR} con l'editor = ${dellaCorsa}; attese dal conteggio ${Object.entries(PREVISTE).map(([s, n]) => `${s} ${n}`).join(", ")}`);
prova("il conteggio attende per ogni sistema le prove che questa prova dichiara per la corsa", Object.keys(PREVISTE).length === 3 && conteggioDiverso.length === 0, conteggioDiverso.join(", "));

// --- Nell'editor dato.
/** Il socket dell'editor, su macOS, sta nella cartella del profilo (`<dati>/profilo/<prime quattro cifre della versione>-main.sock`)
 *  e un socket Unix ha al più 103 caratteri: oltre, l'editor non parte («listen EINVAL»). Misurato nelle Actions su macOS: la
 *  cartella temporanea `/var/folders/<2>/<30>/T` è di 48 caratteri, quella della prova 67; con `dati  editor` il socket era di 103
 *  caratteri (il primo avvio, al limite), con `dati  editor 2` di 105 (il secondo avvio, fermo). Con `dati  1` e `dati  2` è di 98.
 *  Su Linux il socket sta in XDG_RUNTIME_DIR, su Windows è una pipe con nome: lì la lunghezza si stampa e basta. */
const SOCKET_AL_PIU = 103;
function cartellaDeiDati(nome: string): string {
  const dati = join(cartella, nome);
  const socket = join(dati, "profilo", `${VERSIONE.slice(0, 4)}-main.sock`);
  console.log(`cartella dei dati «${nome}»: il socket dell'editor sarebbe di ${socket.length} caratteri (al più ${SOCKET_AL_PIU} su macOS)`);
  if (process.platform === "darwin" && socket.length > SOCKET_AL_PIU) fermo(`il socket dell'editor sarebbe di ${socket.length} caratteri, oltre i ${SOCKET_AL_PIU} di macOS: ${socket}`);
  return dati;
}

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
  // Il flowchart vero con un avviso e nessun errore.
  const fileAvviso = join(dove, "divisione-intera-in-reale.algo");
  const originaleAvviso = readFileSync(join(casi, ...`${AVVISO}.algo`.split("/")));
  writeFileSync(fileAvviso, originaleAvviso);
  // Il primo flowchart con una riga lunga (una frase scritta prima del numero), in un file col nome che ha le parentesi dei modelli
  // dei file: `[1]` e `{a}` letti come modello varrebbero per «prova 1 a.algo», non per lui.
  const fileParentesi = join(dove, "prova [1] {a}.algo");
  const conRigaLunga = JSON.parse(originale.toString("utf8")) as { metadata: { name: string }; functions: { body: { values?: string[] }[] }[] };
  conRigaLunga.metadata.name = "riga-lunga";
  conRigaLunga.functions[0]!.body[1]!.values = ['"Il doppio del numero letto, scritto per intero perché la riga del codice continui ben oltre il bordo del riquadro e debba andare a capo: anche in una finestra larga, con il riquadro del codice a tutta larghezza, questa riga non ci sta; il doppio è "', "n * 2"];
  const originaleParentesi = Buffer.from(`${JSON.stringify(conRigaLunga, null, 2)}\n`);
  writeFileSync(fileParentesi, originaleParentesi);
  const mLunga = modello(libreria, originaleParentesi.toString("utf8"), "c", "it", "en");
  const rigaPiuLunga = "assente" in mLunga.codice ? 0 : Math.max(...mLunga.codice.testo.split("\n").map((r) => r.length));
  console.log(`il flowchart con la riga lunga: codice ${"assente" in mLunga.codice ? "assente" : "c'è"}, la riga più lunga ${rigaPiuLunga} caratteri`);

  const uscita = join(cartella, "esiti.json");
  const dati = cartellaDeiDati("dati  1");
  console.log(`APRO L'EDITOR: ${eseguibile}, una finestra per pochi secondi, con un profilo temporaneo`);
  const inizio = performance.now();
  const ambiente = JSON.stringify({ ALGO_FILE: fileAlgo, ALGO_ERRATO: fileErrato, ALGO_FUNZIONI: fileFunzioni, ALGO_PARENTESI: fileParentesi, ALGO_AVVISO: fileAvviso, ALGO_USCITA: uscita });
  const figlio = Bun.spawn([node, join(RADICE, "prove", "lancia.cjs"), eseguibile, join(estratto, "extension"), dove, dati, ambiente], { cwd: cartella, stdout: "pipe", stderr: "pipe" });
  const [fuori, errori] = await Promise.all([new Response(figlio.stdout).text(), new Response(figlio.stderr).text()]);
  const codiceUscita = await figlio.exited;
  if (codiceUscita !== 0 || !existsSync(uscita)) fermo(`l'editor non ha scritto gli esiti, uscita ${codiceUscita}:\n${fuori.slice(-3000)}\n${errori.slice(-3000)}`);
  console.log(`editor: ${((performance.now() - inizio) / 1000).toFixed(1)} s`);

  type Attesa = { f: Fotografia | null; ms: number; riuscita: boolean };
  type Domanda = { file: string; filtri: Record<string, string[]>; titolo: string };
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
    tenuta: { allaFunzione: Fotografia | null; allaPrincipale: Fotografia | null; prima: Fotografia | null; altraAttiva: string; gruppi: number; tornata: Fotografia | null };
    parentesi: { prima: Fotografia | null; cambiatoDiverso: boolean; aggiornamento: Attesa; rimesso: Fotografia | null; intatto: boolean };
    avviso: { pagina: Fotografia | null; problemi: { messaggio: string; gravita: number }[] };
    disegno: {
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
      fermoAprendo: Fotografia | null;
      fermoAprendoRimesso: Fotografia | null;
      fermoDisegnando: Fotografia | null;
      fermoRimesso: Fotografia | null;
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
    salva: {
      prima: Fotografia | null;
      inC: Fotografia | null;
      colonnaDellaPagina: number;
      salvato: Fotografia | null;
      domandaNuovo: Domanda[];
      attivo: { file: string | null; colonna: number | null };
      scritto: string | null;
      modificato: string | null;
      avviso: Fotografia | null;
      finestreConLAvviso: number;
      altroNome: Fotografia | null;
      domandaAltroNome: Domanda[];
      scritto2: string | null;
      modificatoDopoAltroNome: string | null;
      sostituito: Fotografia | null;
      finestreConSostituisci: number;
      scrittoDopoSostituisci: string | null;
      uguale: Fotografia | null;
      finestreConUguale: number;
      scrittoDopoAnnulla: string | null;
      modificato2: string | null;
      annullato: Fotografia | null;
      dopoLAnnulla: string | null;
      python: Fotografia | null;
      domandaPython: Domanda[];
      colonna: { passi: number; f: Fotografia | null };
      fileAltrove: string;
      altrove: Fotografia | null;
      scrittoAltrove: string | null;
      nonScrivibile: string;
      errore: Fotografia | null;
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
  prova("sopra il codice il titolo «Codice generato dal flowchart»; «Apri il file come testo» col suo suggerimento", p?.titoloDelCodice === testi.titoloDelCodice && (p.testoVisibile.includes(testi.titoloDelCodice) ?? false) && p.pulsanteDelTesto?.testo === testi.apriComeTesto && p.pulsanteDelTesto.suggerimento === testi.apriComeTestoSuggerimento, JSON.stringify([p?.titoloDelCodice, p?.pulsanteDelTesto]));
  const rgb = (h: string) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
  const coloriDiversi = Object.entries(p?.colori ?? {}).filter(([s, c]) => c !== null && c !== rgb(e.colori.colori[s] ?? "")).map(([s, c]) => `${s} ${c} invece di ${e.colori.colori[s]}`);
  const coloriVisti = Object.values(p?.colori ?? {}).filter((c) => c !== null).length;
  console.log(`colori sulla pagina: ${coloriVisti} specie viste nel codice, diverse dal tema ${coloriDiversi.length}`);
  prova("i colori del codice sono quelli del tema in uso, letto dal suo file", e.colori.fonte.startsWith("tema ") && e.colori.dalTema.length >= 4 && coloriVisti >= 4 && coloriDiversi.length === 0, `${e.colori.fonte}; ${coloriDiversi.join("; ")}`);
  prova("le scelte del codice: «Python» → il codice Python, in un passo", scelte(e.python) === `Python ${testi.lingue.it}` && e.python?.codice === codiceDi(atteso(originale, "python", "it")), scelte(e.python));
  prova("le scelte del codice: «inglese» → il codice Python in inglese, in un passo", scelte(e.inglese) === `Python ${testi.lingue.en}` && e.inglese?.codice === codiceDi(atteso(originale, "python", "en")), scelte(e.inglese));
  prova("la scelta ricordata: un flowchart mai aperto prende l'ultima scelta", scelte(e.erratoPrima) === `Python ${testi.lingue.en}`, scelte(e.erratoPrima));
  prova("la scelta ricordata: riaperto, il primo flowchart torna con la sua scelta, non con quella dell'altro", scelte(e.riaperto) === `Python ${testi.lingue.en}` && scelte(e.errato) === `C ${testi.lingue.it}`, `${scelte(e.riaperto)} / ${scelte(e.errato)}`);

  const mErr = atteso(originaleErrato, "c", "it");
  const voceAttesa = mErr.segnalazioni.map((s) => `${s.genere === "errore" ? "!" : "?"}\n${s.testo}\n${s.spiegazione}`);
  // `innerText` separa i paragrafi con una riga vuota (il margine del paragrafo): si confronta il testo, non l'impaginazione.
  const vociViste = (e.errato?.voci ?? []).map((v) => v.replace(/\r/g, "").replace(/\n{2,}/g, "\n").trim());
  prova("le segnalazioni: la segnalazione sulla pagina è intera, col segno, nella forma di AlgoDesign", vociViste.length === 1 && vociViste.join() === voceAttesa.join(), `${JSON.stringify(vociViste)} / ${JSON.stringify(voceAttesa)}`);
  prova("le segnalazioni: al posto del codice il rimando alle segnalazioni", e.errato?.codice === null && "assente" in mErr.codice && e.errato?.assente === mErr.codice.assente, `${e.errato?.assente}`);
  const interniSulloSchermo = (testo: string) => (testo.match(/\b(b\d+|f\d+|invalid_step|E\d{3})\b/g) ?? []);
  prova("le segnalazioni: nessun id interno sullo schermo (b1, f1, invalid_step, il numero del codice)", interniSulloSchermo(e.errato?.testoVisibile ?? "b1").length === 0, interniSulloSchermo(e.errato?.testoVisibile ?? "").join(", "));
  prova("controllo positivo: un b1 e un invalid_step nel testo visibile si vedono", interniSulloSchermo(`${e.errato?.testoVisibile ?? ""} b1 invalid_step`).join() === "b1,invalid_step");
  const segnalatoAtteso = testi.bloccoSegnalato.replace("{dove}", mErr.segnalazioni[0]?.dove ?? "?");
  const bloccoAtteso = mErr.segnalazioni[0]?.blocco ?? "?";
  prova("le segnalazioni: il clic sulla segnalazione porta alla scheda della sua funzione e al disegno, col blocco segnalato evidenziato e in vista, e lo annuncia", e.dopoIlClic?.fuoco === "disegno" && e.dopoIlClic.funzioni.filter((f) => f.attiva).map((f) => f.nome).join() === testi.principale && e.dopoIlClic.disegno.evidenziato === bloccoAtteso && e.dopoIlClic.disegno.evidenziatoInVista && e.dopoIlClic.testoVisibile.includes(segnalatoAtteso) && e.errato?.disegno.evidenziato === null && !(e.errato?.testoVisibile ?? segnalatoAtteso).includes(segnalatoAtteso), JSON.stringify([e.dopoIlClic?.fuoco, e.dopoIlClic?.funzioni, e.dopoIlClic?.disegno.evidenziato, e.dopoIlClic?.disegno.evidenziatoInVista, segnalatoAtteso]));
  prova("«Problemi»: la segnalazione intera, come errore; nessuna voce per il file che genera", e.problemiErrato.length === 1 && e.problemiErrato[0]?.messaggio === `${mErr.segnalazioni[0]?.testo} ${mErr.segnalazioni[0]?.spiegazione}` && e.problemiErrato[0]?.gravita === 0 && e.problemiFile === 0, JSON.stringify(e.problemiErrato));

  /** Dove due testi cominciano a essere diversi, coi due pezzi da lì. */
  const divergenza = (a = "", b = "") => {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return i === a.length && i === b.length ? "uguali" : `dal carattere ${i}: «${a.slice(Math.max(0, i - 20), i + 40)}» / «${b.slice(Math.max(0, i - 20), i + 40)}»`;
  };
  prova("la sola lettura: sulla pagina nessun elemento modificabile; digitando non cambia nulla, nemmeno il file", e.dopoLaDigitazione?.editabili === 0 && e.dopoLaDigitazione.testoVisibile === e.dopoIlClic?.testoVisibile && e.erratoIntatto && e.sporchiDopoLaDigitazione.length === 0, JSON.stringify({ editabili: e.dopoLaDigitazione?.editabili, sporchi: e.sporchiDopoLaDigitazione, errore: e.digitazioneSullaPagina, testo: divergenza(e.dopoIlClic?.testoVisibile, e.dopoLaDigitazione?.testoVisibile) }));
  prova("la sola lettura: «Apri il file come testo» apre il JSON del file in una vista di sola lettura, che digitando non cambia", e.comeTesto.tipo === "testo" && e.schemaDelTesto === "algo-testo" && e.idLinguaggioDelTesto === "json" && e.testoAperto === originaleErrato.toString("utf8") && e.vistaInvariata, `${e.comeTesto.tipo} ${e.schemaDelTesto} ${e.idLinguaggioDelTesto} invariata ${e.vistaInvariata}`);
  prova("controllo positivo: la stessa digitazione su un documento vero lo cambia", e.controlloDigitazione);

  const mAlt = atteso(originale.toString("utf8").replace('"name": "lettura-intero"', '"name": "lettura-intera"'), "python", "en");
  console.log(`aggiornamento dal disco: ${e.aggiornamento.ms} ms (riuscito ${e.aggiornamento.riuscita}); senza osservatore: aggiornato ${e.senzaOsservatore.riuscita} in ${e.senzaOsservatore.ms} ms`);
  prova("l'aggiornamento dal disco: dopo il salvataggio di AlgoDesign la pagina è quella nuova entro 1 s, letta dal disco", e.alteratoDiverso && e.aggiornamento.riuscita && e.aggiornamento.ms <= 1000 && e.aggiornamento.f?.codice === codiceDi(mAlt), `${e.aggiornamento.ms} ms, ${e.aggiornamento.f?.titolo}`);
  prova("controllo positivo: con l'osservatore spento lo stesso salvataggio non arriva alla pagina", !e.senzaOsservatore.riuscita && e.senzaOsservatore.f?.titolo === "lettura-intera", `${e.senzaOsservatore.f?.titolo}`);
  prova("riacceso l'osservatore e rimesso il file, la pagina torna quella di prima", e.rimesso?.titolo === m0.titolo && e.fileIntatto);
  prova("i file non sono rimasti alterati", Buffer.compare(readFileSync(fileAlgo), originale) === 0 && Buffer.compare(readFileSync(fileErrato), originaleErrato) === 0);
  prova("nessun download dell'editor", !existsSync(join(RADICE, ".vscode-test")) && !existsSync(join(cartella, ".vscode-test")), readdirSync(cartella).join(", "));

  // --- Il disegno nella pagina.
  const k = e.disegno;
  const d0 = k.errato?.disegno;
  const integrita = `sha256-${Buffer.from(IMPRONTA_DEL_NUCLEO, "hex").toString("base64")}`;
  console.log(`disegno: nucleo ${d0?.nucleo}, integrità ${d0?.integrita.slice(0, 20)}…; carattere ${JSON.stringify(d0?.carattere)}; disegno ${d0?.larghezza}×${d0?.altezza} scala ${d0?.scala}; bollini ${d0?.bollini.length}`);
  prova("il disegno: la pagina esegue il file del nucleo con l'impronta dichiarata in nucleo.json", d0?.nucleo === "caricato" && d0.integrita === integrita, `${d0?.nucleo} ${d0?.integrita} / ${integrita}`);
  const nm = k.nucleoMutato?.disegno;
  prova("controllo positivo: un byte in più nel file del nucleo, la pagina non lo esegue e lo dice; rimesso il file, sì", nm?.nucleo === "assente" && nm.frase === testi.nucleoAssente && nm.svg === null && k.nucleoRimesso?.disegno.nucleo === "caricato" && k.nucleoRimesso.disegno.svg !== null && k.nucleoIntatto, JSON.stringify([nm?.nucleo, nm?.frase, k.nucleoRimesso?.disegno.nucleo, k.nucleoIntatto]));
  const chiesto = `${DIMENSIONE_DEL_CARATTERE}px system-ui, sans-serif`;
  const stiliTenuti = (d0?.stili ?? []).filter((s) => s.tenuto).map((s) => s.stile);
  prova("il disegno: la misura col canvas, dopo i caratteri pronti: il carattere riletto è quello chiesto, nei tre stili del nucleo", d0?.carattere?.chiesto === chiesto && d0.carattere.riletto === chiesto && stiliTenuti.join() === "normale,grassetto,corsivo" && d0.svg !== null && k.carattereRimesso?.disegno.carattere?.riletto === chiesto, JSON.stringify([d0?.carattere, d0?.stili]));
  const ci = k.carattereIgnorato?.disegno;
  prova("controllo positivo: un carattere che il canvas ignora non disegna, e la pagina lo dice", ci?.svg === null && ci.frase === testi.carattereIgnorato.replace("{carattere}", '"non chiuso') && ci.carattere !== null && ci.carattere.riletto !== ci.carattere.chiesto && k.carattereRimesso?.disegno.svg !== null, JSON.stringify([ci?.frase, ci?.carattere]));
  // Le due eccezioni del nucleo nella pagina, ciascuna fra due disegni riusciti: la frase del nucleo fermo, niente disegno.
  const fermi = [k.fermoAprendo?.disegno, k.fermoDisegnando?.disegno];
  prova("il nucleo della pagina che si ferma aprendo o disegnando: niente disegno e la frase del nucleo fermo; senza la prova disegna di nuovo", fermi.every((d) => d?.svg === null && d.frase === testi.nucleoFermo) && k.fermoAprendoRimesso?.disegno.svg !== null && k.fermoAprendoRimesso?.disegno.svg !== undefined && k.fermoRimesso?.disegno.svg !== null && k.fermoRimesso?.disegno.svg !== undefined, JSON.stringify([fermi.map((d) => [d?.svg === null, d?.frase]), k.fermoAprendoRimesso?.disegno.svg === null, k.fermoRimesso?.disegno.svg === null]));

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
  console.log(`disegno: ${k.fisse.length + 1} disegni con la misura fissa (funzioni ${schedeViste.join(", ")}, attese ${funzioniAttese.join(", ")}), diversi ${diverse.length}`);
  // Il confronto sa dire «diverso»: lo stesso disegno nelle due lingue non è uguale.
  const distingue = svgAtteso(originaleFunzioni, "f1", "it") !== svgAtteso(originaleFunzioni, "f1", "en");
  prova("il disegno: con la misura fissa l'SVG della pagina è byte per byte quello del nucleo, per ogni scheda nelle due lingue", distingue && diverse.length === 0 && funzioniAttese.length >= 2 && schedeViste.join() === funzioniAttese.join() && k.fisse.length === funzioniAttese.length * 2, `distingue ${distingue}; diversi: ${diverse.join("; ")}; schede ${schedeViste.join()}`);

  const vErr = mErr.segnalazioni[0];
  const etichettaAttesa = testi.disegnoDi.replace("{funzione}", testi.principale).replace("{conteggio}", testi.errori1);
  prova("il disegno: il bollino appaiato alla segnalazione, col suo testo per la lettura dello schermo; il disegno col suo nome", JSON.stringify(d0?.bollini) === JSON.stringify([{ id: bloccoAtteso, segno: "errore", codici: vErr?.numero ?? "?", etichetta: vErr?.testo ?? "?" }]) && d0?.appaiamento.length === 0 && d0.etichetta === etichettaAttesa, `${JSON.stringify(d0?.bollini)} ${JSON.stringify(d0?.appaiamento)} «${d0?.etichetta}» / «${etichettaAttesa}»`);
  prova("il disegno: dal bollino alla sua segnalazione, col clic e con Invio", k.dalBollino?.fuoco === "voce-0" && k.dalBollinoConInvio?.fuoco === "voce-0", `${k.dalBollino?.fuoco} ${k.dalBollinoConInvio?.fuoco}`);
  const ch = k.chiuso;
  prova("il riquadro si chiude: niente disegno né divisore, le segnalazioni sopra il codice, il comando dice «Mostra il flowchart»", ch?.disegno.chiuso === true && !ch.disegno.divisoreVisibile && ch.voci.length === 1 && ch.testoVisibile.includes(testi.mostra) && !ch.testoVisibile.includes(testi.nascondi) && ch.testoVisibile.indexOf(testi.segnalazioni) < ch.testoVisibile.indexOf(ch.assente ?? "?"), JSON.stringify([ch?.disegno.chiuso, ch?.disegno.divisoreVisibile, ch?.voci.length]));
  prova("il clic su una segnalazione col riquadro chiuso lo riapre, sul blocco evidenziato", k.riapertoDallaVoce?.disegno.chiuso === false && k.riapertoDallaVoce.disegno.evidenziato === bloccoAtteso && k.riapertoDallaVoce.disegno.evidenziatoInVista, JSON.stringify([k.riapertoDallaVoce?.disegno.chiuso, k.riapertoDallaVoce?.disegno.evidenziato]));
  // Il divisore si vede solo a due colonne (pagina oltre i 760 pixel): nelle Actions la finestra è più stretta (misurato: rosso sui
  // tre sistemi con il valore giusto e la pagina a una colonna).
  const dd = k.divisore?.disegno;
  prova("il divisore con la tastiera: un passo a destra è il 55%; si vede solo con la pagina a due colonne", dd?.divisore === 55 && dd.divisoreVisibile === dd.larghezzaPagina > 760, `${dd?.divisore}, visibile ${dd?.divisoreVisibile}, pagina ${dd?.larghezzaPagina} px`);
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

  // --- Il clic sulla scheda di una funzione porta il codice alla sua definizione (attesa dal modello fuori dall'editor); la riga
  // è in cima, o in vista col codice scorso fino in fondo (una funzione nelle ultime righe non può salire in cima).
  const tp = e.tenuta;
  const mF = atteso(originaleFunzioni, "c", "it");
  const rigaF2 = "assente" in mF.codice ? undefined : mF.codice.righeDelleFunzioni["f2"];
  const rigaMainF = "assente" in mF.codice ? undefined : mF.codice.rigaDiMain;
  const inVista = (f: Fotografia | null | undefined, r: number | undefined) => f !== null && f !== undefined && r !== undefined && (f.rigaInCima === r || (f.codiceInFondo && f.rigaInCima !== null && f.rigaInFondo !== null && f.rigaInCima <= r && r <= f.rigaInFondo));
  const rigaDelCodice = (r: number | undefined) => ("assente" in mF.codice || r === undefined ? "" : (mF.codice.testo.split("\n")[r - 1] ?? ""));
  console.log(`clic sulla scheda: «${rigaDelCodice(rigaF2)}» alla riga ${rigaF2}, in cima ${tp.allaFunzione?.rigaInCima} (in fondo ${tp.allaFunzione?.rigaInFondo}, codice in fondo ${tp.allaFunzione?.codiceInFondo}); main alla riga ${rigaMainF}, in cima ${tp.allaPrincipale?.rigaInCima}`);
  prova("il clic sulla scheda di una funzione porta il codice alla sua definizione; «Programma principale» a main", rigaF2 !== undefined && rigaMainF !== undefined && rigaF2 !== rigaMainF && tp.allaFunzione?.funzioni[1]?.attiva === true && inVista(tp.allaFunzione, rigaF2) && !inVista(tp.allaFunzione, rigaMainF) && tp.allaPrincipale?.funzioni[0]?.attiva === true && tp.allaPrincipale.rigaInCima === rigaMainF, JSON.stringify([rigaF2, tp.allaFunzione?.rigaInCima, tp.allaFunzione?.rigaInFondo, rigaMainF, tp.allaPrincipale?.rigaInCima]));
  // La pagina che torna in primo piano: rinata (un'altra nascita: senza, la prova non direbbe nulla), con lo zoom, il divisore, la
  // funzione e la riga in cima di prima.
  const pr = tp.prima;
  const tr = tp.tornata;
  console.log(`pagina tornata: altra scheda ${tp.altraAttiva}, gruppi ${tp.gruppi}; nascita ${pr?.nascita === tr?.nascita ? "la stessa" : "un'altra"}; zoom ${pr?.disegno.scala}→${tr?.disegno.scala}, divisore ${pr?.disegno.divisore}→${tr?.disegno.divisore}, funzione ${pr?.funzioni.find((f) => f.attiva)?.nome}→${tr?.funzioni.find((f) => f.attiva)?.nome}, riga in cima ${pr?.rigaInCima}→${tr?.rigaInCima}`);
  prova("tornando alla pagina da un'altra scheda dello stesso gruppo: la pagina rinata ha lo zoom, il divisore, la funzione e la riga del codice di prima", tp.altraAttiva === "testo" && tp.gruppi === 1 && pr !== null && tr !== null && pr.nascita !== tr.nascita && pr.disegno.adattata === false && vicino(pr.disegno.scala, 1) && vicino(tr.disegno.scala, pr.disegno.scala) && tr.disegno.adattata === false && pr.disegno.divisore === 65 && tr.disegno.divisore === pr.disegno.divisore && pr.funzioni[1]?.attiva === true && tr.funzioni[1]?.attiva === true && tr.rigaInCima === pr.rigaInCima, JSON.stringify([tp.altraAttiva, tp.gruppi, pr?.nascita, tr?.nascita, pr?.disegno.scala, tr?.disegno.scala, pr?.disegno.divisore, tr?.disegno.divisore, pr?.funzioni, tr?.funzioni, pr?.rigaInCima, tr?.rigaInCima]));

  // --- Il nome con le parentesi dei modelli dei file, e la riga lunga.
  const pa = e.parentesi;
  const aC = pa.prima?.aCapo;
  console.log(`nome con le parentesi: aggiornato ${pa.aggiornamento.riuscita} in ${pa.aggiornamento.ms} ms; a capo: ${aC?.righe} righe, larghezza ${aC?.larghezza} su ${aC?.larghezzaVisibile} visibili, rientro ${JSON.stringify(aC?.rientro)}`);
  prova("un flowchart col nome «prova [1] {a}.algo»: dopo il salvataggio di AlgoDesign la pagina si aggiorna da sola", pa.prima?.titolo === "riga-lunga" && pa.cambiatoDiverso && pa.aggiornamento.riuscita && pa.aggiornamento.f?.titolo === "riga-lunga-cambiata" && pa.rimesso?.titolo === "riga-lunga" && pa.intatto && Buffer.compare(readFileSync(fileParentesi), originaleParentesi) === 0, `${pa.prima?.titolo} → ${pa.aggiornamento.f?.titolo} (${pa.aggiornamento.ms} ms) → ${pa.rimesso?.titolo}`);
  prova("il codice va a capo quando la riga non ci sta: nessuno scorrimento orizzontale, e il seguito parte più a destra dell'inizio della riga", rigaPiuLunga > 200 && aC !== undefined && aC.righe >= 1 && aC.larghezza <= aC.larghezzaVisibile && aC.rientro !== null && aC.rientro.seguito > aC.rientro.inizio + 1, JSON.stringify([rigaPiuLunga, aC]));
  // Una riga rientrata di 400 caratteri (più larga di qualunque riquadro): il seguito rientra al più di metà della larghezza.
  const tt = aC?.tetto;
  prova("il rientro del seguito ha un tetto: una riga rientrata di 400 caratteri lascia al seguito almeno metà della larghezza visibile del codice", tt !== null && tt !== undefined && tt.larghezza > 0 && tt.sospeso > 0 && tt.sospeso <= tt.larghezza / 2 + 1, JSON.stringify(tt));

  // --- L'avviso in «Problemi».
  const av = e.avviso;
  const mAv = atteso(originaleAvviso, "c", "it");
  const vAv = mAv.segnalazioni[0];
  prova("un flowchart con un avviso e nessun errore: in «Problemi» come avviso (non errore), sulla pagina col suo segno, e il codice c'è", mAv.segnalazioni.length === 1 && vAv?.genere === "avviso" && av.problemi.length === 1 && av.problemi[0]?.gravita === 1 && av.problemi[0]?.messaggio === `${vAv.testo} ${vAv.spiegazione}` && (av.pagina?.voci[0] ?? "").startsWith("?") && av.pagina?.codice !== null && av.pagina?.codice === codiceDi(mAv), JSON.stringify([av.problemi, av.pagina?.voci, av.pagina?.codice === null]));

  // --- «Salva il codice come…» (la finestra di Windows sostituita dalle risposte preparate: le domande dicono quando si apre).
  const sv = e.salva;
  const fileC = join(dove, "lettura-intero.c");
  const fileC2 = join(dove, "lettura-intero-2.c");
  const codiceC = "assente" in m0.codice ? "?" : m0.codice.testo;
  const stesso = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const riga = (file: string) => riempi(testi.salvatoAccanto, { file });
  const pulsantiAttesi = [testi.salvaConAltroNome, `⚠ ${testi.sostituisci}`, testi.annullaSalvataggio];
  const domandeDi = (d: Domanda[]) => d.map((x) => `${x.file} | ${JSON.stringify(x.filtri)} | ${x.titolo}`).join("; ");
  prova("«Salva il codice come…» sopra il codice C; col codice assente (il flowchart con errori) il comando non c'è", sv.inC?.salvataggio.comando === testi.salvaCodice && e.errato?.salvataggio.comando === null, `${sv.inC?.salvataggio.comando} / ${e.errato?.salvataggio.comando}`);
  prova("il file non c'è: la finestra nella cartella del flowchart col nome proposto, il tipo e il titolo; il file scritto è il codice della pagina, aperto accanto; la pagina dice dove", sv.domandaNuovo.length === 1 && stesso(sv.domandaNuovo[0]?.file ?? "", fileC) && JSON.stringify(sv.domandaNuovo[0]?.filtri) === JSON.stringify({ [testi.tipiDelCodice["c"] ?? "?"]: ["c"] }) && sv.domandaNuovo[0]?.titolo === testi.titoloDelSalvataggio && sv.scritto === codiceC && sv.inC?.codice === codiceDi(m0) && sv.salvato?.salvataggio.riga === riga("lettura-intero.c") && sv.attivo.file !== null && stesso(sv.attivo.file, fileC) && (sv.attivo.colonna ?? 0) > sv.colonnaDellaPagina, `${sv.salvato?.salvataggio.riga}; attivo ${JSON.stringify(sv.attivo)}, pagina ${sv.colonnaDellaPagina}; scritto ${sv.scritto === codiceC}`);
  prova("il file c'è ed è diverso: l'avviso PRIMA della finestra (nessuna finestra aperta), coi tre pulsanti, il fuoco sulla scelta proposta", sv.modificato !== codiceC && sv.avviso?.salvataggio.avviso === riempi(testi.esisteDiverso, { file: "lettura-intero.c" }) && JSON.stringify(sv.avviso.salvataggio.pulsanti) === JSON.stringify(pulsantiAttesi) && sv.avviso.fuoco === "salva-con-altro-nome" && sv.finestreConLAvviso === 0, `${sv.avviso?.salvataggio.avviso} ${JSON.stringify(sv.avviso?.salvataggio.pulsanti)} fuoco ${sv.avviso?.fuoco}, finestre ${sv.finestreConLAvviso}`);
  const [aspettoAltro, aspettoSost, aspettoAnnulla] = sv.avviso?.salvataggio.aspetti ?? [];
  prova("nell'avviso «Sostituisci» si distingue da «Annulla»: il segno ⚠ prima della parola, un altro colore del testo e del bordo", aspettoSost !== undefined && aspettoAnnulla !== undefined && aspettoAltro !== undefined && aspettoSost.testo.startsWith("⚠") && aspettoSost.colore !== aspettoAnnulla.colore && aspettoSost.bordo !== aspettoAnnulla.bordo && aspettoSost.colore !== aspettoAltro.colore, JSON.stringify(sv.avviso?.salvataggio.aspetti));
  const col = sv.colonna.f;
  console.log(`a una colonna: ${sv.colonna.passi} passi di zoom, pagina ${col?.disegno.larghezzaPagina} px; la barra a ${col?.colonna.barra} (senza aggancio ${col?.colonna.barraSenzaAggancio}), il riquadro del codice a ${col?.colonna.riquadro}; codice alto ${col?.colonna.altezzaDelCodice} su ${col?.colonna.altezzaDellaFinestra}, pagina scorsa di ${col?.colonna.scorrimento}`);
  // La pagina che non arriva a una colonna (sei passi di zoom non bastano, o la pagina non risponde) non si è potuta misurare.
  if (col === null || col.disegno.larghezzaPagina > 760) fermo(`la pagina non si è potuta portare a una colonna: ${sv.colonna.passi} passi di zoom, pagina ${col?.disegno.larghezzaPagina ?? "senza risposta"}`);
  // Il codice prende la finestra sotto la barra, e mai meno di metà: l'altezza attesa dalla barra misurata, non il solo minimo.
  const altezzaAttesa = Math.max(col.colonna.altezzaDellaFinestra / 2, col.colonna.altezzaDellaFinestra - col.colonna.altezzaDellaBarra - 2);
  prova("a una colonna, scorrendo fino in fondo (l'avviso fra barra e codice): la barra resta in cima, dove senza aggancio sarebbe uscita; il codice prende la finestra sotto la barra", col.colonna.barraSenzaAggancio < -1 && Math.abs(col.colonna.barra) <= 1 && Math.abs(col.colonna.altezzaDelCodice - altezzaAttesa) <= 2 && col.salvataggio.avviso !== null, JSON.stringify([sv.colonna.passi, col.disegno.larghezzaPagina, col.colonna, altezzaAttesa, col.salvataggio.avviso]));
  // A due colonne (la pagina oltre i 760 pixel: nelle Actions la finestra può essere più stretta) il codice arriva al fondo della
  // finestra, col margine della pagina, qualunque cosa gli stia sopra.
  const due = [p, sv.inC].filter((f): f is Fotografia => f !== null && f !== undefined && f.disegno.larghezzaPagina > 760);
  const fondiDiversi = due.filter((f) => Math.abs(f.colonna.fondoDelCodice - (f.colonna.altezzaDellaFinestra - 12)) > 2).map((f) => `${f.colonna.fondoDelCodice} su ${f.colonna.altezzaDellaFinestra}`);
  console.log(`a due colonne: ${due.length} fotografie; fondo del codice ${due.map((f) => `${Math.round(f.colonna.fondoDelCodice)}/${f.colonna.altezzaDellaFinestra}`).join(", ") || "-"}`);
  prova("a due colonne il codice arriva al fondo della finestra (se la pagina è a due colonne)", fondiDiversi.length === 0, fondiDiversi.join("; "));
  const dAltro = sv.domandaAltroNome[0];
  prova("«Salva con un altro nome»: la finestra propone il primo nome libero; il nuovo file è il codice, quello modificato resta com'era", sv.domandaAltroNome.length === 1 && dAltro !== undefined && stesso(dAltro.file, fileC2) && JSON.stringify(dAltro.filtri) === JSON.stringify({ [testi.tipiDelCodice["c"] ?? "?"]: ["c"] }) && dAltro.titolo === testi.titoloDelSalvataggio && sv.scritto2 === codiceC && sv.modificatoDopoAltroNome === sv.modificato && sv.altroNome?.salvataggio.riga === riga("lettura-intero-2.c"), domandeDi(sv.domandaAltroNome));
  prova("«Sostituisci»: nessuna finestra, il file è il codice della pagina, l'avviso sparisce", sv.finestreConSostituisci === 0 && sv.scrittoDopoSostituisci === codiceC && sv.sostituito?.salvataggio.avviso === null && sv.sostituito.salvataggio.riga === riga("lettura-intero.c"), `finestre ${sv.finestreConSostituisci}, uguale ${sv.scrittoDopoSostituisci === codiceC}`);
  prova("il file c'è ed è uguale: la finestra, nessun avviso; «Annulla» nella finestra non scrive nulla", sv.finestreConUguale === 1 && sv.uguale?.salvataggio.avviso === null && sv.scrittoDopoAnnulla === codiceC, `finestre ${sv.finestreConUguale}, avviso ${sv.uguale?.salvataggio.avviso}`);
  prova("«Annulla» nell'avviso: l'avviso sparisce, il file modificato resta, il fuoco torna al comando", sv.modificato2 !== codiceC && sv.annullato?.salvataggio.avviso === null && sv.dopoLAnnulla === sv.modificato2 && sv.annullato.fuoco === "salva-codice", `avviso ${sv.annullato?.salvataggio.avviso}, fuoco ${sv.annullato?.fuoco}`);
  const dPy = sv.domandaPython[0];
  prova("in Python il nome proposto è .py col suo tipo; il codice cambia e la riga del salvataggio sparisce", sv.domandaPython.length === 1 && dPy !== undefined && stesso(dPy.file, join(dove, "lettura-intero.py")) && JSON.stringify(dPy.filtri) === JSON.stringify({ [testi.tipiDelCodice["python"] ?? "?"]: ["py"] }) && sv.python?.salvataggio.riga === null, `${domandeDi(sv.domandaPython)}; riga ${sv.python?.salvataggio.riga}`);
  // In un'altra cartella il percorso intero, con la lettera del disco come la scrive il sistema.
  const rigaAltrove = sv.altrove?.salvataggio.riga ?? "";
  const prefisso = riempi(testi.salvato, { percorso: "" });
  prova("salvato in un'altra cartella: la pagina dice il percorso intero", sv.scrittoAltrove !== null && rigaAltrove.startsWith(prefisso) && stesso(rigaAltrove.slice(prefisso.length), sv.fileAltrove) && rigaAltrove.slice(prefisso.length, prefisso.length + 1) === sv.fileAltrove.slice(0, 1), `${rigaAltrove} / ${sv.fileAltrove}`);
  // Un posto che non si scrive: il nome e che cosa fare, nessun motivo tecnico sullo schermo.
  const rigaErrore = sv.errore?.salvataggio.riga ?? "";
  prova("il codice che non si salva: la pagina dice quale file e che cosa fare, senza il motivo tecnico", rigaErrore === riempi(testi.nonSalvato, { file: basename(sv.nonScrivibile) }) && !/E[A-Z]{3,}|Error|rror:/.test(rigaErrore), rigaErrore);

  // --- Il secondo avvio: una copia dell'estensione col file del nucleo cambiato PRIMA dell'avvio (un byte in più). Nel primo
  // avvio il file cambia dopo l'attivazione: l'estensione l'aveva già verificato e caricato, e la verifica dell'estensione non
  // si percorre; qui sì. Atteso: l'estensione non lo esegue (il codice non c'è, con la frase del nucleo cambiato), e nemmeno la
  // pagina (il disegno non c'è).
  const mutata = join(cartella, "estensione  col nucleo cambiato");
  cpSync(join(estratto, "extension"), mutata, { recursive: true });
  const libreriaMutata = join(mutata, "dist", "libreria.cjs");
  writeFileSync(libreriaMutata, Buffer.concat([readFileSync(libreriaMutata), Buffer.from("\n")]));
  const byteMutati = readFileSync(libreriaMutata).length;
  const uscita2 = join(cartella, "esiti col nucleo cambiato.json");
  const ambiente2 = JSON.stringify({ ALGO_FILE: fileAlgo, ALGO_USCITA: uscita2, ALGO_NUCLEO_CAMBIATO: "1" });
  console.log(`APRO L'EDITOR UNA SECONDA VOLTA: l'estensione col file del nucleo di ${byteMutati} byte (${byteMutati - readFileSync(join(estratto, "extension", "dist", "libreria.cjs")).length} in più)`);
  const figlio2 = Bun.spawn([node, join(RADICE, "prove", "lancia.cjs"), eseguibile, mutata, dove, cartellaDeiDati("dati  2"), ambiente2], { cwd: cartella, stdout: "pipe", stderr: "pipe" });
  const [fuori2, errori2] = await Promise.all([new Response(figlio2.stdout).text(), new Response(figlio2.stderr).text()]);
  if ((await figlio2.exited) !== 0 || !existsSync(uscita2)) fermo(`l'editor del secondo avvio non ha scritto gli esiti:\n${fuori2.slice(-3000)}\n${errori2.slice(-3000)}`);
  const e2 = JSON.parse(readFileSync(uscita2, "utf8")) as { lingua: string; pagina: Fotografia | null; byte: number };
  const testi2 = testiDellInterfaccia(e2.lingua.toLowerCase().startsWith("it") ? "it" : "en");
  const pm = e2.pagina;
  console.log(`secondo avvio: nucleo di ${e2.byte} byte; codice ${pm?.codice === null ? "assente" : "c'è"} («${pm?.assente}»); disegno ${pm?.disegno.nucleo}`);
  prova("il nucleo cambiato prima dell'avvio: l'estensione non lo esegue (il codice non c'è, e la pagina dice che il nucleo è stato cambiato), né la pagina", e2.byte === byteMutati && pm !== null && pm.codice === null && pm.assente === testi2.nucleoAssente && pm.disegno.nucleo === "assente", JSON.stringify([e2.byte, pm?.codice?.slice(0, 40), pm?.assente, pm?.disegno.nucleo]));
  // Il controllo positivo: nel primo avvio, col file cambiato dopo l'attivazione, il codice c'era (l'estensione l'aveva caricato).
  // Il codice atteso è quello della scelta che la pagina mostrava (il flowchart si riapre con l'ultima scelta fatta per lui).
  const nmu = k.nucleoMutato;
  const linguaggioMostrato = Object.entries(testi.linguaggi).find(([, n]) => n === nmu?.linguaggi.find((x) => x.attivo)?.nome)?.[0] ?? "?";
  const linguaMostrata = nmu?.lingue.find((x) => x.attivo)?.nome === testi.lingue.en ? "en" : "it";
  prova("controllo positivo: col file cambiato dopo l'attivazione l'estensione aveva già caricato il nucleo, e il codice c'era", nm !== undefined && nmu !== null && nmu.codice !== null && nmu.codice === codiceDi(atteso(originale, linguaggioMostrato, linguaMostrata)), `${linguaggioMostrato} ${linguaMostrata}: ${nmu?.codice?.slice(0, 40)}`);
}

if (opzioni.editor !== undefined) await nellEditor(opzioni.editor);

console.log(`prove: ${fatte}/${provePreviste}, fallite ${fallite.length}${opzioni.editor !== undefined ? "" : "; l'editor non è stato aperto"}`);
const esito = fatte !== provePreviste ? "FERMO" : fallite.length > 0 ? "ROSSO" : "VERDE";
scriviIlRapporto(esito, esito === "FERMO" ? [...fallite, `FERMO: il denominatore non torna: dichiarate ${provePreviste}, eseguite ${fatte}`] : fallite);
if (esito === "FERMO") {
  console.log(`FERMO: il denominatore non torna: dichiarate ${provePreviste}, eseguite ${fatte}`);
  process.exit(2);
}
console.log(`ESITO: ${esito === "ROSSO" ? "ROSSO" : opzioni.editor !== undefined ? "VERDE" : "VERDE, senza l'editor: il documento nell'editor non è stato provato"}`);
process.exit(fallite.length === 0 ? 0 : 1);

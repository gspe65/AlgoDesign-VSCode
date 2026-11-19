// Il conteggio dei rapporti delle prove con l'editor: uno per ciascun sistema dichiarato qui, scritto a parte dalla matrice della
// corsa, nei due versi. Un sistema che non ha scritto il rapporto (tolto dalla matrice, saltato, fermato) è un rosso, come un
// rapporto in più, una prova rossa, un editor non aperto, un pacchetto diverso da quello costruito, o un numero di prove
// diverso da quello atteso qui per quel sistema (il denominatore non lo decide chi scrive il rapporto).
//
// Le due dichiarazioni della corsa lanciata a mano (gli ingressi del flusso, coi nomi della matrice: windows, linux, macos):
// - `--togli <sistema>`: il controllo del conteggio. Il sistema resta nella matrice ma non scrive il rapporto, e il conteggio è
//   rosso, sempre, anche insieme all'altra dichiarazione (vince lei);
// - `--senza-macchina <sistema>`: GitHub non ha dato la macchina di quel sistema. Il sistema è fuori dalla matrice; il conteggio
//   vuole verdi tutti gli altri, e un rapporto di quel sistema è un rosso (la dichiarazione era falsa). Al più un sistema.
//
// Con il conteggio verde e `--nota`, scrive il testo della release: la nota della versione (che cosa cambia) e il paragrafo della
// corsa, composto qui dal conteggio (i sistemi provati e le prove verdi di ciascuno, quello che manca e perché) e dagli argomenti
// (il pacchetto, la corsa, l'etichetta, il commit, l'impronta, il repository).
//
//   bun prove/conteggio.ts --cartella <rapporti> --sha256 <impronta> [--togli <s>] [--senza-macchina <s>]
//                          [--nota <note/v….md> --uscita <file> --pacchetto <nome> --corsa <n> --etichetta <t> --commit <sha> --repository <proprietario/nome>]
//   bun prove/conteggio.ts --sonde      rapporti finti, uno per ramo rosso, e il testo della release nei suoi casi
//
// Uscite: 0 verde, 1 rosso, 2 fermo.
//
// Che cosa NON guarda: il contenuto delle prove, che sta nei rapporti e nei registri dei loro lavori; che GitHub non abbia dato
// davvero la macchina (lo dichiara chi lancia la corsa, e la nota lo scrive come motivo).

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { differenze, fermo } from "../strumenti/comune";
import { VERSIONE } from "../strumenti/versione-vscodium";

/** I sistemi su cui la prova con l'editor deve girare, come li chiama Node, con le prove attese per ciascuno sul pacchetto
 *  della corsa (`bun prove/prova.ts --pacchetto … --editor …`): 34 senza editor (la costruzione non si conta, il pacchetto è
 *  quello dato) più 59 con l'editor. Nessuna prova si salta su un sistema: lo stesso numero sui tre. La prova senza editor
 *  confronta questi numeri con quelli che dichiara lei. */
export const PREVISTE: Record<string, number> = { win32: 93, linux: 93, darwin: 93 };
export const SISTEMI = Object.keys(PREVISTE);
/** I nomi della matrice del flusso (gli ingressi) e i nomi nella nota, per ciascun sistema. */
const DALLA_MATRICE: Record<string, string> = { windows: "win32", linux: "linux", macos: "darwin" };
const NELLA_NOTA: Record<string, string> = { win32: "Windows", linux: "Ubuntu", darwin: "macOS" };

type Rapporto = { sistema: string; editor: string | null; pacchetto: { sha256: string }; fatte: number; previste: number; fallite: string[]; esito: string };
/** Le dichiarazioni della corsa, coi nomi della matrice; vuoto è nessuna. */
export type Dichiarazioni = { togli: string; senzaMacchina: string };
const NESSUNA: Dichiarazioni = { togli: "", senzaMacchina: "" };

/** I motivi del rosso; vuoto è verde. */
export function motiviDelConteggio(rapporti: { f: string; r: Rapporto }[], atteso: string, d: Dichiarazioni = NESSUNA): string[] {
  const motivi: string[] = [];
  for (const [nome, valore] of [["togli", d.togli], ["senza_macchina", d.senzaMacchina]] as const)
    if (valore !== "" && DALLA_MATRICE[valore] === undefined) motivi.push(`«${nome}» vale «${valore}»: si aspetta windows, linux o macos`);
  if (d.togli !== "") motivi.push(`«togli» lascia fuori ${d.togli}: il conteggio è rosso per costruzione (il controllo del conteggio)`);
  if (d.togli !== "" && d.senzaMacchina !== "") motivi.push("«togli» e «senza_macchina» insieme: al più un sistema fuori, e «togli» vince");
  const senza = DALLA_MATRICE[d.senzaMacchina];
  const dichiarati = SISTEMI.filter((s) => s !== senza);
  const visti = rapporti.map((x) => x.r.sistema);
  const ripetuti = visti.filter((s, i) => visti.indexOf(s) !== i);
  for (const s of new Set(ripetuti)) motivi.push(`più rapporti per ${s}`);
  if (senza !== undefined && visti.includes(senza)) motivi.push(`rapporto di ${senza}, dichiarato senza macchina`);
  const diff = differenze(visti, dichiarati);
  for (const s of diff.soloA) if (s !== senza) motivi.push(`rapporto di un sistema non dichiarato: ${s}`);
  for (const s of diff.soloB) motivi.push(`manca il rapporto di ${s}`);
  for (const { f, r } of rapporti) {
    if (r.esito !== "VERDE") motivi.push(`${f}: esito ${r.esito}${r.fallite.length > 0 ? ` (${r.fallite.join("; ")})` : ""}`);
    if (r.fatte !== r.previste) motivi.push(`${f}: prove ${r.fatte} su ${r.previste}`);
    if (PREVISTE[r.sistema] !== undefined && r.previste !== PREVISTE[r.sistema]) motivi.push(`${f}: prove previste ${r.previste}, attese per ${r.sistema} ${PREVISTE[r.sistema]}`);
    if (r.editor === null) motivi.push(`${f}: l'editor non è stato aperto`);
    if (r.pacchetto.sha256 !== atteso) motivi.push(`${f}: il pacchetto provato non è quello costruito (${r.pacchetto.sha256.slice(0, 12)})`);
  }
  return motivi;
}

/** Ciò che la corsa scrive nella release. */
export type Corsa = { pacchetto: string; corsa: string; etichetta: string; commit: string; sha256: string; repository: string };

/** Il paragrafo della corsa, da un conteggio verde: i sistemi provati, nell'ordine dichiarato, con le prove verdi di ciascuno, e
 *  quello senza macchina, se c'è. */
export function paragrafoDellaCorsa(rapporti: { r: Rapporto }[], d: Dichiarazioni, c: Corsa): string {
  const senza = DALLA_MATRICE[d.senzaMacchina];
  const provati = SISTEMI.filter((s) => s !== senza).map((s, i) => {
    const fatte = rapporti.find((x) => x.r.sistema === s)?.r.fatte ?? 0;
    return `${NELLA_NOTA[s]} (${fatte}${i === 0 ? " prove verdi" : ""})`;
  });
  const elenco = provati.length === 1 ? provati[0]! : `${provati.slice(0, -1).join(", ")} e ${provati[provati.length - 1]}`;
  const mancante = senza === undefined ? "" : `; su ${NELLA_NOTA[senza]} non è stato provato, perché GitHub non ha dato la macchina per la prova`;
  return [
    `Il pacchetto \`${c.pacchetto}\` è stato costruito una volta sola dalla corsa ${c.corsa} delle GitHub Actions di questo repository, all'etichetta \`${c.etichetta}\` (commit \`${c.commit.slice(0, 7)}\`), sha256 \`${c.sha256}\`. Lo stesso file è stato provato con VSCodium ${VERSIONE} su ${elenco}${mancante}. Porta l'attestazione della sua provenienza:`,
    "",
    "```",
    `gh attestation verify ${c.pacchetto} -R ${c.repository}`,
    "```",
  ].join("\n");
}

/** Il testo della release: la nota della versione, poi il paragrafo della corsa. */
export function testoDellaRelease(nota: string, rapporti: { r: Rapporto }[], d: Dichiarazioni, c: Corsa): string {
  return `${nota.replace(/\s+$/, "")}\n\n${paragrafoDellaCorsa(rapporti, d, c)}\n`;
}

function leggi(cartella: string): { f: string; r: Rapporto }[] {
  const file = readdirSync(cartella, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".json")).sort();
  return file.map((f) => ({ f: f.replaceAll("\\", "/"), r: JSON.parse(readFileSync(join(cartella, f), "utf8")) as Rapporto }));
}

/** Le sonde: rapporti finti scritti su disco e riletti come quelli veri, un caso verde e un rosso per ramo; poi il testo della
 *  release nei due casi (tre sistemi; uno senza macchina), confrontato col testo atteso per intero. */
function sonde(): number {
  const IMPRONTA = "a".repeat(64);
  const buono = (sistema: string): Rapporto => ({ sistema, editor: "VSCodium", pacchetto: { sha256: IMPRONTA }, fatte: PREVISTE[sistema]!, previste: PREVISTE[sistema]!, fallite: [], esito: "VERDE" });
  const tre = () => SISTEMI.map(buono);
  const senzaMac = () => tre().filter((r) => r.sistema !== "darwin");
  const casi: { nome: string; rapporti: Rapporto[]; d?: Dichiarazioni; atteso: string[] }[] = [
    { nome: "i tre rapporti verdi", rapporti: tre(), atteso: [] },
    { nome: "senza la macchina di macOS, dichiarato: verdi gli altri due", rapporti: senzaMac(), d: { togli: "", senzaMacchina: "macos" }, atteso: [] },
    { nome: "un rapporto mancante senza dichiarazione", rapporti: senzaMac(), atteso: ["manca il rapporto di darwin"] },
    { nome: "«togli», col suo rapporto mancante", rapporti: senzaMac(), d: { togli: "macos", senzaMacchina: "" }, atteso: ["«togli» lascia fuori macos: il conteggio è rosso per costruzione (il controllo del conteggio)", "manca il rapporto di darwin"] },
    { nome: "«togli» e «senza_macchina» sullo stesso sistema: vince «togli»", rapporti: senzaMac(), d: { togli: "macos", senzaMacchina: "macos" }, atteso: ["«togli» lascia fuori macos: il conteggio è rosso per costruzione (il controllo del conteggio)", "«togli» e «senza_macchina» insieme: al più un sistema fuori, e «togli» vince"] },
    { nome: "«togli» e «senza_macchina» su due sistemi", rapporti: tre().filter((r) => r.sistema === "win32"), d: { togli: "linux", senzaMacchina: "macos" }, atteso: ["«togli» lascia fuori linux: il conteggio è rosso per costruzione (il controllo del conteggio)", "«togli» e «senza_macchina» insieme: al più un sistema fuori, e «togli» vince", "manca il rapporto di linux"] },
    { nome: "«senza_macchina» con il rapporto di quel sistema", rapporti: tre(), d: { togli: "", senzaMacchina: "macos" }, atteso: ["rapporto di darwin, dichiarato senza macchina"] },
    { nome: "«senza_macchina» con un valore non previsto", rapporti: tre(), d: { togli: "", senzaMacchina: "freebsd" }, atteso: ["«senza_macchina» vale «freebsd»: si aspetta windows, linux o macos"] },
    { nome: "senza macchina e un rapporto rosso degli altri", rapporti: senzaMac().map((r) => (r.sistema === "linux" ? { ...r, fallite: ["x"], esito: "ROSSO" } : r)), d: { togli: "", senzaMacchina: "macos" }, atteso: ["rapporto-linux.json: esito ROSSO (x)"] },
    { nome: "due rapporti per un sistema", rapporti: [...tre(), buono("linux")], atteso: ["più rapporti per linux"] },
    { nome: "un sistema non dichiarato", rapporti: [...tre(), { ...buono("linux"), sistema: "freebsd" }], atteso: ["rapporto di un sistema non dichiarato: freebsd"] },
    { nome: "una prova rossa", rapporti: tre().map((r) => (r.sistema === "win32" ? { ...r, fallite: ["x"], esito: "ROSSO" } : r)), atteso: ["rapporto-win32.json: esito ROSSO (x)"] },
    { nome: "prove fatte meno delle previste", rapporti: tre().map((r) => (r.sistema === "linux" ? { ...r, fatte: r.fatte - 1 } : r)), atteso: [`rapporto-linux.json: prove ${PREVISTE.linux! - 1} su ${PREVISTE.linux}`] },
    { nome: "il denominatore abbassato da chi scrive il rapporto", rapporti: tre().map((r) => (r.sistema === "linux" ? { ...r, fatte: 30, previste: 30 } : r)), atteso: [`rapporto-linux.json: prove previste 30, attese per linux ${PREVISTE.linux}`] },
    { nome: "l'editor non aperto", rapporti: tre().map((r) => (r.sistema === "darwin" ? { ...r, editor: null } : r)), atteso: ["rapporto-darwin.json: l'editor non è stato aperto"] },
    { nome: "un altro pacchetto", rapporti: tre().map((r) => (r.sistema === "win32" ? { ...r, pacchetto: { sha256: "b".repeat(64) } } : r)), atteso: ["rapporto-win32.json: il pacchetto provato non è quello costruito (bbbbbbbbbbbb)"] },
  ];
  const radice = mkdtempSync(join(tmpdir(), "algo  conteggio-"));
  let sbagliate = 0;
  try {
    casi.forEach((c, i) => {
      const cartella = join(radice, String(i));
      mkdirSync(cartella);
      // Il nome del file dice il sistema, come nella corsa; un sistema ripetuto va in una sottocartella, come un altro artefatto.
      const usati = new Set<string>();
      for (const r of c.rapporti) {
        const nome = `rapporto-${r.sistema}.json`;
        const dove = usati.has(nome) ? join(cartella, "doppio") : cartella;
        mkdirSync(dove, { recursive: true });
        writeFileSync(join(dove, nome), JSON.stringify(r));
        usati.add(nome);
      }
      const letti = leggi(cartella);
      const motivi = motiviDelConteggio(letti, IMPRONTA, c.d);
      const buona = letti.length === c.rapporti.length && motivi.length === c.atteso.length && c.atteso.every((a, j) => motivi[j] === a);
      if (!buona) sbagliate++;
      console.log(`${buona ? "PASS" : "FAIL"}  sonda «${c.nome}»: rapporti ${letti.length} su ${c.rapporti.length}, motivi ${motivi.length} [${motivi.join("; ")}]`);
    });
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
  // Il testo della release, per intero, nei due casi: i numeri dai rapporti (qui diversi per sistema, perché uno scambiato si veda).
  const corsa: Corsa = { pacchetto: "AlgoDesign-Code-9.9.9.vsix", corsa: "123", etichetta: "v9.9.9", commit: "0123456789abcdef", sha256: IMPRONTA, repository: "proprietario/repository" };
  const numerati = tre().map((r, i) => ({ r: { ...r, fatte: 90 + i } }));
  const testi = [
    {
      nome: "il testo della release coi tre sistemi",
      d: NESSUNA,
      rapporti: numerati,
      atteso: `Che cosa cambia.\n\nIl pacchetto \`AlgoDesign-Code-9.9.9.vsix\` è stato costruito una volta sola dalla corsa 123 delle GitHub Actions di questo repository, all'etichetta \`v9.9.9\` (commit \`0123456\`), sha256 \`${IMPRONTA}\`. Lo stesso file è stato provato con VSCodium ${VERSIONE} su Windows (90 prove verdi), Ubuntu (91) e macOS (92). Porta l'attestazione della sua provenienza:\n\n\`\`\`\ngh attestation verify AlgoDesign-Code-9.9.9.vsix -R proprietario/repository\n\`\`\`\n`,
    },
    {
      nome: "il testo della release senza la macchina di macOS",
      d: { togli: "", senzaMacchina: "macos" },
      rapporti: numerati.filter((x) => x.r.sistema !== "darwin"),
      atteso: `Che cosa cambia.\n\nIl pacchetto \`AlgoDesign-Code-9.9.9.vsix\` è stato costruito una volta sola dalla corsa 123 delle GitHub Actions di questo repository, all'etichetta \`v9.9.9\` (commit \`0123456\`), sha256 \`${IMPRONTA}\`. Lo stesso file è stato provato con VSCodium ${VERSIONE} su Windows (90 prove verdi) e Ubuntu (91); su macOS non è stato provato, perché GitHub non ha dato la macchina per la prova. Porta l'attestazione della sua provenienza:\n\n\`\`\`\ngh attestation verify AlgoDesign-Code-9.9.9.vsix -R proprietario/repository\n\`\`\`\n`,
    },
  ];
  for (const t of testi) {
    const scritto = testoDellaRelease("Che cosa cambia.\n", t.rapporti, t.d, corsa);
    const buono = scritto === t.atteso;
    if (!buono) sbagliate++;
    console.log(`${buono ? "PASS" : "FAIL"}  sonda «${t.nome}»${buono ? "" : `:\n${scritto}`}`);
  }
  // Controllo negativo del confronto dei testi: lo stesso testo coi numeri di due sistemi scambiati è diverso.
  const scambiati = testoDellaRelease("Che cosa cambia.\n", numerati.map((x, i) => ({ r: { ...x.r, fatte: 92 - i } })), NESSUNA, corsa);
  const distingue = scambiati !== testi[0]!.atteso;
  if (!distingue) sbagliate++;
  console.log(`${distingue ? "PASS" : "FAIL"}  sonda «il confronto del testo vede due numeri scambiati»`);
  const rossi = casi.filter((c) => c.atteso.length > 0).length;
  console.log(`sonde: ${casi.length} (${casi.length - rossi} verdi, ${rossi} rami rossi), testi ${testi.length + 1}; sbagliate ${sbagliate}; attese per sistema ${SISTEMI.map((s) => `${s} ${PREVISTE[s]}`).join(", ")}`);
  console.log(`ESITO: ${sbagliate === 0 ? "VERDE" : "ROSSO"}`);
  return sbagliate === 0 ? 0 : 1;
}

if (import.meta.main) {
  const testo = { type: "string" } as const;
  const { values: o } = parseArgs({
    args: Bun.argv.slice(2),
    options: { cartella: testo, sha256: testo, sonde: { type: "boolean" }, togli: testo, "senza-macchina": testo, nota: testo, uscita: testo, pacchetto: testo, corsa: testo, etichetta: testo, commit: testo, repository: testo },
    strict: true,
  });
  if (o.sonde) process.exit(sonde());
  const cartella = o.cartella ?? fermo("--cartella vuole la cartella dei rapporti");
  const atteso = o.sha256 ?? fermo("--sha256 vuole l'impronta del pacchetto costruito");
  if (!/^[0-9a-f]{64}$/.test(atteso)) fermo(`--sha256 non è un'impronta: ${atteso}`);
  const d: Dichiarazioni = { togli: (o.togli ?? "").trim(), senzaMacchina: (o["senza-macchina"] ?? "").trim() };
  const rapporti = leggi(cartella);
  console.log(`rapporti: ${rapporti.length} [${rapporti.map((x) => x.f).join(", ")}]; sistemi dichiarati ${SISTEMI.length} [${SISTEMI.join(", ")}]; togli «${d.togli}», senza macchina «${d.senzaMacchina}»`);
  for (const { r } of rapporti) console.log(`  ${r.sistema}: ${r.esito}, prove ${r.fatte}/${r.previste} (attese ${PREVISTE[r.sistema] ?? "?"}), fallite ${r.fallite.length}, editor ${r.editor ?? "non aperto"}, pacchetto ${r.pacchetto.sha256.slice(0, 12)}`);
  const motivi = motiviDelConteggio(rapporti, atteso, d);
  for (const m of motivi) console.log(`ROSSO: ${m}`);
  if (motivi.length === 0 && d.senzaMacchina !== "") console.log(`senza macchina, per dichiarazione: ${NELLA_NOTA[DALLA_MATRICE[d.senzaMacchina]!]}`);
  if (motivi.length === 0 && o.nota !== undefined) {
    const uscita = o.uscita ?? fermo("--uscita vuole il file del testo della release");
    const voluto = (nome: string, v: string | undefined) => (v === undefined || v === "" ? fermo(`--${nome} vuole un valore`) : v);
    const c: Corsa = { pacchetto: voluto("pacchetto", o.pacchetto), corsa: voluto("corsa", o.corsa), etichetta: voluto("etichetta", o.etichetta), commit: voluto("commit", o.commit), sha256: atteso, repository: voluto("repository", o.repository) };
    const testoDellaNota = readFileSync(o.nota, "utf8");
    if (/provat|attestazion/i.test(testoDellaNota)) {
      console.log(`ROSSO: la nota ${o.nota} racconta la corsa da sé: lo scrive il conteggio`);
      console.log("ESITO: ROSSO");
      process.exit(1);
    }
    const scritto = testoDellaRelease(testoDellaNota, rapporti, d, c);
    writeFileSync(uscita, scritto);
    console.log(`testo della release in ${uscita}:\n${scritto}`);
  }
  console.log(`ESITO: ${motivi.length === 0 ? "VERDE" : "ROSSO"}`);
  process.exit(motivi.length === 0 ? 0 : 1);
}

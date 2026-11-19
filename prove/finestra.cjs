// Gira dentro l'editor: fa ciò che fa lo studente sulla pagina del flowchart (le scelte del codice, le segnalazioni, la sola
// lettura, l'aggiornamento dal disco, il disegno, la pagina che torna in primo piano, «Salva il codice come…») e scrive che cosa
// ha visto. Non giudica nulla: i confronti stanno in `prova.ts`. La pagina si legge dal suo DOM con i comandi di prova
// dell'estensione, che esistono solo con ALGO_PROVA=1; i clic sono clic veri sugli elementi della pagina, i tasti arrivano ai
// suoi gestori.

const { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const vscode = require("vscode");

const { ALGO_FILE, ALGO_ERRATO, ALGO_FUNZIONI, ALGO_PARENTESI, ALGO_AVVISO, ALGO_USCITA } = process.env;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** La fotografia della pagina attiva (con un clic prima, o un tasto, se c'è il selettore); null se la pagina non risponde. */
async function foto(selettore, tasto) {
  try {
    return (await vscode.commands.executeCommand("algo.prova.fotografia", selettore, tasto)).fotografia;
  } catch {
    return null;
  }
}

/** Attende una fotografia che soddisfi la condizione; restituisce l'ultima vista e i millisecondi. */
async function aspetta(condizione, tetto = 8000) {
  const inizio = Date.now();
  let f = null;
  while (Date.now() - inizio < tetto) {
    f = await foto();
    if (f !== null && condizione(f)) return { f, ms: Date.now() - inizio, riuscita: true };
    await pausa(40);
  }
  return { f, ms: Date.now() - inizio, riuscita: false };
}

/** Un clic sulla pagina e lo stato nuovo che ne segue (una versione più alta). Il clic su una scelta (linguaggio o lingua)
 *  aspetta lo stato CON quella scelta: un aggiornamento venuto d'altrove (per esempio un avviso tardo dell'osservatore dei file)
 *  alza la versione prima che la scelta arrivi all'estensione, e il flowchart aperto subito dopo leggeva l'ultima scelta
 *  vecchia (visto una volta su macOS, nella corsa dell'etichetta, verde nella corsa precedente sullo stesso commit). */
async function clic(selettore) {
  const prima = await foto();
  const f = await foto(selettore);
  if (f === null) throw new Error(`clic non riuscito su ${selettore}`);
  const scelta = /^\[data-scelta="([^"]+)"\]$/.exec(selettore)?.[1];
  const conLaScelta = (g) => scelta === undefined || g.scelta?.linguaggio === scelta || g.scelta?.lingua === scelta;
  return (await aspetta((g) => g.versione > (prima?.versione ?? -1) && conLaScelta(g))).f;
}

const vistaAttiva = () => {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  return input instanceof vscode.TabInputCustom ? { tipo: "pagina", viewType: input.viewType, uri: input.uri.toString() } : input instanceof vscode.TabInputText ? { tipo: "testo", uri: input.uri.toString() } : { tipo: String(input) };
};

/** Apre il file come lo apre un doppio clic: l'editor predefinito per quel file. */
async function apri(file) {
  await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(file));
  // La prima apertura su una macchina lenta può superare gli 8 secondi (misurato su macOS nelle Actions).
  return (await aspetta((f) => f.versione > 0 && f.titolo !== "", 20000)).f;
}

/** La pagina a una colonna: lo zoom dell'editor, un passo alla volta, finché la pagina è sotto i 760 pixel (al più sei passi); poi
 *  la pagina scorsa fino in fondo e ciò che mostra. Lo zoom torna com'era. */
async function aUnaColonna() {
  let passi = 0;
  for (; passi < 6 && ((await foto())?.disegno.larghezzaPagina ?? 0) > 760; passi++) {
    await vscode.commands.executeCommand("workbench.action.zoomIn");
    await pausa(600);
  }
  await pausa(300);
  let f = null;
  try {
    f = (await vscode.commands.executeCommand("algo.prova.scorri")).fotografia;
  } catch {
    f = null;
  }
  await vscode.commands.executeCommand("workbench.action.zoomReset");
  await pausa(600);
  return { passi, f };
}

/** Riscrive il file come AlgoDesign: un temporaneo nuovo nella stessa cartella, rinominato sopra. */
function salvaComeAlgoDesign(file, testo) {
  const temporaneo = `${file}.${process.pid}-1.tmp`;
  writeFileSync(temporaneo, testo);
  renameSync(temporaneo, file);
}

exports.run = async () => {
  // L'estensione attivata prima di tutto: i comandi di prova esistono solo dopo. Se la pagina poi non si apre, lo dice la prova
  // dell'apertura, non un comando «non trovato» (misurato su macOS nelle Actions: attivazione oltre l'attesa).
  await vscode.extensions.getExtension("gilan65.algodesign-code")?.activate();
  // Il secondo avvio, con l'estensione il cui file del nucleo era già cambiato prima dell'avvio: solo la pagina del primo
  // flowchart, come la vede lo studente, e i byte del file del nucleo letti da qui (che nessuno l'abbia rimesso).
  if (process.env.ALGO_NUCLEO_CAMBIATO === "1") {
    const libreria = join(vscode.extensions.getExtension("gilan65.algodesign-code").extensionPath, "dist", "libreria.cjs");
    const pagina = await apri(ALGO_FILE);
    writeFileSync(ALGO_USCITA, JSON.stringify({ lingua: vscode.env.language, pagina, byte: readFileSync(libreria).length }));
    return;
  }
  const esiti = { lingua: vscode.env.language };
  const originale = readFileSync(ALGO_FILE, "utf8");
  const originaleErrato = readFileSync(ALGO_ERRATO);

  // L'apertura e la prima volta (C in italiano).
  esiti.prima = await apri(ALGO_FILE);
  esiti.vista = vistaAttiva();
  esiti.colori = await vscode.commands.executeCommand("algo.prova.colori");

  // Le scelte del codice: «Python», poi «inglese».
  esiti.python = await clic('[data-scelta="python"]');
  esiti.inglese = await clic('[data-scelta="en"]');

  // La scelta ricordata: un flowchart mai aperto prende l'ultima scelta; tornato a C e italiano, l'altro tiene la sua.
  esiti.erratoPrima = await apri(ALGO_ERRATO);
  await clic('[data-scelta="c"]');
  esiti.errato = await clic('[data-scelta="it"]');
  esiti.problemiErrato = vscode.languages.getDiagnostics(vscode.Uri.file(ALGO_ERRATO)).map((d) => ({ messaggio: d.message, gravita: d.severity }));
  // Il clic sulla segnalazione porta al blocco (la scheda della sua funzione e il posto del disegno).
  await foto(".voce[data-funzione]");
  esiti.dopoIlClic = (await aspetta((f) => f.fuoco === "disegno", 3000)).f;

  // La sola lettura: la pagina attiva, si «digita» una lettera; nulla cambia, e nessun documento diventa sporco.
  try {
    await vscode.commands.executeCommand("type", { text: "x" });
  } catch (e) {
    esiti.digitazioneSullaPagina = String(e);
  }
  await pausa(300);
  esiti.dopoLaDigitazione = await foto();
  esiti.erratoIntatto = Buffer.compare(readFileSync(ALGO_ERRATO), originaleErrato) === 0;
  esiti.sporchiDopoLaDigitazione = vscode.workspace.textDocuments.filter((d) => d.isDirty).map((d) => d.uri.toString());

  // «Apri il file come testo»: il JSON in una vista di sola lettura; digitando non cambia.
  await foto("#apri-come-testo");
  // La scheda di testo diventa attiva prima del suo editor (misurato: una corsa su tre): si aspetta l'editor della vista.
  const laVista = (e) => e !== undefined && e.document.uri.scheme === "algo-testo";
  for (let i = 0; i < 100 && !(vistaAttiva().tipo === "testo" && laVista(vscode.window.activeTextEditor)); i++) await pausa(50);
  esiti.comeTesto = vistaAttiva();
  const vista = vscode.window.activeTextEditor;
  esiti.schemaDelTesto = vista?.document.uri.scheme ?? null;
  esiti.testoAperto = vista?.document.getText() ?? null;
  esiti.idLinguaggioDelTesto = vista?.document.languageId ?? null;
  await vscode.commands.executeCommand("type", { text: "x" });
  esiti.vistaInvariata = vista !== undefined && vista.document.getText() === esiti.testoAperto && !vista.document.isDirty;
  // Controllo positivo: la stessa digitazione su un documento vero (senza titolo) lo cambia.
  const vero = await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ content: "", language: "plaintext" }), { preview: false });
  await vscode.commands.executeCommand("type", { text: "x" });
  esiti.controlloDigitazione = vero.document.getText() === "x";
  await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
  // Che il file non resti «testo» dopo la vista qui non si prova: in modalità di prova l'editor non lo ricorda (misurato).

  // Di nuovo il primo file, con tutte le schede chiuse (la pagina rinasce): torna con la sua scelta (Python, inglese), non con
  // l'ultima fatta sull'altro (C, italiano).
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  esiti.riaperto = await apri(ALGO_FILE);
  esiti.problemiFile = vscode.languages.getDiagnostics(vscode.Uri.file(ALGO_FILE)).length;

  // Il salvataggio di AlgoDesign; la pagina si aggiorna da sola, letta dal disco.
  const alterato = originale.replace('"name": "lettura-intero"', '"name": "lettura-intera"');
  esiti.alteratoDiverso = alterato !== originale;
  const v0 = esiti.riaperto.versione;
  salvaComeAlgoDesign(ALGO_FILE, alterato);
  esiti.aggiornamento = await aspetta((f) => f.versione > v0 && f.titolo === "lettura-intera", 3000);

  // Controllo positivo: con l'osservatore spento, lo stesso salvataggio non arriva alla pagina.
  await vscode.commands.executeCommand("algo.prova.osservatore", false);
  const v1 = esiti.aggiornamento.f?.versione ?? -1;
  salvaComeAlgoDesign(ALGO_FILE, originale);
  esiti.senzaOsservatore = await aspetta((f) => f.versione > v1, 1500);
  await vscode.commands.executeCommand("algo.prova.osservatore", true);
  salvaComeAlgoDesign(ALGO_FILE, originale);
  esiti.rimesso = (await aspetta((f) => f.titolo === "lettura-intero", 3000)).f;
  esiti.fileIntatto = readFileSync(ALGO_FILE, "utf8") === originale;

  // --- Il disegno. Il flowchart con l'errore, mai toccato nella vista: adattato, metà larghezza, il riquadro aperto.
  const ds = (esiti.disegno = {});
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  ds.errato = await apri(ALGO_ERRATO);
  // Dal bollino alla voce, col clic e con Invio; dalla voce al blocco.
  ds.dalBollino = await foto("#disegno g[data-bollino]");
  ds.dalBollinoConInvio = await foto("#disegno g[data-bollino]", { tasto: "Enter" });
  await foto(".voce[data-funzione]");
  ds.dallaVoce = (await aspetta((f) => f.disegno.evidenziato !== null && f.disegno.staNelFoglio, 3000)).f;
  // Il riquadro che si chiude: il codice a tutta larghezza, le segnalazioni sopra; il clic su una voce lo riapre sul blocco.
  ds.chiuso = await foto("#riquadro");
  await foto(".voce[data-funzione]");
  ds.riapertoDallaVoce = (await aspetta((f) => !f.disegno.chiuso && f.disegno.evidenziato !== null, 3000)).f;
  // Il divisore con la tastiera: un passo a destra.
  ds.divisore = await foto("#divisore", { tasto: "ArrowRight" });
  // La misura fissa della conformità: l'SVG della pagina si confronta coi byte del pacchetto fuori dall'editor.
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: true, carattere: null });
  ds.fissaErrato = (await aspetta((f) => f.disegno.carattere === null && f.disegno.svg !== null, 3000)).f;
  // Controllo positivo: un carattere che il canvas ignora (una virgoletta non chiusa) non disegna, e lo dice.
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: false, carattere: '"non chiuso' });
  ds.carattereIgnorato = (await aspetta((f) => f.disegno.svg === null, 3000)).f;
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: false, carattere: null });
  ds.carattereRimesso = (await aspetta((f) => f.disegno.svg !== null, 3000)).f;
  // Il nucleo della pagina che si ferma aprendo il flowchart, poi disegnandolo: la pagina dice che AlgoDesign si è fermato, e
  // senza la prova disegna di nuovo.
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: false, carattere: null, fermo: "apri" });
  ds.fermoAprendo = (await aspetta((f) => f.disegno.svg === null, 3000)).f;
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: false, carattere: null });
  ds.fermoAprendoRimesso = (await aspetta((f) => f.disegno.svg !== null, 3000)).f;
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: false, carattere: null, fermo: "disegna" });
  ds.fermoDisegnando = (await aspetta((f) => f.disegno.svg === null, 3000)).f;
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: false, carattere: null });
  ds.fermoRimesso = (await aspetta((f) => f.disegno.svg !== null, 3000)).f;

  // Il flowchart con più funzioni, mai aperto: il divisore dell'ultimo, lo zoom adattato.
  ds.funzioni = await apri(ALGO_FUNZIONI);
  // Ogni scheda, nelle due lingue, con la misura fissa.
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: true, carattere: null });
  ds.fisse = [];
  for (const [i, lingua] of ["it", "en"].entries()) {
    const ora = await foto();
    if (!ora?.lingue[i]?.attivo) await clic(`[data-scelta="${lingua}"]`);
    for (const f of ds.funzioni?.disegno ? ["f1", "f2", "f3", "f4", "f5", "f6"] : []) {
      if ((await foto(`[role=tab][data-funzione="${f}"]`)) === null) continue;
      const dopo = await foto();
      ds.fisse.push({ lingua, funzione: f, svg: dopo?.disegno.svg ?? null, attiva: dopo?.funzioni.find((x) => x.attiva)?.nome ?? null });
    }
  }
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: false, carattere: null });
  await foto('[role=tab][data-funzione="f1"]');
  ds.primaDelloZoom = await foto();
  // Lo zoom: Ingrandisci, Torna al 100%, Riduci, Adatta alla finestra, Torna indietro.
  ds.zoom = [];
  for (const sel of ["#zoom-ingrandisci", "#zoom-percento", "#zoom-riduci", "#zoom-adatta", "#zoom-adatta"]) {
    await foto(sel);
    const f = await foto();
    ds.zoom.push({ comando: sel, scala: f?.disegno.scala, adattata: f?.disegno.adattata, sta: f?.disegno.staNelFoglio, nomi: f?.disegno.zoom });
  }
  ds.divisoreFunzioni = await foto("#divisore", { tasto: "ArrowRight" });
  await pausa(300);
  // Riaperti tutti e due: ciascuno con la sua vista.
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  ds.erratoRiaperto = await apri(ALGO_ERRATO);
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  ds.funzioniRiaperto = await apri(ALGO_FUNZIONI);

  // --- Il clic sulla scheda di una funzione porta il codice alla sua definizione; «Programma principale» a main. Il codice in C
  // e in italiano, come lo vede la prova fuori dall'editor.
  const tp = (esiti.tenuta = {});
  if (!ds.funzioniRiaperto?.linguaggi.find((x) => x.nome === "C")?.attivo) await clic('[data-scelta="c"]');
  if (!(await foto())?.lingue[0]?.attivo) await clic('[data-scelta="it"]');
  await pausa(400);
  await foto('[role=tab][data-funzione="f2"]');
  tp.allaFunzione = (await aspetta((f) => f.funzioni[1]?.attiva === true, 3000)).f;
  await pausa(400);
  tp.allaFunzione = await foto();
  await foto('[role=tab][data-funzione="f1"]');
  await pausa(400);
  tp.allaPrincipale = await foto();
  // --- La pagina che torna in primo piano: zoom, divisore e funzione cambiati, un'altra scheda nello stesso gruppo, e di nuovo la
  // pagina, rinata (un'altra nascita) e com'era.
  await foto('[role=tab][data-funzione="f2"]');
  await pausa(300);
  await foto("#zoom-ingrandisci");
  await foto("#divisore", { tasto: "ArrowRight" });
  await pausa(400);
  tp.prima = await foto();
  await vscode.commands.executeCommand("workbench.action.keepEditor");
  const altra = join(dirname(ALGO_FILE), "altra scheda.txt");
  writeFileSync(altra, "un'altra scheda nello stesso gruppo\n");
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(altra), { preview: false, viewColumn: vscode.ViewColumn.Active });
  await pausa(800);
  tp.altraAttiva = vistaAttiva().tipo;
  tp.gruppi = vscode.window.tabGroups.all.length;
  await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(ALGO_FUNZIONI));
  tp.tornata = (await aspetta((f) => f.nascita !== tp.prima?.nascita && f.versione > 0 && f.titolo !== "", 20000)).f;
  await pausa(600);
  tp.tornata = (await foto()) ?? tp.tornata;

  // Controllo positivo del pacchetto nella pagina: un byte in più nel file del nucleo dell'estensione, la pagina riaperta non lo
  // esegue (l'impronta non torna); rimesso il file, sì.
  const libreria = join(vscode.extensions.getExtension("gilan65.algodesign-code").extensionPath, "dist", "libreria.cjs");
  const byte = readFileSync(libreria);
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  writeFileSync(libreria, Buffer.concat([byte, Buffer.from("\n")]));
  ds.nucleoMutato = await apri(ALGO_FILE);
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  writeFileSync(libreria, byte);
  ds.nucleoRimesso = await apri(ALGO_FILE);
  ds.nucleoIntatto = Buffer.compare(readFileSync(libreria), byte) === 0;

  // --- Un flowchart col nome che ha le parentesi dei modelli dei file (`[1]`, `{a}`) e una riga lunga: il codice va a capo, e
  // dopo il salvataggio di AlgoDesign la pagina si aggiorna da sola (l'osservatore legge il nome alla lettera).
  const pa = (esiti.parentesi = {});
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  const originaleParentesi = readFileSync(ALGO_PARENTESI, "utf8");
  pa.prima = await apri(ALGO_PARENTESI);
  const cambiato = originaleParentesi.replace('"name": "riga-lunga"', '"name": "riga-lunga-cambiata"');
  pa.cambiatoDiverso = cambiato !== originaleParentesi;
  const vp = pa.prima?.versione ?? -1;
  salvaComeAlgoDesign(ALGO_PARENTESI, cambiato);
  pa.aggiornamento = await aspetta((f) => f.versione > vp && f.titolo === "riga-lunga-cambiata", 3000);
  salvaComeAlgoDesign(ALGO_PARENTESI, originaleParentesi);
  pa.rimesso = (await aspetta((f) => f.titolo === "riga-lunga", 3000)).f;
  pa.intatto = readFileSync(ALGO_PARENTESI, "utf8") === originaleParentesi;

  // --- Un flowchart con un avviso e nessun errore: in «Problemi» come avviso, e il codice c'è.
  const av = (esiti.avviso = {});
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  av.pagina = await apri(ALGO_AVVISO);
  for (let i = 0; i < 40 && vscode.languages.getDiagnostics(vscode.Uri.file(ALGO_AVVISO)).length === 0; i++) await pausa(50);
  av.problemi = vscode.languages.getDiagnostics(vscode.Uri.file(ALGO_AVVISO)).map((d) => ({ messaggio: d.message, gravita: d.severity }));

  // --- «Salva il codice come…». La finestra di Windows la sostituiscono le risposte preparate (nelle Actions nessuno preme
  // «Salva»): un percorso, o null per «Annulla». Le domande che le arrivano dicono se e quando si è aperta.
  const sv = (esiti.salva = {});
  const fileC = join(dirname(ALGO_FILE), "lettura-intero.c");
  const fileC2 = join(dirname(ALGO_FILE), "lettura-intero-2.c");
  for (const f of [fileC, fileC2]) rmSync(f, { force: true });
  const domande = async () => (await vscode.commands.executeCommand("algo.prova.dialogo")).domande.length;
  const rispondi = (r) => vscode.commands.executeCommand("algo.prova.dialogo", r);
  const leggi = (f) => (existsSync(f) ? readFileSync(f, "utf8") : null);
  /** Lo studente modifica il file salvato nell'editor e lo salva. */
  const modifica = async (f) => {
    const d = await vscode.workspace.openTextDocument(f);
    const m = new vscode.WorkspaceEdit();
    m.insert(d.uri, new vscode.Position(0, 0), "// la mia modifica\n");
    await vscode.workspace.applyEdit(m);
    await d.save();
  };
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  sv.prima = await apri(ALGO_FILE);
  // Il codice in C e in italiano, come nello scenario (il file ricorda Python e inglese dalle prove sopra).
  if (!sv.prima?.linguaggi.find((x) => x.nome === "C")?.attivo) await clic('[data-scelta="c"]');
  if (!(await foto())?.lingue[0]?.attivo) await clic('[data-scelta="it"]');
  sv.inC = await foto();
  sv.colonnaDellaPagina = vscode.window.tabGroups.activeTabGroup.viewColumn;

  // 1. Il file non c'è: la finestra, «Salva».
  await rispondi([fileC]);
  await foto("#salva-codice");
  sv.salvato = (await aspetta((f) => f.salvataggio.riga !== null, 5000)).f;
  sv.domandaNuovo = (await vscode.commands.executeCommand("algo.prova.dialogo")).domande.slice(0);
  for (let i = 0; i < 50 && vscode.window.activeTextEditor?.document.uri.fsPath.toLowerCase() !== fileC.toLowerCase(); i++) await pausa(100);
  sv.attivo = { file: vscode.window.activeTextEditor?.document.uri.fsPath ?? null, colonna: vscode.window.activeTextEditor?.viewColumn ?? null };
  sv.scritto = leggi(fileC);

  // 2. Lo studente lo modifica; «Salva il codice come…» di nuovo: l'avviso, prima della finestra.
  await modifica(fileC);
  sv.modificato = leggi(fileC);
  let n = await domande();
  await rispondi([]);
  await foto("#salva-codice");
  sv.avviso = (await aspetta((f) => f.salvataggio.avviso !== null, 5000)).f;
  sv.finestreConLAvviso = (await domande()) - n;
  // A una colonna, con l'avviso fra la barra e il codice: la pagina scorsa fino in fondo, la barra resta in cima.
  sv.colonna = await aUnaColonna();
  // 2a. «Salva con un altro nome»: la finestra propone il primo nome libero.
  n = await domande();
  await rispondi([fileC2]);
  await foto("#salva-con-altro-nome");
  sv.altroNome = (await aspetta((f) => (f.salvataggio.riga ?? "").includes("lettura-intero-2.c"), 5000)).f;
  sv.domandaAltroNome = (await vscode.commands.executeCommand("algo.prova.dialogo")).domande.slice(n);
  sv.scritto2 = leggi(fileC2);
  sv.modificatoDopoAltroNome = leggi(fileC);
  // 2b. Di nuovo l'avviso, «Sostituisci»: nessuna finestra.
  n = await domande();
  await rispondi([]);
  await foto("#salva-codice");
  await aspetta((f) => f.salvataggio.avviso !== null, 5000);
  await foto("#sostituisci");
  sv.sostituito = (await aspetta((f) => f.salvataggio.avviso === null && (f.salvataggio.riga ?? "").includes("lettura-intero.c"), 5000)).f;
  sv.finestreConSostituisci = (await domande()) - n;
  sv.scrittoDopoSostituisci = leggi(fileC);

  // 3. Il file c'è ed è uguale: la finestra (nessun avviso); «Annulla» nella finestra non scrive nulla.
  n = await domande();
  await rispondi([null]);
  await foto("#salva-codice");
  await pausa(1500);
  sv.uguale = await foto();
  sv.finestreConUguale = (await domande()) - n;
  sv.scrittoDopoAnnulla = leggi(fileC);

  // 4. «Annulla» nell'avviso: l'avviso sparisce, il file resta com'è, il fuoco torna al comando.
  await modifica(fileC);
  sv.modificato2 = leggi(fileC);
  await rispondi([]);
  await foto("#salva-codice");
  await aspetta((f) => f.salvataggio.avviso !== null, 5000);
  sv.annullato = await foto("#annulla-salvataggio");
  sv.dopoLAnnulla = leggi(fileC);

  // 5. In Python: il nome .py col suo tipo; il codice cambia, la riga del salvataggio sparisce.
  await clic('[data-scelta="python"]');
  sv.python = await foto();
  n = await domande();
  await rispondi([null]);
  await foto("#salva-codice");
  await pausa(1000);
  sv.domandaPython = (await vscode.commands.executeCommand("algo.prova.dialogo")).domande.slice(n);

  // 6. In un'altra cartella: la pagina dice il percorso intero.
  const altraCartella = join(dirname(ALGO_FILE), "altra  cartella");
  mkdirSync(altraCartella, { recursive: true });
  sv.fileAltrove = join(altraCartella, "lettura-intero.py");
  await rispondi([sv.fileAltrove]);
  await foto("#salva-codice");
  sv.altrove = (await aspetta((f) => (f.salvataggio.riga ?? "") !== "", 5000)).f;
  sv.scrittoAltrove = leggi(sv.fileAltrove);
  // 7. Un posto che non si può scrivere (la cartella stessa al posto del file): la pagina dice quale file e che cosa fare, senza il
  // motivo tecnico.
  sv.nonScrivibile = altraCartella;
  await rispondi([altraCartella]);
  await foto("#salva-codice");
  sv.errore = (await aspetta((f) => (f.salvataggio.riga ?? "").includes("«"), 5000)).f;
  await rispondi(null);

  writeFileSync(ALGO_USCITA, JSON.stringify(esiti));
};

// Gira dentro l'editor: fa ciò che fa lo studente sulla pagina del flowchart (gli scenari S-E3a…d e S-E11) e scrive che cosa ha
// visto. Non giudica nulla: i confronti stanno in `prova.ts`. La pagina si legge dal suo DOM con i comandi di prova dell'estensione,
// che esistono solo con ALGO_PROVA=1; i clic sono clic veri sugli elementi della pagina, i tasti arrivano ai suoi gestori.

const { readFileSync, renameSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const vscode = require("vscode");

const { ALGO_FILE, ALGO_ERRATO, ALGO_FUNZIONI, ALGO_USCITA } = process.env;
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

/** Un clic sulla pagina e lo stato nuovo che ne segue (una versione più alta). */
async function clic(selettore) {
  const prima = await foto();
  const f = await foto(selettore);
  if (f === null) throw new Error(`clic non riuscito su ${selettore}`);
  return (await aspetta((g) => g.versione > (prima?.versione ?? -1))).f;
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
  const esiti = { lingua: vscode.env.language };
  const originale = readFileSync(ALGO_FILE, "utf8");
  const originaleErrato = readFileSync(ALGO_ERRATO);

  // L'apertura e la prima volta (C in italiano).
  esiti.prima = await apri(ALGO_FILE);
  esiti.vista = vistaAttiva();
  esiti.colori = await vscode.commands.executeCommand("algo.prova.colori");

  // S-E3a: «Python», poi «inglese».
  esiti.python = await clic('[data-scelta="python"]');
  esiti.inglese = await clic('[data-scelta="en"]');

  // RU-02: un flowchart mai aperto prende l'ultima scelta; tornato a C e italiano, l'altro tiene la sua.
  esiti.erratoPrima = await apri(ALGO_ERRATO);
  await clic('[data-scelta="c"]');
  esiti.errato = await clic('[data-scelta="it"]');
  esiti.problemiErrato = vscode.languages.getDiagnostics(vscode.Uri.file(ALGO_ERRATO)).map((d) => ({ messaggio: d.message, gravita: d.severity }));
  // S-E3c: il clic sulla segnalazione porta al blocco (oggi: la scheda della sua funzione e il posto del disegno).
  await foto(".voce[data-funzione]");
  esiti.dopoIlClic = (await aspetta((f) => f.fuoco === "disegno", 3000)).f;

  // S-E3d: la pagina attiva, si «digita» una lettera; nulla cambia, e nessun documento diventa sporco.
  try {
    await vscode.commands.executeCommand("type", { text: "x" });
  } catch (e) {
    esiti.digitazioneSullaPagina = String(e);
  }
  await pausa(300);
  esiti.dopoLaDigitazione = await foto();
  esiti.erratoIntatto = Buffer.compare(readFileSync(ALGO_ERRATO), originaleErrato) === 0;
  esiti.sporchiDopoLaDigitazione = vscode.workspace.textDocuments.filter((d) => d.isDirty).map((d) => d.uri.toString());

  // «Apri come testo»: il JSON in una vista di sola lettura; digitando non cambia.
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

  // S-E3b: il salvataggio di AlgoDesign; la pagina si aggiorna da sola, letta dal disco.
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

  // --- E11, il disegno. Il flowchart con l'errore, mai toccato nella vista: adattato, metà larghezza, il riquadro aperto.
  const e11 = (esiti.e11 = {});
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  e11.errato = await apri(ALGO_ERRATO);
  // Dal bollino alla voce, col clic e con Invio; dalla voce al blocco.
  e11.dalBollino = await foto("#disegno g[data-bollino]");
  e11.dalBollinoConInvio = await foto("#disegno g[data-bollino]", { tasto: "Enter" });
  await foto(".voce[data-funzione]");
  e11.dallaVoce = (await aspetta((f) => f.disegno.evidenziato !== null && f.disegno.staNelFoglio, 3000)).f;
  // Il riquadro che si chiude: il codice a tutta larghezza, le segnalazioni sopra; il clic su una voce lo riapre sul blocco.
  e11.chiuso = await foto("#riquadro");
  await foto(".voce[data-funzione]");
  e11.riapertoDallaVoce = (await aspetta((f) => !f.disegno.chiuso && f.disegno.evidenziato !== null, 3000)).f;
  // Il divisore con la tastiera: un passo a destra.
  e11.divisore = await foto("#divisore", { tasto: "ArrowRight" });
  // La misura fissa della conformità: l'SVG della pagina si confronta coi byte del pacchetto fuori dall'editor.
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: true, carattere: null });
  e11.fissaErrato = (await aspetta((f) => f.disegno.carattere === null && f.disegno.svg !== null, 3000)).f;
  // Controllo positivo: un carattere che il canvas ignora (una virgoletta non chiusa) non disegna, e lo dice.
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: false, carattere: '"non chiuso' });
  e11.carattereIgnorato = (await aspetta((f) => f.disegno.svg === null, 3000)).f;
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: false, carattere: null });
  e11.carattereRimesso = (await aspetta((f) => f.disegno.svg !== null, 3000)).f;

  // Il flowchart con più funzioni, mai aperto: il divisore dell'ultimo, lo zoom adattato.
  e11.funzioni = await apri(ALGO_FUNZIONI);
  // Ogni scheda, nelle due lingue, con la misura fissa.
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: true, carattere: null });
  e11.fisse = [];
  for (const [i, lingua] of ["it", "en"].entries()) {
    const ora = await foto();
    if (!ora?.lingue[i]?.attivo) await clic(`[data-scelta="${lingua}"]`);
    for (const f of e11.funzioni?.disegno ? ["f1", "f2", "f3", "f4", "f5", "f6"] : []) {
      if ((await foto(`[role=tab][data-funzione="${f}"]`)) === null) continue;
      const dopo = await foto();
      e11.fisse.push({ lingua, funzione: f, svg: dopo?.disegno.svg ?? null, attiva: dopo?.funzioni.find((x) => x.attiva)?.nome ?? null });
    }
  }
  await vscode.commands.executeCommand("algo.prova.disegno", { misuraFissa: false, carattere: null });
  await foto('[role=tab][data-funzione="f1"]');
  e11.primaDelloZoom = await foto();
  // Lo zoom: Ingrandisci, Torna al 100%, Riduci, Adatta alla finestra, Torna indietro.
  e11.zoom = [];
  for (const sel of ["#zoom-ingrandisci", "#zoom-percento", "#zoom-riduci", "#zoom-adatta", "#zoom-adatta"]) {
    await foto(sel);
    const f = await foto();
    e11.zoom.push({ comando: sel, scala: f?.disegno.scala, adattata: f?.disegno.adattata, sta: f?.disegno.staNelFoglio, nomi: f?.disegno.zoom });
  }
  e11.divisoreFunzioni = await foto("#divisore", { tasto: "ArrowRight" });
  await pausa(300);
  // Riaperti tutti e due: ciascuno con la sua vista.
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  e11.erratoRiaperto = await apri(ALGO_ERRATO);
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  e11.funzioniRiaperto = await apri(ALGO_FUNZIONI);

  // Controllo positivo del pacchetto nella pagina: un byte in più nel file del nucleo dell'estensione, la pagina riaperta non lo
  // esegue (l'impronta non torna); rimesso il file, sì.
  const libreria = join(vscode.extensions.getExtension("gilan65.algodesign-code").extensionPath, "dist", "libreria.cjs");
  const byte = readFileSync(libreria);
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  writeFileSync(libreria, Buffer.concat([byte, Buffer.from("\n")]));
  e11.nucleoMutato = await apri(ALGO_FILE);
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  writeFileSync(libreria, byte);
  e11.nucleoRimesso = await apri(ALGO_FILE);
  e11.nucleoIntatto = Buffer.compare(readFileSync(libreria), byte) === 0;

  writeFileSync(ALGO_USCITA, JSON.stringify(esiti));
};

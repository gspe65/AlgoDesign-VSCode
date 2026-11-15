// Gira dentro l'editor: fa ciò che fa lo studente sulla pagina del flowchart (gli scenari S-E3a…d) e scrive che cosa ha visto.
// Non giudica nulla: i confronti stanno in `prova.ts`. La pagina si legge dal suo DOM con i comandi di prova dell'estensione, che
// esistono solo con ALGO_PROVA=1; i clic sono clic veri sugli elementi della pagina.

const { readFileSync, renameSync, writeFileSync } = require("node:fs");
const vscode = require("vscode");

const { ALGO_FILE, ALGO_ERRATO, ALGO_USCITA } = process.env;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** La fotografia della pagina attiva (con un clic prima, se c'è il selettore); null se la pagina non risponde. */
async function foto(selettore) {
  try {
    return (await vscode.commands.executeCommand("algo.prova.fotografia", selettore)).fotografia;
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
  return (await aspetta((f) => f.versione > 0 && f.titolo !== "")).f;
}

/** Riscrive il file come AlgoDesign: un temporaneo nuovo nella stessa cartella, rinominato sopra. */
function salvaComeAlgoDesign(file, testo) {
  const temporaneo = `${file}.${process.pid}-1.tmp`;
  writeFileSync(temporaneo, testo);
  renameSync(temporaneo, file);
}

exports.run = async () => {
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

  writeFileSync(ALGO_USCITA, JSON.stringify(esiti));
};

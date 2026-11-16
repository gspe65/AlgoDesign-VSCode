// La pagina del flowchart: un editor personalizzato in sola lettura per i file .algo. L'estensione legge il file dal
// DISCO, calcola il modello col nucleo, scrive «Problemi» e manda lo stato alla pagina; un osservatore del file la
// aggiorna dopo un salvataggio esterno. All'avviso dell'osservatore il documento dell'editor ha ancora il testo vecchio (misura di
// misurato nell'editor): per questo si legge il disco, mai il documento.
//
// La scelta del linguaggio e della lingua si ricorda per flowchart nello stato dell'estensione, legata al percorso
// rispetto alla cartella aperta, e come «ultima» per i flowchart mai aperti; mai nelle impostazioni.

import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import * as vscode from "vscode";
import { LINGUA_INIZIALE, LINGUAGGIO_INIZIALE, linguaggiOfferti, modello, riempi, testiDellInterfaccia, type Libreria, type LinguaDellInterfaccia, type Modello } from "./documento";
import type { DallaPagina, Fotografia, Misura, Prova, Scelta, Stato, VersoLaPagina, Vista } from "./messaggi";
import { altroNome, confronto, estensioneDel, nomeDelCodice } from "./salva";
import { coloriDelTema } from "./tema";
import { valida } from "./vista";

export const TIPO_DELLA_PAGINA = "algo.pagina";
const ULTIMA = "algo.ultimaScelta";
const ULTIMA_VISTA = "algo.ultimaVista";

/** L'impronta (sha256, esadecimale) del file del nucleo dichiarata in nucleo.json, scritta qui dalla costruzione. */
declare const IMPRONTA_DEL_NUCLEO: string;
/** L'attributo `integrity` del file del nucleo nella pagina: il browser lo esegue solo se i suoi byte hanno questa impronta. */
export const INTEGRITA_DEL_NUCLEO = `sha256-${Buffer.from(IMPRONTA_DEL_NUCLEO, "hex").toString("base64")}`;

/** La vista di un flowchart mai aperto: adattato alla finestra (mai oltre il 100%), il riquadro aperto, metà larghezza. */
export const VISTA_INIZIALE: Vista = { scala: 1, adattata: true, scalaPrima: null, chiuso: false, divisore: 50 };

type Aperta = {
  readonly uri: vscode.Uri;
  readonly pannello: vscode.WebviewPanel;
  aggiorna(): Promise<void>;
  manda(m: VersoLaPagina): void;
  readonly attese: Map<number, (f: Fotografia | Misura | null) => void>;
};

export class Pagina implements vscode.CustomReadonlyEditorProvider {
  private readonly aperte = new Set<Aperta>();
  private versione = 0;
  private ultimaFotografia = 0;
  /** Spento solo dalla prova con l'editor, per il suo controllo positivo: senza osservatore l'aggiornamento non arriva. */
  osservatoreAcceso = true;
  /** Solo per la prova con l'editor (nelle Actions nessuno preme «Salva» nella finestra di Windows): le risposte della finestra,
   *  un percorso o null per «Annulla», e le domande che le sono arrivate. Null: la finestra vera. */
  risposteDelDialogo: (string | null)[] | null = null;
  readonly domandeAlDialogo: { readonly file: string; readonly filtri: Record<string, string[]>; readonly titolo: string }[] = [];

  constructor(
    private readonly contesto: vscode.ExtensionContext,
    private readonly libreria: Libreria,
    private readonly problemi: vscode.DiagnosticCollection,
  ) {
    contesto.subscriptions.push(
      vscode.window.onDidChangeActiveColorTheme(() => this.aggiornaTutte()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("algo.pseudocodifica") || e.affectsConfiguration("workbench.colorTheme")) this.aggiornaTutte();
      }),
    );
  }

  private aggiornaTutte(): void {
    for (const a of this.aperte) void a.aggiorna();
  }

  private interfaccia(): LinguaDellInterfaccia {
    return vscode.env.language.toLowerCase().startsWith("it") ? "it" : "en";
  }

  /** La chiave di una cosa ricordata per flowchart (`scelta`, `vista`): il percorso rispetto alla cartella aperta. */
  private chiave(uri: vscode.Uri, cosa: "scelta" | "vista" = "scelta"): string | null {
    return vscode.workspace.getWorkspaceFolder(uri) === undefined ? null : `algo.${cosa}:${vscode.workspace.asRelativePath(uri, false)}`;
  }

  private scelta(uri: vscode.Uri, offerti: readonly string[]): Scelta {
    const chiave = this.chiave(uri);
    const s = (chiave === null ? undefined : this.contesto.workspaceState.get<Scelta>(chiave)) ?? this.contesto.globalState.get<Scelta>(ULTIMA) ?? { linguaggio: LINGUAGGIO_INIZIALE, lingua: LINGUA_INIZIALE };
    // Un linguaggio non più offerto (l'impostazione spenta dopo averlo scelto) torna a quello iniziale.
    return { linguaggio: offerti.includes(s.linguaggio) ? s.linguaggio : LINGUAGGIO_INIZIALE, lingua: s.lingua === "en" ? "en" : "it" };
  }

  private async ricorda(uri: vscode.Uri, s: Scelta): Promise<void> {
    const chiave = this.chiave(uri);
    if (chiave !== null) await this.contesto.workspaceState.update(chiave, s);
    await this.contesto.globalState.update(ULTIMA, s);
  }

  /** La vista ricordata per il flowchart; per uno mai aperto, il riquadro e il divisore dell'ultima, lo zoom adattato. */
  private vista(uri: vscode.Uri): Vista {
    const chiave = this.chiave(uri, "vista");
    const sua = chiave === null ? undefined : this.contesto.workspaceState.get<Vista>(chiave);
    if (sua !== undefined) return valida(sua);
    const ultima = this.contesto.globalState.get<Pick<Vista, "chiuso" | "divisore">>(ULTIMA_VISTA);
    return valida({ ...VISTA_INIZIALE, ...(ultima === undefined ? {} : { chiuso: ultima.chiuso, divisore: ultima.divisore }) });
  }

  private async ricordaVista(uri: vscode.Uri, v: Vista): Promise<void> {
    const chiave = this.chiave(uri, "vista");
    if (chiave !== null) await this.contesto.workspaceState.update(chiave, valida(v));
    await this.contesto.globalState.update(ULTIMA_VISTA, { chiuso: v.chiuso, divisore: valida(v).divisore });
  }

  async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => undefined };
  }

  async resolveCustomEditor(documento: vscode.CustomDocument, pannello: vscode.WebviewPanel): Promise<void> {
    const uri = documento.uri;
    const dist = vscode.Uri.joinPath(this.contesto.extensionUri, "dist");
    pannello.webview.options = { enableScripts: true, localResourceRoots: [dist] };
    const nonce = randomBytes(16).toString("base64");
    const w = pannello.webview;
    // Il nucleo nella pagina è lo stesso file che l'estensione carica (dist/libreria.cjs), eseguito come script classico dopo
    // `module` ed `exports` (nessun eval: la politica dei contenuti lo vieta), con l'impronta dichiarata che il browser verifica
    // prima di eseguirlo. La pagina, uno script `module`, parte dopo e lo trova in `module.exports`.
    const file = (nome: string) => w.asWebviewUri(vscode.Uri.joinPath(dist, nome)).toString();
    pannello.webview.html = `<!doctype html>
<html lang="${this.interfaccia()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}'; img-src ${w.cspSource} data:; font-src ${w.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${file("pagina.css")}">
</head><body><div id="radice"></div>
<script nonce="${nonce}">var module = { exports: {} }; var exports = module.exports;</script>
<script nonce="${nonce}" id="nucleo" src="${file("libreria.cjs")}" integrity="${INTEGRITA_DEL_NUCLEO}" crossorigin="anonymous"></script>
<script type="module" nonce="${nonce}" src="${file("pagina.js")}"></script>
</body></html>`;

    let pronta = false;
    let ultimo: Stato | null = null;
    const vista = this.vista(uri);
    const aperta: Aperta = {
      uri,
      pannello,
      attese: new Map(),
      manda: (m) => void w.postMessage(m),
      aggiorna: async () => {
        const offerti = linguaggiOfferti(vscode.workspace.getConfiguration("algo").get<boolean>("pseudocodifica", false));
        const scelta = this.scelta(uri, offerti);
        const interfaccia = this.interfaccia();
        const testi = testiDellInterfaccia(interfaccia);
        let m: Modello;
        let testo = "";
        try {
          testo = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
          m = modello(this.libreria, testo, scelta.linguaggio, scelta.lingua, interfaccia);
        } catch {
          // Un file che non c'è più (cancellato o in mezzo a un salvataggio) non si legge: la pagina lo dice come un file che non si apre.
          testo = "";
          m = { titolo: basename(uri.fsPath), funzioni: [], segnalazioni: [], codice: { assente: testi.apri } };
        }
        this.problemi.set(
          uri,
          m.segnalazioni.map((s) => {
            const d = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), `${s.testo} ${s.spiegazione}`, s.genere === "errore" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning);
            d.source = "AlgoDesign";
            return d;
          }),
        );
        ultimo = {
          modello: m,
          testi,
          offerti: offerti.map((id) => ({ id, nome: testi.linguaggi[id] ?? id })),
          lingue: (["it", "en"] as const).map((id) => ({ id, nome: testi.lingue[id] })),
          scelta,
          colori: coloriDelTema().colori,
          testo,
          vista,
          versione: ++this.versione,
        };
        if (pronta) aperta.manda({ tipo: "stato", stato: ultimo });
      },
    };
    this.aperte.add(aperta);

    // L'osservatore della sola cartella del file, per il suo nome: AlgoDesign salva con un temporaneo rinominato sopra (un «cambiato»).
    const osservatore = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.joinPath(uri, ".."), basename(uri.fsPath)));
    const dalDisco = () => {
      if (!this.osservatoreAcceso) return;
      void aperta.aggiorna();
      cambioDelTesto.fire(indirizzoDelTesto(uri));
    };
    const iscrizioni = [
      osservatore,
      osservatore.onDidChange(dalDisco),
      osservatore.onDidCreate(dalDisco),
      osservatore.onDidDelete(dalDisco),
      w.onDidReceiveMessage(async (m: DallaPagina) => {
        if (m.tipo === "pronta") {
          pronta = true;
          if (ultimo !== null) aperta.manda({ tipo: "stato", stato: ultimo });
        } else if (m.tipo === "scegli" && ultimo !== null) {
          await this.ricorda(uri, { linguaggio: m.linguaggio ?? ultimo.scelta.linguaggio, lingua: m.lingua ?? ultimo.scelta.lingua });
          await aperta.aggiorna();
        } else if (m.tipo === "vista") await this.ricordaVista(uri, m.vista);
        else if (m.tipo === "apriComeTesto") await apriComeTesto(uri);
        else if ((m.tipo === "salva" || m.tipo === "salvaConAltroNome" || m.tipo === "sostituisci") && ultimo !== null) await this.salva(aperta, ultimo, m.tipo);
        else if (m.tipo === "fotografia" || m.tipo === "misura") {
          aperta.attese.get(m.id)?.(m.tipo === "misura" ? m.misura : m.fotografia);
          aperta.attese.delete(m.id);
        }
      }),
    ];
    pannello.onDidDispose(() => {
      this.aperte.delete(aperta);
      for (const i of iscrizioni) i.dispose();
      if (![...this.aperte].some((a) => a.uri.toString() === uri.toString())) this.problemi.delete(uri);
    });
    await aperta.aggiorna();
  }

  /** «Salva il codice come…»: se il file proposto c'è ed è diverso, prima l'avviso nella pagina (nessuna finestra); se no la finestra
   *  di Windows sulla cartella del flowchart col nome proposto. «Sostituisci» dall'avviso scrive senza finestra (la scelta è già
   *  fatta), «Salva con un altro nome» propone il primo nome libero. Il file scritto si apre accanto alla pagina. */
  private async salva(a: Aperta, s: Stato, come: "salva" | "salvaConAltroNome" | "sostituisci"): Promise<void> {
    if ("assente" in s.modello.codice) return;
    const codice = s.modello.codice.testo;
    const cartella = vscode.Uri.joinPath(a.uri, "..");
    const nome = nomeDelCodice(basename(a.uri.fsPath), s.scelta.linguaggio);
    const proposto = vscode.Uri.joinPath(cartella, nome);
    try {
      let dove: vscode.Uri | undefined = proposto;
      if (come !== "sostituisci") {
        if (come === "salva" && confronto(await testoDi(proposto), codice) === "diverso") {
          a.manda({ tipo: "salvataggio", salvataggio: { stato: "avviso", file: nome } });
          return;
        }
        const iniziale = come === "salva" ? proposto : vscode.Uri.joinPath(cartella, altroNome(nome, (n) => existsSync(join(cartella.fsPath, n))));
        dove = await this.finestraDelSalvataggio(iniziale, s);
        // «Annulla» nella finestra: nulla cambia, nemmeno la pagina.
        if (dove === undefined) return;
      }
      await scrivi(dove, codice);
      await vscode.window.showTextDocument(dove, { viewColumn: vscode.ViewColumn.Beside, preview: false });
      const accanto = vscode.Uri.joinPath(dove, "..").toString() === cartella.toString();
      a.manda({ tipo: "salvataggio", salvataggio: { stato: "salvato", file: accanto ? basename(dove.fsPath) : vscode.workspace.asRelativePath(dove, false), accanto } });
    } catch (e) {
      a.manda({ tipo: "salvataggio", salvataggio: { stato: "errore", testo: riempi(s.testi.nonSalvato, { motivo: e instanceof Error ? e.message : String(e) }) } });
    }
  }

  private finestraDelSalvataggio(iniziale: vscode.Uri, s: Stato): Thenable<vscode.Uri | undefined> {
    const tipo = s.testi.tipiDelCodice[s.scelta.linguaggio] ?? s.testi.tipiDelCodice["pseudocodice"] ?? "";
    const opzioni = { defaultUri: iniziale, filters: { [tipo]: [estensioneDel(s.scelta.linguaggio)] }, title: s.testi.titoloDelSalvataggio };
    if (this.risposteDelDialogo === null) return vscode.window.showSaveDialog(opzioni);
    this.domandeAlDialogo.push({ file: iniziale.fsPath, filtri: opzioni.filters, titolo: opzioni.title });
    const r = this.risposteDelDialogo.shift();
    return Promise.resolve(r === undefined || r === null ? undefined : vscode.Uri.file(r));
  }

  /** La pagina attiva, o l'ultima aperta. */
  private attiva(): Aperta | undefined {
    const tutte = [...this.aperte];
    return tutte.find((a) => a.pannello.active) ?? tutte[tutte.length - 1];
  }

  apriComeTesto(): Thenable<unknown> | undefined {
    const a = this.attiva();
    return a === undefined ? undefined : apriComeTesto(a.uri);
  }

  /** Per la prova con l'editor: la misura fissa o un carattere diverso, nella pagina attiva (ridisegna). */
  prova(p: Prova): void {
    this.attiva()?.manda({ tipo: "prova", prova: p });
  }

  /** Per la prova con l'editor: ciò che la pagina attiva mostra, letto dal suo DOM; con `selettore`, prima un clic lì. */
  fotografia(selettore?: string, tasto?: { tasto: string; maiuscolo?: boolean }): Promise<{ uri: string; fotografia: Fotografia | null }> {
    return this.chiedi((id) => (selettore === undefined ? { tipo: "fotografia", id } : tasto === undefined ? { tipo: "clic", id, selettore } : { tipo: "tasto", id, selettore, tasto: tasto.tasto, maiuscolo: tasto.maiuscolo === true })).then(({ uri, risposta }) => ({ uri, fotografia: risposta as Fotografia | null }));
  }

  /** Per la prova con l'editor: lo zoom e i nomi della finestra della pagina attiva. */
  misura(): Promise<{ uri: string; misura: Misura }> {
    return this.chiedi((id) => ({ tipo: "misura", id })).then(({ uri, risposta }) => ({ uri, misura: risposta as Misura }));
  }

  private chiedi(domanda: (id: number) => VersoLaPagina): Promise<{ uri: string; risposta: Fotografia | Misura | null }> {
    const a = this.attiva();
    if (a === undefined) return Promise.reject(new Error("nessuna pagina aperta"));
    const id = ++this.ultimaFotografia;
    return new Promise((risolvi, rifiuta) => {
      const tempo = setTimeout(() => {
        a.attese.delete(id);
        rifiuta(new Error("la pagina non ha risposto"));
      }, 5000);
      a.attese.set(id, (r) => {
        clearTimeout(tempo);
        risolvi({ uri: a.uri.toString(), risposta: r });
      });
      a.manda(domanda(id));
    });
  }
}

// «Apri come testo»: il JSON in una vista di sola lettura col contenuto del file, mai il file nell'editor di testo. Misurato
// nell'editor vero: un file aperto una volta con l'editor di testo si riapre da lì in poi come testo, non come pagina.
export const SCHEMA_DEL_TESTO = "algo-testo";
const cambioDelTesto = new vscode.EventEmitter<vscode.Uri>();

/** L'indirizzo della vista di testo di un file: lo stesso percorso col suffisso, e il file vero nella richiesta. */
export function indirizzoDelTesto(uri: vscode.Uri): vscode.Uri {
  const suffisso = vscode.env.language.toLowerCase().startsWith("it") ? " (testo)" : " (text)";
  return vscode.Uri.from({ scheme: SCHEMA_DEL_TESTO, path: `${uri.path}${suffisso}`, query: uri.toString() });
}

export const fornitoreDelTesto: vscode.TextDocumentContentProvider = {
  onDidChange: cambioDelTesto.event,
  async provideTextDocumentContent(indirizzo) {
    try {
      return Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.parse(indirizzo.query))).toString("utf8");
    } catch {
      return "";
    }
  },
};

/** Il documento aperto nell'editor per quel file, se c'è. */
function documentoDi(uri: vscode.Uri): vscode.TextDocument | undefined {
  return vscode.workspace.textDocuments.find((d) => d.uri.scheme === "file" && d.uri.fsPath.toLowerCase() === uri.fsPath.toLowerCase());
}

/** Il testo del file per il confronto: se è aperto nell'editor, quello che lo studente vede (anche non salvato); null se non c'è. */
async function testoDi(uri: vscode.Uri): Promise<string | null> {
  const d = documentoDi(uri);
  if (d !== undefined) return d.getText();
  try {
    return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
  } catch {
    return null;
  }
}

/** Scrive il codice nel file. Aperto nell'editor, passa dal documento e lo salva: scritto sotto i piedi del documento, l'editor
 *  segnerebbe un conflitto con le modifiche non salvate. */
async function scrivi(uri: vscode.Uri, testo: string): Promise<void> {
  const d = documentoDi(uri);
  if (d === undefined) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(testo, "utf8"));
    return;
  }
  const modifica = new vscode.WorkspaceEdit();
  modifica.replace(d.uri, new vscode.Range(0, 0, d.lineCount, 0), testo);
  if (!(await vscode.workspace.applyEdit(modifica)) || !(await d.save())) throw new Error(basename(uri.fsPath));
}

async function apriComeTesto(uri: vscode.Uri): Promise<unknown> {
  const indirizzo = indirizzoDelTesto(uri);
  cambioDelTesto.fire(indirizzo);
  const documento = await vscode.languages.setTextDocumentLanguage(await vscode.workspace.openTextDocument(indirizzo), "json");
  return vscode.window.showTextDocument(documento, { preview: false });
}

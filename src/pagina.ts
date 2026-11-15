// La pagina del flowchart: un editor personalizzato in sola lettura per i file .algo. L'estensione legge il file dal
// DISCO, calcola il modello col nucleo, scrive «Problemi» e manda lo stato alla pagina; un osservatore del file la
// aggiorna dopo un salvataggio esterno. All'avviso dell'osservatore il documento dell'editor ha ancora il testo vecchio (misura di
// misurato nell'editor): per questo si legge il disco, mai il documento.
//
// La scelta del linguaggio e della lingua si ricorda per flowchart nello stato dell'estensione, legata al percorso
// rispetto alla cartella aperta, e come «ultima» per i flowchart mai aperti; mai nelle impostazioni.

import { randomBytes } from "node:crypto";
import { basename } from "node:path";
import * as vscode from "vscode";
import { LINGUA_INIZIALE, LINGUAGGIO_INIZIALE, linguaggiOfferti, modello, testiDellInterfaccia, type Libreria, type LinguaDellInterfaccia, type Modello } from "./documento";
import type { DallaPagina, Fotografia, Scelta, Stato, VersoLaPagina } from "./messaggi";
import { coloriDelTema } from "./tema";

export const TIPO_DELLA_PAGINA = "algo.pagina";
const ULTIMA = "algo.ultimaScelta";

type Aperta = {
  readonly uri: vscode.Uri;
  readonly pannello: vscode.WebviewPanel;
  aggiorna(): Promise<void>;
  manda(m: VersoLaPagina): void;
  readonly attese: Map<number, (f: Fotografia | null) => void>;
};

export class Pagina implements vscode.CustomReadonlyEditorProvider {
  private readonly aperte = new Set<Aperta>();
  private versione = 0;
  private ultimaFotografia = 0;
  /** Spento solo dalla prova con l'editor, per il suo controllo positivo: senza osservatore l'aggiornamento non arriva. */
  osservatoreAcceso = true;

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

  private chiave(uri: vscode.Uri): string | null {
    return vscode.workspace.getWorkspaceFolder(uri) === undefined ? null : `algo.scelta:${vscode.workspace.asRelativePath(uri, false)}`;
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

  async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => undefined };
  }

  async resolveCustomEditor(documento: vscode.CustomDocument, pannello: vscode.WebviewPanel): Promise<void> {
    const uri = documento.uri;
    const dist = vscode.Uri.joinPath(this.contesto.extensionUri, "dist");
    pannello.webview.options = { enableScripts: true, localResourceRoots: [dist] };
    const nonce = randomBytes(16).toString("base64");
    const w = pannello.webview;
    pannello.webview.html = `<!doctype html>
<html lang="${this.interfaccia()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}'; img-src ${w.cspSource} data:; font-src ${w.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(dist, "pagina.css")).toString()}">
</head><body><div id="radice"></div>
<script type="module" nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(dist, "pagina.js")).toString()}"></script>
</body></html>`;

    let pronta = false;
    let ultimo: Stato | null = null;
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
        try {
          m = modello(this.libreria, Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8"), scelta.linguaggio, scelta.lingua, interfaccia);
        } catch {
          // Un file che non c'è più (cancellato o in mezzo a un salvataggio) non si legge: la pagina lo dice come un file che non si apre.
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
        } else if (m.tipo === "apriComeTesto") await apriComeTesto(uri);
        else if (m.tipo === "fotografia") {
          aperta.attese.get(m.id)?.(m.fotografia);
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

  /** La pagina attiva, o l'ultima aperta. */
  private attiva(): Aperta | undefined {
    const tutte = [...this.aperte];
    return tutte.find((a) => a.pannello.active) ?? tutte[tutte.length - 1];
  }

  apriComeTesto(): Thenable<unknown> | undefined {
    const a = this.attiva();
    return a === undefined ? undefined : apriComeTesto(a.uri);
  }

  /** Per la prova con l'editor: ciò che la pagina attiva mostra, letto dal suo DOM; con `selettore`, prima un clic lì. */
  fotografia(selettore?: string): Promise<{ uri: string; fotografia: Fotografia | null }> {
    const a = this.attiva();
    if (a === undefined) return Promise.reject(new Error("nessuna pagina aperta"));
    const id = ++this.ultimaFotografia;
    return new Promise((risolvi, rifiuta) => {
      const tempo = setTimeout(() => {
        a.attese.delete(id);
        rifiuta(new Error("la pagina non ha risposto"));
      }, 5000);
      a.attese.set(id, (f) => {
        clearTimeout(tempo);
        risolvi({ uri: a.uri.toString(), fotografia: f });
      });
      a.manda(selettore === undefined ? { tipo: "fotografia", id } : { tipo: "clic", id, selettore });
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

async function apriComeTesto(uri: vscode.Uri): Promise<unknown> {
  const indirizzo = indirizzoDelTesto(uri);
  cambioDelTesto.fire(indirizzo);
  const documento = await vscode.languages.setTextDocumentLanguage(await vscode.workspace.openTextDocument(indirizzo), "json");
  return vscode.window.showTextDocument(documento, { preview: false });
}

// Il collegamento con l'editor: la pagina del flowchart per i file .algo (editor personalizzato in sola lettura), le sue voci in
// «Problemi» e il comando «Apri come testo» (una vista di sola lettura del JSON). Il file del nucleo di AlgoDesign sta accanto a questo file dopo la costruzione: è lo
// stesso file che si prova fuori dall'editor.
//
// Con ALGO_PROVA=1 nell'ambiente (solo la prova con l'editor) ci sono anche i comandi che leggono la pagina e spengono
// l'osservatore: fuori dalla prova non esistono.

import * as vscode from "vscode";
import type { Libreria } from "./documento";
import { fornitoreDelTesto, Pagina, SCHEMA_DEL_TESTO, TIPO_DELLA_PAGINA } from "./pagina";
import { coloriDelTema } from "./tema";

const libreria = require("./libreria.cjs") as Libreria;

export function activate(contesto: vscode.ExtensionContext): void {
  const problemi = vscode.languages.createDiagnosticCollection("algodesign");
  const pagina = new Pagina(contesto, libreria, problemi);
  contesto.subscriptions.push(
    problemi,
    vscode.window.registerCustomEditorProvider(TIPO_DELLA_PAGINA, pagina, { supportsMultipleEditorsPerDocument: false }),
    vscode.workspace.registerTextDocumentContentProvider(SCHEMA_DEL_TESTO, fornitoreDelTesto),
    vscode.commands.registerCommand("algo.apriComeTesto", () => pagina.apriComeTesto()),
  );
  if (process.env["ALGO_PROVA"] === "1")
    contesto.subscriptions.push(
      vscode.commands.registerCommand("algo.prova.fotografia", (selettore?: string, tasto?: { tasto: string; maiuscolo?: boolean }) => pagina.fotografia(selettore, tasto)),
      vscode.commands.registerCommand("algo.prova.misura", () => pagina.misura()),
      vscode.commands.registerCommand("algo.prova.disegno", (p: { misuraFissa: boolean; carattere: string | null }) => pagina.prova(p)),
      vscode.commands.registerCommand("algo.prova.osservatore", (acceso: boolean) => {
        pagina.osservatoreAcceso = acceso;
      }),
      vscode.commands.registerCommand("algo.prova.colori", () => coloriDelTema()),
    );
}

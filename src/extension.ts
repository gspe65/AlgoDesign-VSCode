// Il collegamento con l'editor: la pagina del flowchart per i file .algo (editor personalizzato in sola lettura), le sue voci in
// «Problemi», il comando «Apri il file come testo» (una vista di sola lettura del JSON) e, dalla pagina, «Salva il codice come…».
// Il file del nucleo di AlgoDesign sta accanto a questo file dopo la costruzione: è lo stesso file che si prova fuori dall'editor,
// e si esegue solo se ha l'impronta dichiarata in nucleo.json; se no la pagina dice che il nucleo è stato cambiato.
//
// Con ALGO_PROVA=1 nell'ambiente (solo la prova con l'editor) ci sono anche i comandi che leggono la pagina e spengono
// l'osservatore: fuori dalla prova non esistono.

import { join } from "node:path";
import * as vscode from "vscode";
import type { Libreria } from "./documento";
import { fornitoreDelTesto, Pagina, SCHEMA_DEL_TESTO, TIPO_DELLA_PAGINA } from "./pagina";
import { coloriDelTema } from "./tema";
import { nucleoVerificato } from "./verifica";

/** L'impronta (sha256, esadecimale) del file del nucleo dichiarata in nucleo.json, scritta qui dalla costruzione. */
declare const IMPRONTA_DEL_NUCLEO: string;

export function activate(contesto: vscode.ExtensionContext): void {
  const registro = vscode.window.createOutputChannel("AlgoDesign", { log: true });
  // Il file accanto a questo (dist/): dalla cartella dell'estensione, perché la costruzione scriverebbe `__dirname` per esteso.
  const { nucleo: libreria, motivo } = nucleoVerificato(join(contesto.extensionPath, "dist", "libreria.cjs"), IMPRONTA_DEL_NUCLEO, () => require("./libreria.cjs") as Libreria);
  if (motivo !== null) registro.error(`il file del nucleo non è quello dichiarato, non si esegue: ${motivo}`);
  const problemi = vscode.languages.createDiagnosticCollection("algodesign");
  const pagina = new Pagina(contesto, libreria, problemi, registro);
  contesto.subscriptions.push(
    registro,
    problemi,
    vscode.window.registerCustomEditorProvider(TIPO_DELLA_PAGINA, pagina, { supportsMultipleEditorsPerDocument: false }),
    vscode.workspace.registerTextDocumentContentProvider(SCHEMA_DEL_TESTO, fornitoreDelTesto),
    vscode.commands.registerCommand("algo.apriComeTesto", () => pagina.apriComeTesto()),
  );
  if (process.env["ALGO_PROVA"] === "1")
    contesto.subscriptions.push(
      vscode.commands.registerCommand("algo.prova.fotografia", (selettore?: string, tasto?: { tasto: string; maiuscolo?: boolean }) => pagina.fotografia(selettore, tasto)),
      vscode.commands.registerCommand("algo.prova.scorri", () => pagina.scorri()),
      vscode.commands.registerCommand("algo.prova.disegno", (p: { misuraFissa: boolean; carattere: string | null }) => pagina.prova(p)),
      vscode.commands.registerCommand("algo.prova.osservatore", (acceso: boolean) => {
        pagina.osservatoreAcceso = acceso;
      }),
      vscode.commands.registerCommand("algo.prova.colori", () => coloriDelTema()),
      // Le risposte della finestra «Salva con nome» al posto di Windows (un percorso, o null per «Annulla»), e le domande arrivate.
      // Con null si torna alla finestra vera.
      vscode.commands.registerCommand("algo.prova.dialogo", (risposte?: (string | null)[] | null) => {
        if (risposte === null) pagina.risposteDelDialogo = null;
        else if (risposte !== undefined) pagina.risposteDelDialogo = [...risposte];
        return { domande: pagina.domandeAlDialogo };
      }),
    );
}

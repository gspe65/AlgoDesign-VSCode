// I colori del codice dal tema dell'editor in uso: il file del tema trovato fra quelli che le estensioni dichiarano, letto
// con la sua catena di `include`; se non si legge, la tavolozza del tipo di tema. Non guarda le personalizzazioni dei colori
// scritte nelle impostazioni (`editor.tokenColorCustomizations`).

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import * as vscode from "vscode";
import { coloriDalleRegole, regoleDelTema, TAVOLOZZE, type Colori, type Specie } from "./colori";

type TemaDichiarato = { id?: string; label?: string; path?: string };

export function tavolozzaDelTipo(tipo: vscode.ColorThemeKind): Colori {
  if (tipo === vscode.ColorThemeKind.Light) return TAVOLOZZE.chiaro;
  if (tipo === vscode.ColorThemeKind.HighContrast) return TAVOLOZZE.contrasto;
  if (tipo === vscode.ColorThemeKind.HighContrastLight) return TAVOLOZZE.contrastoChiaro;
  return TAVOLOZZE.scuro;
}

/** I colori del tema in uso, e da dove vengono: «tema <id>» con le specie trovate nel tema, o «tavolozza» col motivo. */
export function coloriDelTema(): { colori: Colori; fonte: string; dalTema: Specie[] } {
  const riserva = tavolozzaDelTipo(vscode.window.activeColorTheme.kind);
  const id = vscode.workspace.getConfiguration("workbench").get<string>("colorTheme");
  for (const e of vscode.extensions.all) {
    const temi = ((e.packageJSON as { contributes?: { themes?: TemaDichiarato[] } }).contributes?.themes ?? []) as TemaDichiarato[];
    const t = temi.find((x) => (x.id ?? x.label) === id);
    if (t?.path === undefined) continue;
    try {
      const leggi = (p: string, rispettoA?: string) => {
        const pieno = rispettoA === undefined ? join(e.extensionPath, p) : resolve(dirname(rispettoA), p);
        return { percorso: pieno, testo: readFileSync(pieno, "utf8") };
      };
      const { colori, dalTema } = coloriDalleRegole(regoleDelTema(leggi, t.path), riserva);
      return { colori, fonte: `tema ${id}`, dalTema };
    } catch (errore) {
      return { colori: riserva, fonte: `tavolozza: il tema ${id} non si legge (${errore instanceof Error ? errore.message : String(errore)})`, dalTema: [] };
    }
  }
  return { colori: riserva, fonte: `tavolozza: il tema ${id ?? "(nessuno)"} non è fra quelli dichiarati`, dalTema: [] };
}

// Il modello della pagina del flowchart: ciò che la pagina mostra di un file .algo, in un linguaggio e una lingua del codice e
// nella lingua dell'interfaccia. Non importa l'editor: si prova senza finestra, e da qui vengono anche le voci di «Problemi».
//
// Le segnalazioni sono quelle del nucleo (`segnalazioni`), con la forma della riga di stato di AlgoDesign: «Errore in «dove»:
// breve», poi la spiegazione (che cosa è successo, se dice più del breve, e il suggerimento). Gli `id` dei blocchi e delle
// funzioni viaggiano col modello, per il clic e per il disegno, ma non entrano in nessun testo visibile.

import type { CodiceGenerato, Esito, LinguaDelCodice, Progetto, Segnalazione } from "algodesign-core";

/** Le funzioni della libreria che servono qui. */
export type Libreria = {
  apri(testo: string): Esito;
  genera(progetto: Progetto, linguaggio: string, lingua: LinguaDelCodice): CodiceGenerato;
  segnalazioni(progetto: Progetto, lingua: LinguaDelCodice): Segnalazione[];
};

export type Rifiuto = Extract<CodiceGenerato, { generato: false }>;
export type LinguaDellInterfaccia = "it" | "en";

/** I linguaggi della pagina, nell'ordine delle linguette di AlgoDesign: di partenza C e Python; con l'impostazione
 *  della pseudocodifica anche Pseudocodice (Accademico vi entrerà quando le sue mancanze avranno le frasi). */
export const PSEUDOCODIFICA = ["pseudocodice"] as const;
export const DI_PARTENZA = ["python", "c"] as const;
export const LINGUAGGIO_INIZIALE = "c";
export const LINGUA_INIZIALE: LinguaDelCodice = "it";
export function linguaggiOfferti(pseudocodifica: boolean): string[] {
  return [...(pseudocodifica ? PSEUDOCODIFICA : []), ...DI_PARTENZA];
}

const TESTI = {
  it: {
    linguaggi: { pseudocodice: "Pseudocodice", python: "Python", c: "C" } as Record<string, string>,
    lingue: { it: "italiano", en: "inglese" } as Record<LinguaDelCodice, string>,
    linguaggio: "Linguaggio",
    lingua: "Lingua",
    apriComeTesto: "Apri come testo",
    funzioni: "Funzioni",
    principale: "Programma principale",
    segnalazioni: "Errori e avvisi",
    nessunaSegnalazione: "Nessun errore né avviso.",
    nascondi: "Nascondi il flowchart",
    mostra: "Mostra il flowchart",
    nascondiSuggerimento: "Il codice a tutta larghezza",
    mostraSuggerimento: "Il disegno accanto al codice",
    zoom: "Zoom",
    zoomRiduci: "Riduci",
    zoomCento: "Torna al 100%",
    zoomIngrandisci: "Ingrandisci",
    zoomAdatta: "Adatta alla finestra",
    zoomTornaIndietro: "Torna indietro",
    zoomTornaIndietroSuggerimento: "Torna allo zoom di prima di «Adatta alla finestra»",
    disegnoDi: "Flowchart di «{funzione}», {conteggio}",
    errori1: "1 errore",
    erroriN: "{n} errori",
    avvisi1: "1 avviso",
    avvisiN: "{n} avvisi",
    senzaSegnalazioni: "nessun errore né avviso",
    divisore: "Larghezza del flowchart e del codice",
    nucleoAssente: "Il disegno non c'è: il nucleo di AlgoDesign dell'estensione non è quello previsto. Reinstalla l'estensione.",
    carattereIgnorato: "Il disegno non c'è: il carattere «{carattere}» non si può misurare.",
    bloccoSegnalato: "Blocco segnalato: «{dove}»",
    codiceIn: "Codice in {linguaggio}",
    voceErrore: "Errore in «{dove}»: {breve}",
    voceAvviso: "Avviso in «{dove}»: {breve}",
    apri: "Questo file non si apre: non contiene un flowchart di AlgoDesign valido.",
    "errori-statici-1": "Il codice non c'è: il flowchart ha 1 errore da correggere in AlgoDesign. Lo trovi in «Errori e avvisi».",
    "errori-statici-n": "Il codice non c'è: il flowchart ha {n} errori da correggere in AlgoDesign. Li trovi in «Errori e avvisi».",
    "fuori-tappa": "Il codice non c'è: il flowchart usa costrutti fuori dalla sua tappa.",
    "non-ancora": "Il codice non c'è: il generatore di {linguaggio} non sa ancora scrivere questo flowchart ({costrutto}).",
    "non-ci-sta": "Il codice non c'è: il flowchart non si scrive in {linguaggio}.",
  },
  en: {
    linguaggi: { pseudocodice: "Pseudocode", python: "Python", c: "C" } as Record<string, string>,
    lingue: { it: "Italian", en: "English" } as Record<LinguaDelCodice, string>,
    linguaggio: "Language",
    lingua: "Natural language",
    apriComeTesto: "Open as text",
    funzioni: "Functions",
    principale: "Main program",
    segnalazioni: "Errors and warnings",
    nessunaSegnalazione: "No errors or warnings.",
    nascondi: "Hide flowchart",
    mostra: "Show flowchart",
    nascondiSuggerimento: "The code at full width",
    mostraSuggerimento: "The drawing next to the code",
    zoom: "Zoom",
    zoomRiduci: "Zoom out",
    zoomCento: "Back to 100%",
    zoomIngrandisci: "Zoom in",
    zoomAdatta: "Fit to window",
    zoomTornaIndietro: "Go back",
    zoomTornaIndietroSuggerimento: "Back to the zoom before “Fit to window”",
    disegnoDi: "Flowchart of “{funzione}”, {conteggio}",
    errori1: "1 error",
    erroriN: "{n} errors",
    avvisi1: "1 warning",
    avvisiN: "{n} warnings",
    senzaSegnalazioni: "no errors or warnings",
    divisore: "Width of the flowchart and the code",
    nucleoAssente: "There is no drawing: the AlgoDesign core in the extension is not the expected one. Reinstall the extension.",
    carattereIgnorato: "There is no drawing: the font “{carattere}” cannot be measured.",
    bloccoSegnalato: "Flagged block: “{dove}”",
    codiceIn: "Code in {linguaggio}",
    voceErrore: "Error in “{dove}”: {breve}",
    voceAvviso: "Warning in “{dove}”: {breve}",
    apri: "This file cannot be opened: it does not contain a valid AlgoDesign flowchart.",
    "errori-statici-1": "There is no code: the flowchart has 1 error to fix in AlgoDesign. You find it in “Errors and warnings”.",
    "errori-statici-n": "There is no code: the flowchart has {n} errors to fix in AlgoDesign. You find them in “Errors and warnings”.",
    "fuori-tappa": "There is no code: the flowchart uses constructs beyond its stage.",
    "non-ancora": "There is no code: the {linguaggio} generator cannot write this flowchart yet ({costrutto}).",
    "non-ci-sta": "There is no code: the flowchart cannot be written in {linguaggio}.",
  },
} as const;
export type Testi = (typeof TESTI)["it"];
export function testiDellInterfaccia(lingua: LinguaDellInterfaccia): Testi {
  return TESTI[lingua] as Testi;
}
const riempi = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? `{${k}}`);
export { riempi };

/** Una segnalazione come la vede lo studente; `blocco` e `funzione` servono al clic, non si mostrano. */
export type VoceDellaPagina = {
  readonly genere: "errore" | "avviso";
  readonly testo: string;
  readonly spiegazione: string;
  /** Il posto in parole (il testo del blocco): il clic lo mostra nel riquadro del disegno. */
  readonly dove: string;
  readonly numero: string;
  /** Il codice del nucleo (`invalid_step`): serve ad appaiare le voci a `controlla`, mai sullo schermo. */
  readonly codice: string;
  readonly blocco: string | null;
  readonly funzione: string | null;
};

export type Modello = {
  readonly titolo: string;
  readonly funzioni: readonly { readonly id: string; readonly nome: string }[];
  readonly segnalazioni: readonly VoceDellaPagina[];
  /** Il codice, con la riga di `main` (da 1), o la frase che dice perché non c'è. */
  readonly codice: { readonly testo: string; readonly rigaDiMain: number } | { readonly assente: string };
};

/** La riga del programma principale nel codice, da 1: lì la pagina apre il codice (il programma C sotto le funzioni di supporto). */
export function rigaDiMain(testo: string, linguaggio: string): number {
  const rx = linguaggio === "c" ? /^int main\(/m : linguaggio === "python" ? /^def main\(/m : null;
  const m = rx === null ? null : rx.exec(testo);
  return m === null ? 1 : testo.slice(0, m.index).split("\n").length;
}

/** Il testo di una voce e la sua spiegazione, come la riga di stato e la spiegazione di AlgoDesign. */
export function voce(s: Segnalazione, testi: Testi): VoceDellaPagina {
  return {
    genere: s.genere,
    testo: riempi(s.genere === "errore" ? testi.voceErrore : testi.voceAvviso, { dove: s.dove, breve: s.breve }),
    spiegazione: s.accaduto === s.breve ? s.suggerimento : `${s.accaduto} ${s.suggerimento}`,
    dove: s.dove,
    numero: s.numero,
    codice: s.codice,
    blocco: s.blocco,
    funzione: s.funzione ?? null,
  };
}

function frase(r: Rifiuto, linguaggio: string, testi: Testi, errori: number): string {
  const nome = testi.linguaggi[linguaggio] ?? linguaggio;
  if (r.perche === "errori-statici") return riempi(errori === 1 ? testi["errori-statici-1"] : testi["errori-statici-n"], { n: String(errori) });
  if (r.perche === "non-ancora") return riempi(testi["non-ancora"], { linguaggio: nome, costrutto: r.costrutto });
  return riempi(testi[r.perche], { linguaggio: nome });
}

/** Il modello di un file: il testo del file com'è sul disco, il linguaggio e la lingua del codice, la lingua dell'interfaccia. */
export function modello(libreria: Libreria, testoDelFile: string, linguaggio: string, lingua: LinguaDelCodice, interfaccia: LinguaDellInterfaccia): Modello {
  if (!Object.hasOwn(TESTI.it.lingue, lingua)) throw new Error(`lingua sconosciuta: ${lingua}`);
  const testi = testiDellInterfaccia(interfaccia);
  const aperto = libreria.apri(testoDelFile);
  if (!aperto.ok) return { titolo: "", funzioni: [], segnalazioni: [], codice: { assente: testi.apri } };
  const p = aperto.progetto;
  const funzioni = p.functions.map((f) => ({ id: f.id, nome: f.kind === "main" ? testi.principale : (f.name ?? "") }));
  const segnalazioni = libreria.segnalazioni(p, interfaccia).map((s) => voce(s, testi));
  const g = libreria.genera(p, linguaggio, lingua);
  const codice = g.generato ? { testo: g.testo, rigaDiMain: rigaDiMain(g.testo, linguaggio) } : { assente: frase(g, linguaggio, testi, segnalazioni.filter((s) => s.genere === "errore").length) };
  return { titolo: p.metadata.name, funzioni, segnalazioni, codice };
}

/** I testi che il modello mette sullo schermo, uno per elemento: la prova che nessun `id` interno ci sia li guarda tutti. */
export function testiVisibili(m: Modello, testi: Testi): string[] {
  return [m.titolo, ...m.funzioni.map((f) => f.nome), ...m.segnalazioni.flatMap((s) => [s.testo, s.spiegazione]), "assente" in m.codice ? m.codice.assente : m.codice.testo, testi.nessunaSegnalazione, testi.segnalazioni];
}

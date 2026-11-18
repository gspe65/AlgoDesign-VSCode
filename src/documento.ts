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
    apriComeTesto: "Apri il file come testo",
    apriComeTestoSuggerimento: "Il file .algo così com'è (JSON), in sola lettura",
    titoloDelCodice: "Codice generato dal flowchart",
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
    nucleoAssente: "Il disegno non c'è: il nucleo di AlgoDesign dell'estensione è stato cambiato o rovinato. Serve una copia nuova dell'estensione.",
    carattereIgnorato: "Il disegno non c'è: il carattere «{carattere}» non si può misurare.",
    bloccoSegnalato: "Blocco segnalato: «{dove}»",
    codiceIn: "Codice in {linguaggio}",
    salvaCodice: "Salva il codice come…",
    titoloDelSalvataggio: "Salva il codice come",
    tipiDelCodice: { c: "Codice C", python: "Codice Python", pseudocodice: "Testo" } as Record<string, string>,
    salvato: "Salvato in un'altra cartella: {percorso}",
    salvatoAccanto: "Salvato accanto al flowchart: {file}",
    esisteDiverso: "{file} c'è già ed è diverso da questo codice: forse l'hai modificato. Sostituendolo perdi le modifiche.",
    salvaConAltroNome: "Salva con un altro nome",
    sostituisci: "Sostituisci",
    annullaSalvataggio: "Annulla",
    nonSalvato: "Il codice non si è salvato: «{file}» non si può scrivere (forse è aperto in un altro programma, o la cartella è protetta). Scegli un'altra cartella con «Salva il codice come…».",
    voceErrore: "Errore in «{dove}»: {breve}",
    voceAvviso: "Avviso in «{dove}»: {breve}",
    apri: "Questo file non si apre: non contiene un flowchart di AlgoDesign valido.",
    nonSiLegge: "Questo file non si legge dal disco: {motivo}",
    nucleoFermo: "Questo file non si apre: AlgoDesign si è fermato leggendolo. Aprilo in AlgoDesign per controllarlo.",
    "errori-statici-1": "Il codice non c'è: il flowchart ha 1 errore da correggere in AlgoDesign. Lo trovi in «Errori e avvisi».",
    "errori-statici-n": "Il codice non c'è: il flowchart ha {n} errori da correggere in AlgoDesign. Li trovi in «Errori e avvisi».",
    "fuori-tappa": "Il codice non c'è: il flowchart usa costrutti fuori dalla sua tappa.",
    "non-ancora": "Il codice non c'è: il generatore di {linguaggio} non sa ancora scrivere questo flowchart.",
    "non-ci-sta": "Il codice non c'è: il flowchart non si scrive in {linguaggio}.",
  },
  en: {
    linguaggi: { pseudocodice: "Pseudocode", python: "Python", c: "C" } as Record<string, string>,
    lingue: { it: "Italian", en: "English" } as Record<LinguaDelCodice, string>,
    linguaggio: "Language",
    lingua: "Natural language",
    apriComeTesto: "Open the file as text",
    apriComeTestoSuggerimento: "The .algo file as it is (JSON), read-only",
    titoloDelCodice: "Code generated from the flowchart",
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
    nucleoAssente: "There is no drawing: the AlgoDesign core in the extension has been changed or damaged. A new copy of the extension is needed.",
    carattereIgnorato: "There is no drawing: the font “{carattere}” cannot be measured.",
    bloccoSegnalato: "Flagged block: “{dove}”",
    codiceIn: "Code in {linguaggio}",
    salvaCodice: "Save the code as…",
    titoloDelSalvataggio: "Save the code as",
    tipiDelCodice: { c: "C code", python: "Python code", pseudocodice: "Text" } as Record<string, string>,
    salvato: "Saved in another folder: {percorso}",
    salvatoAccanto: "Saved next to the flowchart: {file}",
    esisteDiverso: "{file} already exists and is different from this code: you may have changed it. Replacing it loses your changes.",
    salvaConAltroNome: "Save with another name",
    sostituisci: "Replace",
    annullaSalvataggio: "Cancel",
    nonSalvato: "The code was not saved: “{file}” cannot be written (it may be open in another program, or the folder may be protected). Choose another folder with “Save the code as…”.",
    voceErrore: "Error in “{dove}”: {breve}",
    voceAvviso: "Warning in “{dove}”: {breve}",
    apri: "This file cannot be opened: it does not contain a valid AlgoDesign flowchart.",
    nonSiLegge: "This file cannot be read from disk: {motivo}",
    nucleoFermo: "This file does not open: AlgoDesign stopped while reading it. Open it in AlgoDesign to check it.",
    "errori-statici-1": "There is no code: the flowchart has 1 error to fix in AlgoDesign. You find it in “Errors and warnings”.",
    "errori-statici-n": "There is no code: the flowchart has {n} errors to fix in AlgoDesign. You find them in “Errors and warnings”.",
    "fuori-tappa": "There is no code: the flowchart uses constructs beyond its stage.",
    "non-ancora": "There is no code: the {linguaggio} generator cannot write this flowchart yet.",
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
  /** Il codice, con la riga di `main` (da 1) e quella della definizione di ogni altra funzione (per `id`, quelle trovate), o la
   *  frase che dice perché non c'è. */
  readonly codice: { readonly testo: string; readonly rigaDiMain: number; readonly righeDelleFunzioni: Readonly<Record<string, number>> } | { readonly assente: string };
};

/** La riga del programma principale nel codice, da 1: lì la pagina apre il codice (il programma C sotto le funzioni di supporto). */
export function rigaDiMain(testo: string, linguaggio: string): number {
  const rx = linguaggio === "c" ? /^int main\(/m : linguaggio === "python" ? /^def main\(/m : null;
  const m = rx === null ? null : rx.exec(testo);
  return m === null ? 1 : testo.slice(0, m.index).split("\n").length;
}

/** La riga (da 1) della definizione di una funzione nel codice, come la scrive ciascun generatore: in Python `def nome(`; nello
 *  pseudocodice la riga che comincia con la parola della funzione o della procedura (lì anche «RESTITUISCE» sta senza rientro);
 *  in C la prima riga senza rientro col nome seguito da una parentesi che non finisce con `;` (le dichiarazioni in cima al file
 *  finiscono così, le chiamate stanno dentro un corpo, rientrate). Null se non c'è: allora il clic sulla scheda non sposta il
 *  codice. */
export function rigaDellaFunzione(testo: string, linguaggio: string, nome: string): number | null {
  if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(nome)) return null;
  const chiamata = new RegExp(`(?<![\\p{L}\\p{N}_])${nome}\\s*\\(`, "u");
  const definizione =
    linguaggio === "python"
      ? (r: string) => r.startsWith(`def ${nome}(`)
      : linguaggio === "pseudocodice"
        ? (r: string) => /^(FUNZIONE|PROCEDURA|FUNCTION|PROCEDURE)\b/.test(r) && chiamata.test(r)
        : (r: string) => r !== "" && !/^\s/.test(r) && !/;\s*$/.test(r) && chiamata.test(r);
  const i = testo.split("\n").findIndex(definizione);
  return i < 0 ? null : i + 1;
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
  // `non-ancora` porta il costrutto col suo nome interno, che il nucleo non traduce: il testo non lo mostra.
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
  const codice = g.generato ? { testo: g.testo, rigaDiMain: rigaDiMain(g.testo, linguaggio), righeDelleFunzioni: righeDelleFunzioni(g.testo, linguaggio, p.functions) } : { assente: frase(g, linguaggio, testi, segnalazioni.filter((s) => s.genere === "errore").length) };
  return { titolo: p.metadata.name, funzioni, segnalazioni, codice };
}

function righeDelleFunzioni(testo: string, linguaggio: string, funzioni: Progetto["functions"]): Record<string, number> {
  const fuori: Record<string, number> = {};
  for (const f of funzioni) {
    if (f.kind === "main" || f.name === undefined) continue;
    const r = rigaDellaFunzione(testo, linguaggio, f.name);
    if (r !== null) fuori[f.id] = r;
  }
  return fuori;
}

/** Il file come l'estensione l'ha letto dal disco: il testo, o il motivo per cui la lettura non è riuscita. */
export type Lettura = { readonly testo: string } | { readonly errore: string };

/** Il modello di un file letto (o non letto) dal disco, con un nucleo che può mancare (impronta diversa da quella dichiarata) o
 *  fermarsi con un'eccezione: ciascun caso ha la sua frase, e `eccezione` porta il motivo tecnico per il registro. */
export function modelloDelFile(libreria: Libreria | null, lettura: Lettura, linguaggio: string, lingua: LinguaDelCodice, interfaccia: LinguaDellInterfaccia, nomeDelFile: string): { modello: Modello; eccezione: string | null } {
  const testi = testiDellInterfaccia(interfaccia);
  const senza = (assente: string): Modello => ({ titolo: nomeDelFile, funzioni: [], segnalazioni: [], codice: { assente } });
  if (libreria === null) return { modello: senza(testi.nucleoAssente), eccezione: null };
  if ("errore" in lettura) return { modello: senza(riempi(testi.nonSiLegge, { motivo: lettura.errore })), eccezione: null };
  try {
    return { modello: modello(libreria, lettura.testo, linguaggio, lingua, interfaccia), eccezione: null };
  } catch (e) {
    return { modello: senza(testi.nucleoFermo), eccezione: e instanceof Error ? (e.stack ?? e.message) : String(e) };
  }
}

/** I testi che il modello mette sullo schermo, uno per elemento: la prova che nessun `id` interno ci sia li guarda tutti. */
export function testiVisibili(m: Modello, testi: Testi): string[] {
  return [m.titolo, ...m.funzioni.map((f) => f.nome), ...m.segnalazioni.flatMap((s) => [s.testo, s.spiegazione]), "assente" in m.codice ? m.codice.assente : m.codice.testo, testi.nessunaSegnalazione, testi.segnalazioni];
}

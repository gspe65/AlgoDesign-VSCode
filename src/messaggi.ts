// I messaggi fra l'estensione e la pagina. Solo tipi: li usano tutti e due i lati.

import type { Colori } from "./colori";
import type { Modello, Testi } from "./documento";

export type Scelta = { readonly linguaggio: string; readonly lingua: "it" | "en" };

/** Come lo studente ha lasciato il disegno di un flowchart: lo zoom, il riquadro, il divisore. La pagina la manda a ogni
 *  cambio; l'estensione la ricorda per flowchart, e come «ultima» il riquadro e il divisore per i flowchart mai aperti. */
export type Vista = {
  /** La scala scelta coi comandi dello zoom (1 = 100%); con `adattata` la pagina la ricalcola sull'area del disegno. */
  readonly scala: number;
  readonly adattata: boolean;
  /** Lo zoom di prima di «Adatta alla finestra» scelto dallo studente: lo stesso comando, diventato «Torna indietro», ci
   *  torna. Null se l'adattamento è quello dell'apertura (il comando resta «Adatta alla finestra»: non c'è un prima). */
  readonly scalaPrima: number | null;
  /** Il riquadro del flowchart nascosto: il codice a tutta larghezza. */
  readonly chiuso: boolean;
  /** La parte della larghezza che va al flowchart, in percento. */
  readonly divisore: number;
};

export type Stato = {
  readonly modello: Modello;
  readonly testi: Testi;
  /** I linguaggi offerti, nell'ordine dei pulsanti, col nome da mostrare. */
  readonly offerti: readonly { readonly id: string; readonly nome: string }[];
  readonly lingue: readonly { readonly id: "it" | "en"; readonly nome: string }[];
  readonly scelta: Scelta;
  readonly colori: Colori;
  /** Il testo del file com'è sul disco: la pagina lo apre col nucleo per disegnarlo. */
  readonly testo: string;
  /** La vista ricordata: la pagina la prende solo al primo stato, poi tiene la sua. */
  readonly vista: Vista;
  /** Un numero che cresce a ogni stato nuovo: la pagina riporta il codice su `main` solo se cambia il codice. */
  readonly versione: number;
};

/** Il disegno come la pagina lo mostra, letto dal suo DOM. */
export type FotografiaDelDisegno = {
  /** Se il file del nucleo è stato eseguito dalla pagina (il browser lo rifiuta se l'impronta non è quella dichiarata). */
  readonly nucleo: "caricato" | "assente";
  /** L'impronta che la pagina chiede al browser per il file del nucleo (l'attributo `integrity`). */
  readonly integrita: string;
  /** L'SVG come `disegna` l'ha dato, prima che la pagina lo ingrandisca o lo evidenzi; null senza disegno. */
  readonly svg: string | null;
  /** La frase al posto del disegno, se il disegno non c'è. */
  readonly frase: string | null;
  readonly larghezza: number | null;
  readonly altezza: number | null;
  readonly scala: number;
  readonly adattata: boolean;
  /** Se il disegno sta tutto nell'area visibile del foglio (adattato deve starci). */
  readonly staNelFoglio: boolean;
  /** Il carattere chiesto al canvas e quello che il canvas ha tenuto (riletto). */
  readonly carattere: { readonly chiesto: string; readonly riletto: string } | null;
  /** I bollini del disegno nell'ordine del tabulatore, col nome che la lettura dello schermo ne dice. */
  readonly bollini: readonly { readonly id: string; readonly segno: string; readonly codici: string; readonly etichetta: string }[];
  /** Le coppie bollino-segnalazione della scheda che non tornano, nei due versi (vuoto: si appaiano). */
  readonly appaiamento: readonly string[];
  /** Il blocco evidenziato dal clic su una segnalazione, e se si vede nell'area del disegno. */
  readonly evidenziato: string | null;
  readonly evidenziatoInVista: boolean;
  /** Il nome del disegno per la lettura dello schermo. */
  readonly etichetta: string;
  /** I comandi dello zoom col loro nome (quello che la lettura dello schermo dice) e il testo che si vede. */
  readonly zoom: readonly { readonly nome: string; readonly testo: string }[];
  readonly chiuso: boolean;
  readonly divisore: number;
  readonly divisoreVisibile: boolean;
  /** La larghezza della pagina in pixel CSS: sotto i 760 la pagina è a una colonna e il divisore non c'è. */
  readonly larghezzaPagina: number;
};

/** Ciò che la pagina mostra, letto dal suo DOM: lo usa solo la prova con l'editor. */
export type Fotografia = {
  readonly testoVisibile: string;
  readonly titolo: string;
  readonly codice: string | null;
  readonly assente: string | null;
  readonly linguaggi: readonly { readonly nome: string; readonly attivo: boolean }[];
  readonly lingue: readonly { readonly nome: string; readonly attivo: boolean }[];
  readonly funzioni: readonly { readonly nome: string; readonly attiva: boolean }[];
  readonly voci: readonly string[];
  readonly rigaInCima: number | null;
  readonly editabili: number;
  /** L'elemento col fuoco: il suo id, o il valore della sua scelta, o il nome del tag. */
  readonly fuoco: string;
  readonly colori: Readonly<Record<string, string | null>>;
  readonly disegno: FotografiaDelDisegno;
  readonly versione: number;
};

/** Le grandezze della finestra della pagina: lo zoom dell'editor e i nomi che la finestra ha già. Solo per la prova. */
export type Misura = {
  readonly rapportoDeiPixel: number;
  readonly larghezza: number;
  readonly altezza: number;
  readonly caratterePx: number;
  /** I nomi della finestra, sue e della catena dei prototipi, letti prima che la pagina carichi altro. */
  readonly nomiDellaFinestra: readonly string[];
};

/** Solo per la prova: la misura fissa (quella della conformità, al posto del canvas) e un carattere diverso da chiedere. */
export type Prova = { readonly misuraFissa: boolean; readonly carattere: string | null };

export type VersoLaPagina =
  | { readonly tipo: "stato"; readonly stato: Stato }
  | { readonly tipo: "fotografia"; readonly id: number }
  | { readonly tipo: "clic"; readonly id: number; readonly selettore: string }
  | { readonly tipo: "tasto"; readonly id: number; readonly selettore: string; readonly tasto: string; readonly maiuscolo: boolean }
  | { readonly tipo: "misura"; readonly id: number }
  | { readonly tipo: "prova"; readonly prova: Prova };

export type DallaPagina =
  | { readonly tipo: "pronta" }
  | { readonly tipo: "scegli"; readonly linguaggio?: string; readonly lingua?: "it" | "en" }
  | { readonly tipo: "vista"; readonly vista: Vista }
  | { readonly tipo: "apriComeTesto" }
  | { readonly tipo: "fotografia"; readonly id: number; readonly fotografia: Fotografia | null; readonly errore?: string }
  | { readonly tipo: "misura"; readonly id: number; readonly misura: Misura };

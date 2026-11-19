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
  /** La vista ricordata: la pagina la prende solo al primo stato, poi tiene la sua (anche quando rinasce: la rilegge dallo
   *  stato che la pagina salva in sé). */
  readonly vista: Vista;
  /** Un numero che cresce a ogni stato nuovo: la pagina riporta il codice su `main` solo se cambia il codice. */
  readonly versione: number;
};

/** Ciò che la pagina dice di «Salva il codice come…»: l'avviso prima della finestra (il file c'è ed è diverso), il file salvato,
 *  o il motivo per cui non si è salvato. `file` è il nome come lo studente lo legge (accanto al flowchart, il solo nome). */
export type Salvataggio =
  | { readonly stato: "avviso"; readonly file: string }
  /** `accanto`: nella cartella del flowchart, e la pagina lo dice (lo studente teme di non ritrovare il file). */
  | { readonly stato: "salvato"; readonly file: string; readonly accanto: boolean }
  | { readonly stato: "errore"; readonly testo: string }
  | null;

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
  /** Il carattere chiesto al canvas e quello che il canvas ha tenuto (riletto), nello stile normale. */
  readonly carattere: { readonly chiesto: string; readonly riletto: string } | null;
  /** I tre stili che il nucleo misura (normale, grassetto, corsivo), ciascuno chiesto e riletto, e se il canvas l'ha tenuto. */
  readonly stili: readonly { readonly stile: string; readonly chiesto: string; readonly riletto: string; readonly tenuto: boolean }[];
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
  /** L'ultima riga del codice che si vede, e se il codice è scorso fino in fondo (allora la riga cercata può non stare in cima). */
  readonly rigaInFondo: number | null;
  readonly codiceInFondo: boolean;
  /** Un valore diverso a ogni nascita della pagina: la pagina rinata (tornata in primo piano) si riconosce da qui. */
  readonly nascita: string;
  /** Il titolo sopra il codice. */
  readonly titoloDelCodice: string | null;
  /** «Apri il file come testo»: il testo del pulsante e il suo suggerimento. */
  readonly pulsanteDelTesto: { readonly testo: string; readonly suggerimento: string } | null;
  /** Il codice che va a capo: le righe che occupano più di una riga sullo schermo, se c'è uno scorrimento orizzontale, e per la
   *  prima riga a capo dove comincia il suo testo (il primo carattere non bianco) e dove comincia il seguito, in pixel; `tetto`:
   *  il rientro del seguito di una riga rientrata di 400 caratteri, e la larghezza del codice. */
  readonly aCapo: { readonly righe: number; readonly larghezza: number; readonly larghezzaVisibile: number; readonly rientro: { readonly inizio: number; readonly seguito: number } | null; readonly tetto: { readonly sospeso: number; readonly larghezza: number } | null };
  /** La barra sopra il codice (linguaggio, lingua, salvataggio) e il riquadro del codice, in pixel dalla cima della finestra;
   *  `fondoDelCodice` dalla cima della pagina. */
  readonly colonna: { readonly barra: number; readonly barraSenzaAggancio: number; readonly altezzaDellaBarra: number; readonly riquadro: number; readonly altezzaDelCodice: number; readonly fondoDelCodice: number; readonly altezzaDellaFinestra: number; readonly scorrimento: number };
  readonly editabili: number;
  /** L'elemento col fuoco: il suo id, o il valore della sua scelta, o il nome del tag. */
  readonly fuoco: string;
  readonly colori: Readonly<Record<string, string | null>>;
  readonly disegno: FotografiaDelDisegno;
  /** «Salva il codice come…»: se il comando c'è, l'avviso (il suo testo e i suoi pulsanti) e la riga del file salvato. */
  readonly salvataggio: {
    readonly comando: string | null;
    readonly avviso: string | null;
    readonly pulsanti: readonly string[];
    /** I pulsanti dell'avviso come si vedono: il colore del testo e del bordo. */
    readonly aspetti: readonly { readonly testo: string; readonly colore: string; readonly bordo: string }[];
    readonly riga: string | null;
  };
  /** La scelta dello stato mostrato (linguaggio e lingua, come identificativi); null prima del primo stato. */
  readonly scelta: Scelta | null;
  readonly versione: number;
};

/** Solo per la prova: la misura fissa (quella della conformità, al posto del canvas), un carattere diverso da chiedere, e il nucleo
 *  della pagina che si ferma (un'eccezione) aprendo il flowchart o disegnandolo. */
export type Prova = { readonly misuraFissa: boolean; readonly carattere: string | null; readonly fermo?: "apri" | "disegna" };

export type VersoLaPagina =
  | { readonly tipo: "stato"; readonly stato: Stato }
  | { readonly tipo: "fotografia"; readonly id: number }
  | { readonly tipo: "clic"; readonly id: number; readonly selettore: string }
  | { readonly tipo: "tasto"; readonly id: number; readonly selettore: string; readonly tasto: string; readonly maiuscolo: boolean }
  | { readonly tipo: "scorri"; readonly id: number }
  | { readonly tipo: "prova"; readonly prova: Prova }
  | { readonly tipo: "salvataggio"; readonly salvataggio: Salvataggio };

export type DallaPagina =
  | { readonly tipo: "pronta" }
  | { readonly tipo: "scegli"; readonly linguaggio?: string; readonly lingua?: "it" | "en" }
  | { readonly tipo: "vista"; readonly vista: Vista }
  | { readonly tipo: "apriComeTesto" }
  /** «Salva il codice come…»; poi, dall'avviso, «Salva con un altro nome» o «Sostituisci». */
  | { readonly tipo: "salva" | "salvaConAltroNome" | "sostituisci" }
  | { readonly tipo: "fotografia"; readonly id: number; readonly fotografia: Fotografia | null; readonly errore?: string };

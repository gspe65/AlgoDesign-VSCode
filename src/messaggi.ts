// I messaggi fra l'estensione e la pagina. Solo tipi: li usano tutti e due i lati.

import type { Colori } from "./colori";
import type { Modello, Testi } from "./documento";

export type Scelta = { readonly linguaggio: string; readonly lingua: "it" | "en" };

export type Stato = {
  readonly modello: Modello;
  readonly testi: Testi;
  /** I linguaggi offerti, nell'ordine dei pulsanti, col nome da mostrare. */
  readonly offerti: readonly { readonly id: string; readonly nome: string }[];
  readonly lingue: readonly { readonly id: "it" | "en"; readonly nome: string }[];
  readonly scelta: Scelta;
  readonly colori: Colori;
  /** Un numero che cresce a ogni stato nuovo: la pagina riporta il codice su `main` solo se cambia il codice. */
  readonly versione: number;
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
  readonly versione: number;
};

export type VersoLaPagina = { readonly tipo: "stato"; readonly stato: Stato } | { readonly tipo: "fotografia"; readonly id: number } | { readonly tipo: "clic"; readonly id: number; readonly selettore: string };

export type DallaPagina =
  | { readonly tipo: "pronta" }
  | { readonly tipo: "scegli"; readonly linguaggio?: string; readonly lingua?: "it" | "en" }
  | { readonly tipo: "apriComeTesto" }
  | { readonly tipo: "fotografia"; readonly id: number; readonly fotografia: Fotografia | null; readonly errore?: string };

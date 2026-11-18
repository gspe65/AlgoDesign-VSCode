// La pagina del flowchart, dentro la webview: mostra lo stato che l'estensione le manda, disegna il flowchart col nucleo di
// AlgoDesign e rimanda le scelte. Il nucleo è lo stesso file che l'estensione carica, eseguito prima di questa pagina come
// script classico (con l'impronta verificata dal browser): qui si trova in `module.exports`. Il DOM si costruisce con
// createElement e textContent; l'SVG del nucleo si legge con DOMParser; i colori del codice e le misure sono proprietà CSS messe
// da qui, che la politica dei contenuti della pagina permette.
//
// Il testo si misura col canvas, dopo `document.fonts.ready`, nel carattere del disegno e nei tre stili che il nucleo usa; il
// carattere che il canvas tiene si rilegge, e se non è quello chiesto (un nome che il canvas ignora in silenzio) il disegno non si
// fa e la pagina lo dice.
//
// La pagina rinasce quando la sua scheda torna in primo piano (l'editor la toglie quando è nascosta): lo zoom, il divisore, il
// riquadro, la funzione aperta e la riga del codice in cima si salvano nello stato della pagina a ogni cambio (`setState`), e
// alla nascita si rileggono (`getState`).

import type { EsitoDelControllo, LinguaDelCodice, MisuraDelTesto, Progetto } from "algodesign-core";
import { appaiamento, blocchiSegnalati, type Bollino } from "../bollini";
import { pezzi, SPECIE } from "../colori";
import type { DallaPagina, Fotografia, FotografiaDelDisegno, Prova, Salvataggio, Stato, VersoLaPagina, Vista } from "../messaggi";
import { limitaIlDivisore, limitaLaScala, PASSO, PASSO_DEL_DIVISORE, scalaAdatta, STILI, stileTenuto, valida } from "../vista";

/** Ciò che la pagina ricorda di sé quando rinasce. `codice` riconosce il codice per cui vale la riga in cima. */
type Ricordo = { readonly vista: Vista | null; readonly scheda: string | null; readonly riga: { readonly codice: string; readonly riga: number } | null };
declare function acquireVsCodeApi(): { postMessage(m: DallaPagina): void; getState(): unknown; setState(s: Ricordo): void };
const editor = acquireVsCodeApi();
const manda = (m: DallaPagina) => editor.postMessage(m);
const ricordo = ((): Ricordo => {
  const r = editor.getState() as Partial<Ricordo> | undefined;
  return { vista: r?.vista ?? null, scheda: typeof r?.scheda === "string" ? r.scheda : null, riga: r?.riga ?? null };
})();
/** Un valore per questa nascita della pagina (per la prova: la pagina tornata in primo piano è rinata davvero). */
const NASCITA = `${Date.now()}-${Math.random()}`;

type Nucleo = {
  apri(testo: string): { ok: true; progetto: Progetto } | { ok: false };
  controlla(p: Progetto): EsitoDelControllo;
  disegna(p: Progetto, funzione: string, lingua: LinguaDelCodice, misura: MisuraDelTesto, carattere: string, opzioni?: { errori?: EsitoDelControllo }): { svg: string; larghezza: number; altezza: number };
};
const esportato = (window as unknown as { module?: { exports?: Partial<Nucleo> } }).module?.exports;
const nucleo: Nucleo | null = typeof esportato?.disegna === "function" && typeof esportato.apri === "function" && typeof esportato.controlla === "function" ? (esportato as Nucleo) : null;
const INTEGRITA = document.getElementById("nucleo")?.getAttribute("integrity") ?? "";

/** Il carattere del disegno, come in AlgoDesign (la dimensione è `DIMENSIONE_DEL_CARATTERE`); la misura fissa è quella della
 *  conformità (7 pixel a carattere). */
const CARATTERE = "system-ui, sans-serif";
const misuraFissa: MisuraDelTesto = (t, stile) => t.length * 7 + (stile === "grassetto" ? t.length : stile === "corsivo" ? t.length / 2 : 0);

const radice = document.getElementById("radice")!;
let stato: Stato | null = null;
let schedaAttiva: string | null = ricordo.scheda;
let vista: Vista | null = ricordo.vista === null ? null : valida(ricordo.vista);
/** La riga del codice in cima, ricordata per il codice mostrato (la chiave ridotta a un'impronta corta). */
let rigaRicordata: { codice: string; riga: number } | null = ricordo.riga;
let prova: Prova = { misuraFissa: false, carattere: null };
/** Il blocco mostrato dal clic su una segnalazione (resta evidenziato fino al clic successivo). */
let evidenziato: { blocco: string | null; funzione: string; dove: string } | null = null;
let codiceMostrato = "";
/** Ciò che la pagina dice di «Salva il codice come…»; vale per il codice mostrato, e sparisce quando il codice cambia. */
let salvataggio: Salvataggio = null;
/** Il progetto del testo ricevuto, aperto una volta per testo. */
let aperto: { testo: string | null; progetto: Progetto | null; controllo: EsitoDelControllo | null } = { testo: null, progetto: null, controllo: null };
/** L'ultimo disegno fatto: per adattarlo all'area e per la fotografia. */
let disegnato: { svg: string; larghezza: number; altezza: number; carattere: { chiesto: string; riletto: string } | null } | null = null;
let frase: string | null = null;
/** Il carattere chiesto al canvas all'ultimo disegno e quello che il canvas ha tenuto (null con la misura fissa), e i tre stili. */
let ultimaLettura: { chiesto: string; riletto: string } | null = null;
let ultimiStili: FotografiaDelDisegno["stili"] = [];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attributi: Record<string, string> = {}, ...figli: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi)) e.setAttribute(k, v);
  for (const f of figli) e.append(f);
  return e;
}
const riempi = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? `{${k}}`);

function ricordaVista(nuova: Vista): void {
  vista = valida(nuova);
  manda({ tipo: "vista", vista });
  salvaIlRicordo();
}

/** Lo stato della pagina salvato in sé: lo rilegge quando rinasce. */
function salvaIlRicordo(): void {
  editor.setState({ vista, scheda: schedaAttiva, riga: rigaRicordata });
}

/** Un'impronta corta di un testo (per riconoscere il codice senza salvarlo intero). */
function improntaCorta(t: string): string {
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return `${t.length}:${h.toString(36)}`;
}

/** Un gruppo di pulsanti a scelta unica, con le frecce per muoversi (un solo pulsante raggiungibile col tabulatore). */
function gruppo(etichetta: string, voci: readonly { id: string; nome: string }[], attiva: string, scegli: (id: string) => void): HTMLElement {
  const g = el("div", { role: "radiogroup", "aria-label": etichetta, class: "gruppo" }, el("span", { class: "etichetta", "aria-hidden": "true" }, etichetta));
  const pulsanti = voci.map((v) => {
    const b = el("button", { type: "button", role: "radio", "aria-checked": String(v.id === attiva), tabindex: v.id === attiva ? "0" : "-1", "data-scelta": v.id }, v.nome);
    b.addEventListener("click", () => scegli(v.id));
    return b;
  });
  g.addEventListener("keydown", (e) => {
    const i = pulsanti.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const passo = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (passo === 0) return;
    e.preventDefault();
    const prossimo = pulsanti[(i + passo + pulsanti.length) % pulsanti.length]!;
    prossimo.focus();
    prossimo.click();
  });
  g.append(...pulsanti);
  return g;
}

/** Il codice, una riga per elemento, coi numeri di riga fuori dal testo e le parti colorate. Una riga che non ci sta va a capo,
 *  e il seguito parte più a destra del suo rientro (`--rientro`, in caratteri, letto dagli spazi in testa alla riga). */
function codice(testo: string, linguaggio: string, etichetta: string): HTMLElement {
  const pre = el("pre", { id: "codice", tabindex: "0", "aria-label": etichetta });
  const righe: HTMLElement[] = [];
  let riga = el("span", { class: "t" });
  const chiudi = () => {
    const rientro = (/^[ \t]*/.exec(riga.textContent ?? "")?.[0] ?? "").replace(/\t/g, "    ").length;
    riga.style.setProperty("--rientro", String(rientro));
    righe.push(el("div", { class: "riga" }, el("span", { class: "n", "aria-hidden": "true" }, String(righe.length + 1)), riga));
    riga = el("span", { class: "t" });
  };
  for (const p of pezzi(testo, linguaggio)) {
    const parti = p.testo.split("\n");
    parti.forEach((parte, i) => {
      if (i > 0) chiudi();
      if (parte !== "") riga.append(p.specie === null ? parte : el("span", { class: `k-${p.specie}` }, parte));
    });
  }
  if (riga.textContent !== "" || !testo.endsWith("\n")) chiudi();
  pre.append(...righe);
  return pre;
}

// --- Il disegno.

/** La misura del testo nel carattere dato, col canvas, un contesto per ciascuno dei tre stili che il nucleo misura (come
 *  AlgoDesign); ogni stile chiesto si rilegge. `misura` c'è solo se il canvas li ha tenuti tutti e tre. */
function misuraDelCanvas(carattere: string): { misura: MisuraDelTesto | null; stili: FotografiaDelDisegno["stili"] } {
  const contesti = new Map<string, CanvasRenderingContext2D>();
  const stili = STILI.map((s) => {
    const ctx = document.createElement("canvas").getContext("2d");
    const { chiesto } = stileTenuto(s, carattere, "");
    if (ctx === null) return { stile: s.stile, chiesto, riletto: "", tenuto: false };
    ctx.font = chiesto;
    const riletto = ctx.font;
    const { tenuto } = stileTenuto(s, carattere, riletto);
    contesti.set(s.stile, ctx);
    return { stile: s.stile, chiesto, riletto, tenuto };
  });
  if (!stili.every((s) => s.tenuto)) return { misura: null, stili };
  return { stili, misura: (t, stile) => contesti.get(stile ?? "normale")!.measureText(t).width };
}

/** Disegna la funzione nella lingua scelta; il risultato in `disegnato`, o la frase che dice perché non c'è in `frase`. */
function faiIlDisegno(s: Stato, funzione: string | null): void {
  disegnato = null;
  frase = null;
  if (nucleo === null) {
    frase = s.testi.nucleoAssente;
    return;
  }
  // Senza un progetto (il file non si legge, non è un flowchart, il nucleo dell'estensione manca o si è fermato) il disegno dice
  // lo stesso motivo del codice.
  const senzaProgetto = s.modello.funzioni.length === 0 && "assente" in s.modello.codice ? s.modello.codice.assente : s.testi.apri;
  try {
    if (aperto.testo !== s.testo) {
      const a = nucleo.apri(s.testo);
      aperto = a.ok ? { testo: s.testo, progetto: a.progetto, controllo: nucleo.controlla(a.progetto) } : { testo: s.testo, progetto: null, controllo: null };
    }
  } catch {
    aperto = { testo: s.testo, progetto: null, controllo: null };
    frase = s.testi.nucleoFermo;
    return;
  }
  if (aperto.progetto === null || aperto.controllo === null || funzione === null) {
    frase = senzaProgetto;
    return;
  }
  const carattere = prova.carattere ?? CARATTERE;
  let misura: MisuraDelTesto;
  let lettura: { chiesto: string; riletto: string } | null = null;
  if (prova.misuraFissa) {
    misura = misuraFissa;
    ultimiStili = [];
  } else {
    const m = misuraDelCanvas(carattere);
    const normale = m.stili[0]!;
    lettura = { chiesto: normale.chiesto, riletto: normale.riletto };
    ultimiStili = m.stili;
    if (m.misura === null) {
      frase = riempi(s.testi.carattereIgnorato, { carattere });
      ultimaLettura = lettura;
      return;
    }
    misura = m.misura;
  }
  ultimaLettura = lettura;
  try {
    const d = nucleo.disegna(aperto.progetto, funzione, s.scelta.lingua, misura, carattere, { errori: aperto.controllo });
    disegnato = { ...d, carattere: lettura };
  } catch {
    frase = s.testi.nucleoFermo;
  }
}

function conteggio(s: Stato, funzione: string | null): string {
  const sue = s.modello.segnalazioni.filter((v) => v.funzione === funzione);
  const e = sue.filter((v) => v.genere === "errore").length;
  const a = sue.length - e;
  const parti = [e === 1 ? s.testi.errori1 : e > 1 ? riempi(s.testi.erroriN, { n: String(e) }) : "", a === 1 ? s.testi.avvisi1 : a > 1 ? riempi(s.testi.avvisiN, { n: String(a) }) : ""].filter(Boolean);
  return parti.length === 0 ? s.testi.senzaSegnalazioni : parti.join(", ");
}

/** L'SVG del nucleo nel foglio, alla scala della vista, coi bollini raggiungibili da tastiera nell'ordine dell'elenco. */
function mettiIlDisegno(s: Stato, foglio: HTMLElement, funzione: string): void {
  if (disegnato === null) return;
  const doc = new DOMParser().parseFromString(disegnato.svg, "image/svg+xml");
  const svg = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
  svg.setAttribute("aria-hidden", "false");
  foglio.append(svg);
  // I bollini, ciascuno col testo della sua prima segnalazione; il tabulatore li visita nell'ordine dell'elenco.
  const ordine = blocchiSegnalati(s.modello.segnalazioni, funzione);
  const bollini = ordine.map((id) => svg.querySelector<SVGGElement>(`g[data-bollino][data-id="${CSS.escape(id)}"]`)).filter((b): b is SVGGElement => b !== null);
  bollini.forEach((b, i) => {
    const id = b.getAttribute("data-id") ?? "";
    const voci = s.modello.segnalazioni.filter((v) => v.funzione === funzione && v.blocco === id);
    b.setAttribute("tabindex", i === 0 ? "0" : "-1");
    b.setAttribute("role", "button");
    b.setAttribute("class", "bollino");
    b.setAttribute("aria-label", voci.map((v) => v.testo).join(" — "));
    const vaiAllaVoce = () => {
      const indice = s.modello.segnalazioni.findIndex((v) => v.funzione === funzione && v.blocco === id);
      for (const li of document.querySelectorAll(".voci li.scelta")) li.classList.remove("scelta");
      const voce = document.getElementById(`voce-${indice}`);
      voce?.closest("li")?.classList.add("scelta");
      voce?.scrollIntoView({ block: "nearest" });
      voce?.focus();
    };
    b.addEventListener("click", vaiAllaVoce);
    b.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        vaiAllaVoce();
      } else if (e.key === "Tab") {
        const altro = bollini[i + (e.shiftKey ? -1 : 1)];
        if (altro === undefined) return;
        e.preventDefault();
        for (const x of bollini) x.setAttribute("tabindex", "-1");
        altro.setAttribute("tabindex", "0");
        altro.focus();
      }
    });
  });
  applicaLaScala(foglio);
  // Il blocco della segnalazione cliccata: un contorno sopra il disegno, e il foglio che lo porta in vista.
  if (evidenziato !== null && evidenziato.funzione === funzione && evidenziato.blocco !== null) {
    const b = svg.querySelector<SVGGraphicsElement>(`g[data-bollino][data-id="${CSS.escape(evidenziato.blocco)}"]`);
    if (b !== null) {
      const r = b.getBBox();
      const contorno = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      for (const [k, v] of Object.entries({ x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12, rx: 4, class: "evidenza", "data-evidenza": evidenziato.blocco })) contorno.setAttribute(k, String(v));
      svg.append(contorno);
      portaInVista(foglio, contorno);
    }
  }
}

function portaInVista(foglio: HTMLElement, e: Element): void {
  const f = foglio.getBoundingClientRect();
  const r = e.getBoundingClientRect();
  foglio.scrollLeft += r.left + r.width / 2 - (f.left + f.width / 2);
  foglio.scrollTop += r.top + r.height / 2 - (f.top + f.height / 2);
}

/** La scala della vista sull'SVG del foglio; adattata, ricalcolata sull'area del foglio. */
function applicaLaScala(foglio: HTMLElement): void {
  const svg = foglio.querySelector("svg");
  if (svg === null || disegnato === null || vista === null) return;
  if (vista.adattata) {
    // L'area dall'ingombro del foglio senza bordi e margini interni, con le barre di scorrimento comprese (come AlgoDesign): con
    // clientWidth la scala si calcolerebbe su un'area più piccola di quella che resta quando, adattato, le barre spariscono.
    const stile = getComputedStyle(foglio);
    const r = foglio.getBoundingClientRect();
    const larga = r.width - parseFloat(stile.borderLeftWidth) - parseFloat(stile.borderRightWidth) - parseFloat(stile.paddingLeft) - parseFloat(stile.paddingRight);
    const alta = r.height - parseFloat(stile.borderTopWidth) - parseFloat(stile.borderBottomWidth) - parseFloat(stile.paddingTop) - parseFloat(stile.paddingBottom);
    vista = { ...vista, scala: scalaAdatta(disegnato.larghezza, disegnato.altezza, larga, alta) };
  }
  svg.style.width = `${disegnato.larghezza * vista.scala}px`;
  svg.style.height = `${disegnato.altezza * vista.scala}px`;
  const percento = document.getElementById("zoom-percento");
  if (percento !== null) {
    percento.textContent = `${Math.round(vista.scala * 100)}%`;
    percento.setAttribute("aria-label", `${Math.round(vista.scala * 100)}%, ${stato?.testi.zoomCento ?? ""}`);
  }
}

function comandiDelloZoom(s: Stato): HTMLElement {
  const t = s.testi;
  const v = vista!;
  const scala = (nuova: number) => {
    ricordaVista({ ...vista!, scala: limitaLaScala(nuova), adattata: false });
    if (stato !== null) disegna(stato);
  };
  const riduci = el("button", { type: "button", id: "zoom-riduci", class: "icona", "aria-label": t.zoomRiduci, title: t.zoomRiduci }, "−");
  riduci.addEventListener("click", () => scala(vista!.scala / PASSO));
  const percento = el("button", { type: "button", id: "zoom-percento", title: t.zoomCento, "aria-label": `${Math.round(v.scala * 100)}%, ${t.zoomCento}` }, `${Math.round(v.scala * 100)}%`);
  percento.addEventListener("click", () => scala(1));
  const ingrandisci = el("button", { type: "button", id: "zoom-ingrandisci", class: "icona", "aria-label": t.zoomIngrandisci, title: t.zoomIngrandisci }, "+");
  ingrandisci.addEventListener("click", () => scala(vista!.scala * PASSO));
  // Dopo «Adatta alla finestra» scelto dallo studente il comando diventa «Torna indietro»; l'adattamento dell'apertura no.
  const indietro = v.adattata && v.scalaPrima !== null;
  const adatta = el("button", { type: "button", id: "zoom-adatta", ...(indietro ? { title: t.zoomTornaIndietroSuggerimento } : {}) }, indietro ? t.zoomTornaIndietro : t.zoomAdatta);
  adatta.addEventListener("click", () => {
    const w = vista!;
    if (w.adattata && w.scalaPrima !== null) ricordaVista({ ...w, adattata: false, scala: w.scalaPrima, scalaPrima: null });
    else if (!w.adattata) ricordaVista({ ...w, adattata: true, scalaPrima: w.scala });
    if (stato !== null) disegna(stato);
  });
  return el("div", { role: "group", "aria-label": t.zoom, class: "zoom" }, el("span", { class: "etichetta", "aria-hidden": "true" }, t.zoom), riduci, percento, ingrandisci, adatta);
}

/** Il divisore fra disegno e codice: si trascina, o col fuoco si usano le frecce; il doppio clic lo riporta a metà. */
function divisore(s: Stato, corpo: HTMLElement): HTMLElement {
  const v = vista!;
  const d = el("div", { role: "separator", id: "divisore", tabindex: "0", "aria-orientation": "vertical", "aria-label": s.testi.divisore, "aria-valuemin": "20", "aria-valuemax": "80", "aria-valuenow": String(Math.round(v.divisore)), class: "divisore" });
  const metti = (valore: number, ricorda: boolean) => {
    const n = limitaIlDivisore(valore);
    corpo.style.setProperty("--sinistra", `${n}fr`);
    corpo.style.setProperty("--destra", `${100 - n}fr`);
    d.setAttribute("aria-valuenow", String(Math.round(n)));
    vista = { ...vista!, divisore: n };
    if (ricorda) {
      ricordaVista(vista);
      const foglio = document.getElementById("disegno");
      if (foglio !== null) applicaLaScala(foglio);
    }
  };
  d.addEventListener("pointerdown", (e) => {
    d.setPointerCapture(e.pointerId);
    const muovi = (m: PointerEvent) => {
      const r = corpo.getBoundingClientRect();
      metti(((m.clientX - r.left) / r.width) * 100, false);
    };
    const fine = () => {
      d.removeEventListener("pointermove", muovi);
      metti(vista!.divisore, true);
    };
    d.addEventListener("pointermove", muovi);
    d.addEventListener("pointerup", fine, { once: true });
  });
  d.addEventListener("keydown", (e) => {
    const passi: Record<string, number> = { ArrowLeft: -PASSO_DEL_DIVISORE, ArrowRight: PASSO_DEL_DIVISORE };
    if (e.key in passi) metti(vista!.divisore + passi[e.key]!, true);
    else if (e.key === "Home") metti(20, true);
    else if (e.key === "End") metti(80, true);
    else return;
    e.preventDefault();
  });
  d.addEventListener("dblclick", () => metti(50, true));
  metti(v.divisore, false);
  return d;
}

// --- «Salva il codice come…».

/** Il comando sopra il codice, con la riga del file salvato (o del motivo per cui non si è salvato). */
function comandoDelSalvataggio(t: Stato["testi"]): HTMLElement {
  const b = el("button", { type: "button", id: "salva-codice" }, t.salvaCodice);
  b.addEventListener("click", () => manda({ tipo: "salva" }));
  const riga = salvataggio?.stato === "salvato" ? el("span", { id: "salvato", class: "salvato" }, salvataggio.accanto ? riempi(t.salvatoAccanto, { file: salvataggio.file }) : riempi(t.salvato, { percorso: salvataggio.file })) : salvataggio?.stato === "errore" ? el("span", { id: "salvato", class: "salvato errore" }, salvataggio.testo) : null;
  return el("div", { class: "salvataggio" }, b, ...(riga === null ? [] : [riga]));
}

/** L'avviso prima della finestra: il file c'è ed è diverso. La scelta proposta è quella che non perde nulla. */
function avvisoDelSalvataggio(t: Stato["testi"]): HTMLElement | null {
  if (salvataggio?.stato !== "avviso") return null;
  const altro = el("button", { type: "button", id: "salva-con-altro-nome", class: "primario" }, t.salvaConAltroNome);
  altro.addEventListener("click", () => manda({ tipo: "salvaConAltroNome" }));
  // «Sostituisci» fa perdere le modifiche: il segno d'avviso prima della parola e il colore d'avviso del tema, diverso da «Annulla».
  const sostituisci = el("button", { type: "button", id: "sostituisci", class: "perde" }, el("span", { class: "segno-avviso", "aria-hidden": "true" }, "⚠"), ` ${t.sostituisci}`);
  sostituisci.addEventListener("click", () => manda({ tipo: "sostituisci" }));
  const annulla = el("button", { type: "button", id: "annulla-salvataggio" }, t.annullaSalvataggio);
  annulla.addEventListener("click", chiudiLAvviso);
  const avviso = el("div", { id: "avviso-salvataggio", class: "avviso", role: "group", "aria-labelledby": "avviso-testo" }, el("p", { id: "avviso-testo" }, riempi(t.esisteDiverso, { file: salvataggio.file })), el("div", { class: "pulsanti" }, altro, sostituisci, annulla));
  avviso.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    chiudiLAvviso();
  });
  return avviso;
}

function chiudiLAvviso(): void {
  salvataggio = null;
  if (stato !== null) disegna(stato);
  document.getElementById("salva-codice")?.focus();
}

function disegna(s: Stato): void {
  const { modello: m, testi } = s;
  if (vista === null) vista = valida(s.vista);
  // Ciò che la pagina dice del salvataggio vale per il codice mostrato: un altro codice (linguaggio, lingua, flowchart salvato in
  // AlgoDesign) lo toglie.
  if (salvataggio !== null && ("assente" in m.codice || `${s.scelta.linguaggio} ${s.scelta.lingua}\n${m.codice.testo}` !== codiceMostrato)) salvataggio = null;
  for (const sp of SPECIE) document.documentElement.style.setProperty(`--k-${sp}`, s.colori[sp]);
  if (schedaAttiva === null || !m.funzioni.some((f) => f.id === schedaAttiva)) schedaAttiva = m.funzioni[0]?.id ?? null;
  if (evidenziato !== null && !m.segnalazioni.some((v) => v.dove === evidenziato?.dove)) evidenziato = null;
  const chiuso = vista.chiuso;

  const testata = el("header", { class: "testata" }, el("h1", { id: "titolo" }, m.titolo));
  const riquadro = el("button", { type: "button", id: "riquadro", "aria-expanded": String(!chiuso), "aria-controls": "sinistra", title: chiuso ? testi.mostraSuggerimento : testi.nascondiSuggerimento }, chiuso ? testi.mostra : testi.nascondi);
  riquadro.addEventListener("click", () => {
    ricordaVista({ ...vista!, chiuso: !vista!.chiuso });
    if (stato !== null) disegna(stato);
    document.getElementById("riquadro")?.focus();
  });
  testata.append(riquadro);
  // «Apri il file come testo» sta coi comandi del codice, dopo «Salva il codice come…»; c'è anche quando il codice non c'è.
  const apriTesto = el("button", { type: "button", id: "apri-come-testo", title: testi.apriComeTestoSuggerimento }, testi.apriComeTesto);
  apriTesto.addEventListener("click", () => manda({ tipo: "apriComeTesto" }));

  // Le segnalazioni: sotto il disegno, o sopra il codice col riquadro chiuso (solo se ce ne sono).
  const elenco = el("ul", { class: "voci" });
  m.segnalazioni.forEach((v, i) => {
    const segno = el("span", { class: `segno ${v.genere}`, "aria-hidden": "true" }, v.genere === "errore" ? "!" : "?");
    const testo = v.funzione === null ? el("span", { class: "voce", id: `voce-${i}`, tabindex: "-1" }, v.testo) : el("button", { type: "button", class: "voce", id: `voce-${i}`, "data-funzione": v.funzione, ...(v.blocco !== null ? { "data-blocco": v.blocco } : {}) }, v.testo);
    if (v.funzione !== null) {
      const f = v.funzione;
      testo.addEventListener("click", () => {
        schedaAttiva = f;
        evidenziato = { blocco: v.blocco, funzione: f, dove: v.dove };
        if (vista!.chiuso) ricordaVista({ ...vista!, chiuso: false });
        if (stato !== null) disegna(stato);
        const annuncio = document.getElementById("annuncio");
        if (annuncio !== null) annuncio.textContent = riempi(testi.bloccoSegnalato, { dove: v.dove });
        document.getElementById("disegno")?.focus({ preventScroll: true });
      });
    }
    elenco.append(el("li", { class: v.genere }, segno, el("div", {}, testo, el("p", { class: "spiegazione" }, v.spiegazione))));
  });
  const segnalazioni = el("section", { class: "segnalazioni", "aria-labelledby": "titolo-segnalazioni" }, el("h2", { id: "titolo-segnalazioni" }, testi.segnalazioni), m.segnalazioni.length > 0 ? elenco : el("p", { class: "vuoto" }, testi.nessunaSegnalazione));

  // A sinistra: le schede delle funzioni e lo zoom, il foglio del disegno, le segnalazioni.
  const schede = el("div", { role: "tablist", "aria-label": testi.funzioni, class: "schede" });
  for (const f of m.funzioni) {
    const t = el("button", { type: "button", role: "tab", "aria-selected": String(f.id === schedaAttiva), "data-funzione": f.id, "aria-controls": "disegno" }, f.nome);
    // Il clic sulla scheda porta anche il codice alla definizione della funzione (il programma principale: a `main`).
    t.addEventListener("click", () => {
      schedaAttiva = f.id;
      if (stato === null) return;
      disegna(stato);
      const c = stato.modello.codice;
      const riga = "assente" in c ? undefined : (c.righeDelleFunzioni[f.id] ?? (f.nome === testi.principale ? c.rigaDiMain : undefined));
      if (riga !== undefined) portaSullaRiga(riga);
    });
    schede.append(t);
  }
  faiIlDisegno(s, schedaAttiva);
  const nomeDellaFunzione = m.funzioni.find((f) => f.id === schedaAttiva)?.nome ?? "";
  const foglio = el("div", { id: "disegno", role: "tabpanel", tabindex: "0", class: "foglio", "aria-label": riempi(testi.disegnoDi, { funzione: nomeDellaFunzione, conteggio: conteggio(s, schedaAttiva) }) });
  if (frase !== null) foglio.append(el("p", { id: "frase-del-disegno", class: "frase" }, frase));
  const sopra = el("div", { class: "sopra-il-foglio" }, schede, ...(disegnato !== null ? [comandiDelloZoom(s)] : []));
  const sinistra = el("section", { class: "sinistra", id: "sinistra", "aria-label": nomeDellaFunzione }, sopra, foglio, ...(chiuso ? [] : [segnalazioni]));

  // A destra: le scelte sopra il codice, e il codice o la frase che dice perché non c'è.
  const nomeDelLinguaggio = s.offerti.find((o) => o.id === s.scelta.linguaggio)?.nome ?? s.scelta.linguaggio;
  const scelte = el(
    "div",
    { class: "scelte" },
    gruppo(testi.linguaggio, s.offerti, s.scelta.linguaggio, (id) => manda({ tipo: "scegli", linguaggio: id })),
    gruppo(testi.lingua, s.lingue, s.scelta.lingua, (id) => manda({ tipo: "scegli", lingua: id as "it" | "en" })),
    // Il codice assente (il flowchart ha errori) non si salva: il comando non c'è.
    el("div", { class: "comandi-del-codice" }, ...("assente" in m.codice ? [] : [comandoDelSalvataggio(testi)]), apriTesto),
  );
  const avviso = avvisoDelSalvataggio(testi);
  const contenuto = "assente" in m.codice ? el("p", { id: "assente", class: "assente" }, m.codice.assente) : codice(m.codice.testo, s.scelta.linguaggio, testi.codiceIn.replace("{linguaggio}", nomeDelLinguaggio));
  const titoloDelCodice = el("h2", { id: "titolo-del-codice", class: "titolo-del-codice" }, testi.titoloDelCodice);
  const destra = el("section", { class: "destra", "aria-labelledby": "titolo-del-codice" }, titoloDelCodice, scelte, ...(avviso === null ? [] : [avviso]), ...(chiuso && m.segnalazioni.length > 0 ? [segnalazioni] : []), contenuto);

  const corpo = el("div", { class: chiuso ? "corpo chiuso" : "corpo" });
  if (chiuso) corpo.append(destra);
  else corpo.append(sinistra, divisore(s, corpo), destra);

  const attivo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const fuoco = attivo === null ? "" : (attivo.dataset["scelta"] ?? attivo.id);
  // Lo scorrimento del codice resta com'era quando la pagina si ridisegna con lo stesso codice (lo zoom, una scheda, il divisore).
  const altoDelCodice = document.getElementById("codice")?.scrollTop ?? 0;
  radice.replaceChildren(testata, corpo, el("p", { id: "annuncio", class: "solo-lettura", "aria-live": "polite" }));
  const pre = document.getElementById("codice");
  if (pre !== null) {
    pre.addEventListener("scroll", ricordaLaRiga, { passive: true });
    if (!("assente" in m.codice) && `${s.scelta.linguaggio} ${s.scelta.lingua}\n${m.codice.testo}` === codiceMostrato) pre.scrollTop = altoDelCodice;
  }
  osservatoreDelFoglio.disconnect();
  osservatoreDellaBarra.disconnect();
  osservatoreDellaBarra.observe(scelte);
  if (!chiuso && schedaAttiva !== null) {
    mettiIlDisegno(s, foglio, schedaAttiva);
    osservatoreDelFoglio.observe(foglio, { box: "border-box" });
  }
  // Il fuoco resta dove lo studente l'aveva: sul pulsante scelto o sull'elemento con lo stesso id.
  const ritrovato = fuoco !== "" ? (radice.querySelector<HTMLElement>(`[data-scelta="${CSS.escape(fuoco)}"]`) ?? document.getElementById(fuoco)) : null;
  ritrovato?.focus({ preventScroll: true });

  // Il codice si apre sulla riga di `main`, solo quando cambia il codice: un aggiornamento uguale non sposta chi sta leggendo. La
  // pagina rinata torna invece alla riga che aveva in cima, se il codice è lo stesso.
  if (!("assente" in m.codice)) {
    const chiave = `${s.scelta.linguaggio} ${s.scelta.lingua}\n${m.codice.testo}`;
    if (chiave !== codiceMostrato) {
      codiceMostrato = chiave;
      portaSullaRiga(rigaRicordata !== null && rigaRicordata.codice === improntaCorta(chiave) ? rigaRicordata.riga : m.codice.rigaDiMain);
    }
  } else codiceMostrato = "";
  salvaIlRicordo();
}

/** La prima riga del codice che si vede: dal bordo interno, e una riga è visibile se ne sporgono più di 2 pixel (lo scorrimento si
 *  arrotonda al pixel, e con un'altra altezza delle righe una frazione della riga sopra restava «visibile»: misurato, 25 invece di
 *  26, sulle macchine delle Actions). */
function rigaInCimaDi(pre: HTMLElement): number | null {
  const cima = pre.getBoundingClientRect().top + pre.clientTop;
  const righe = pre.children;
  for (let i = 0; i < righe.length; i++) if (righe[i]!.getBoundingClientRect().bottom > cima + 2) return i + 1;
  return null;
}

/** La riga in cima, ricordata a ogni scorrimento del codice (una volta per fotogramma). */
let ricordoInAttesa = false;
function ricordaLaRiga(): void {
  if (ricordoInAttesa) return;
  ricordoInAttesa = true;
  requestAnimationFrame(() => {
    ricordoInAttesa = false;
    const pre = document.getElementById("codice");
    const riga = pre === null ? null : rigaInCimaDi(pre);
    if (riga === null || codiceMostrato === "") return;
    rigaRicordata = { codice: improntaCorta(codiceMostrato), riga };
    salvaIlRicordo();
  });
}

/** Porta il codice su una riga (quella di `main` all'apertura, o della funzione della scheda). Lo rifà dopo il primo disegno, a
 *  caratteri pronti e poco dopo, finché lo studente non tocca il codice: misurato nell'editor vero, un solo scorrimento subito
 *  restava sei righe sopra (l'impaginazione cambiava dopo). */
function portaSullaRiga(riga: number): void {
  const pre = document.getElementById("codice");
  if (pre === null) return;
  let toccato = false;
  for (const evento of ["wheel", "pointerdown", "keydown"]) pre.addEventListener(evento, () => (toccato = true), { once: true });
  const vai = () => {
    const r = pre.children[riga - 1];
    if (toccato || !pre.isConnected || r === undefined) return;
    // Al bordo dell'area visibile, non sotto il margine interno: lì si vedrebbe un pezzo della riga sopra.
    pre.scrollTop += r.getBoundingClientRect().top - pre.getBoundingClientRect().top - pre.clientTop;
  };
  vai();
  requestAnimationFrame(vai);
  void document.fonts.ready.then(vai);
  setTimeout(vai, 300);
}

// Il foglio che cambia misura (la finestra, il divisore, le segnalazioni accanto) ricalcola la scala adattata. Si osserva il
// foglio stesso, nel suo ingombro: osservare la pagina non basta (misurato nell'editor vero: il foglio si accorciava dopo il primo
// adattamento e il disegno non ci stava più).
const osservatoreDelFoglio = new ResizeObserver(() => {
  const foglio = document.getElementById("disegno");
  if (foglio !== null && vista?.adattata) applicaLaScala(foglio);
});
// L'altezza della barra sopra il codice (va a capo quando la colonna è stretta): a una colonna il codice prende il resto della
// finestra.
const osservatoreDellaBarra = new ResizeObserver((voci) => {
  const barra = voci[0]?.target as HTMLElement | undefined;
  if (barra !== undefined) document.documentElement.style.setProperty("--barra", `${barra.offsetHeight}px`);
});

// --- Ciò che lo schermo mostra, letto dal DOM.

function fotografiaDelDisegno(): FotografiaDelDisegno {
  const foglio = document.getElementById("disegno");
  const svg = foglio?.querySelector("svg") ?? null;
  const contorno = svg?.querySelector("[data-evidenza]") ?? null;
  let inVista = false;
  if (foglio && contorno) {
    const f = foglio.getBoundingClientRect();
    const r = contorno.getBoundingClientRect();
    inVista = r.left >= f.left - 1 && r.right <= f.right + 1 && r.top >= f.top - 1 && r.bottom <= f.bottom + 1;
  }
  const bollini = [...(svg?.querySelectorAll<SVGGElement>("g[data-bollino]") ?? [])];
  // Nell'ordine del tabulatore: quello raggiungibile per primo, poi gli altri nell'ordine dell'elenco.
  const ordine = stato === null || schedaAttiva === null ? [] : blocchiSegnalati(stato.modello.segnalazioni, schedaAttiva);
  const visti: Bollino[] = bollini.map((b) => ({ id: b.getAttribute("data-id") ?? "", segno: b.getAttribute("data-segno") ?? "", codici: b.getAttribute("data-codici") ?? "" }));
  visti.sort((a, b) => (ordine.indexOf(a.id) + 1 || 1e9) - (ordine.indexOf(b.id) + 1 || 1e9));
  const zoom = [...document.querySelectorAll<HTMLElement>(".zoom button")].map((b) => ({ nome: b.getAttribute("aria-label") ?? b.textContent ?? "", testo: b.textContent ?? "" }));
  return {
    nucleo: nucleo === null ? "assente" : "caricato",
    integrita: INTEGRITA,
    svg: disegnato?.svg ?? null,
    frase,
    larghezza: disegnato?.larghezza ?? null,
    altezza: disegnato?.altezza ?? null,
    scala: vista?.scala ?? 1,
    adattata: vista?.adattata ?? true,
    staNelFoglio: (() => {
      if (!foglio || !svg) return false;
      const f = foglio.getBoundingClientRect();
      const r = svg.getBoundingClientRect();
      return r.left >= f.left - 1 && r.right <= f.right + 1 && r.top >= f.top - 1 && r.bottom <= f.bottom + 1;
    })(),
    carattere: ultimaLettura,
    stili: ultimiStili,
    bollini: visti.map((b) => ({ ...b, etichetta: bollini.find((x) => x.getAttribute("data-id") === b.id)?.getAttribute("aria-label") ?? "" })),
    appaiamento: appaiamentoDellaScheda(),
    evidenziato: contorno?.getAttribute("data-evidenza") ?? null,
    evidenziatoInVista: inVista,
    etichetta: foglio?.getAttribute("aria-label") ?? "",
    zoom,
    chiuso: vista?.chiuso ?? false,
    divisore: vista?.divisore ?? 50,
    divisoreVisibile: (() => {
      const d = document.getElementById("divisore");
      return d !== null && d.getBoundingClientRect().width > 0;
    })(),
    larghezzaPagina: window.innerWidth,
  };
}

/** Le coppie bollino-segnalazione della scheda attiva che non tornano (la prova le vuole vuote). */
function appaiamentoDellaScheda(): string[] {
  if (stato === null || schedaAttiva === null || disegnato === null) return [];
  const bollini = [...document.querySelectorAll<SVGGElement>("#disegno g[data-bollino]")].map((b) => ({ id: b.getAttribute("data-id") ?? "", segno: b.getAttribute("data-segno") ?? "", codici: b.getAttribute("data-codici") ?? "" }));
  return appaiamento(bollini, stato.modello.segnalazioni, schedaAttiva);
}

/** Il codice che va a capo, misurato: le righe su più righe dello schermo, la larghezza del contenuto e quella visibile, e per la
 *  prima riga a capo dove comincia il testo (il primo carattere non bianco) e dove il seguito (il primo carattere della seconda
 *  riga dello schermo). */
function aCapo(pre: HTMLElement | null): Fotografia["aCapo"] {
  if (pre === null) return { righe: 0, larghezza: 0, larghezzaVisibile: 0, rientro: null };
  const testi = [...pre.querySelectorAll<HTMLElement>(".riga .t")];
  const altezzaDellaRiga = parseFloat(getComputedStyle(pre).lineHeight) || 18;
  const lunghe = testi.filter((t) => t.getBoundingClientRect().height > altezzaDellaRiga * 1.5);
  let rientro: { inizio: number; seguito: number } | null = null;
  const prima = lunghe[0];
  if (prima !== undefined) {
    // I caratteri della riga uno per uno, coi loro rettangoli: il primo non bianco, e il primo che sta più in basso della prima riga.
    const caratteri: { c: string; r: DOMRect }[] = [];
    const scorri = document.createTreeWalker(prima, NodeFilter.SHOW_TEXT);
    for (let n = scorri.nextNode(); n !== null; n = scorri.nextNode())
      for (let i = 0; i < (n.textContent ?? "").length; i++) {
        const intervallo = document.createRange();
        intervallo.setStart(n, i);
        intervallo.setEnd(n, i + 1);
        const r = intervallo.getClientRects()[0];
        if (r !== undefined) caratteri.push({ c: n.textContent![i]!, r });
      }
    const primoPieno = caratteri.find((x) => x.c.trim() !== "");
    const seguito = caratteri.find((x) => x.c.trim() !== "" && caratteri[0] !== undefined && x.r.top > caratteri[0].r.top + altezzaDellaRiga / 2);
    if (primoPieno !== undefined && seguito !== undefined) rientro = { inizio: primoPieno.r.left, seguito: seguito.r.left };
  }
  return { righe: lunghe.length, larghezza: pre.scrollWidth, larghezzaVisibile: pre.clientWidth, rientro };
}

/** Dove starebbe la barra se non restasse in cima (per la prova: se lì sarebbe uscita dalla finestra, restare in vista è merito
 *  dell'aggancio). Si toglie l'aggancio un attimo e si rimette: la barra occupa lo stesso posto nel flusso, nulla si sposta. */
function senzaAggancio(barra: HTMLElement | null): number {
  if (barra === null) return Number.NaN;
  barra.style.position = "static";
  const alto = barra.getBoundingClientRect().top;
  barra.style.position = "";
  return alto;
}

function fotografia(): Fotografia {
  const pre = document.getElementById("codice");
  const righe = pre === null ? [] : [...pre.querySelectorAll<HTMLElement>(".riga")];
  const rigaInCima = pre === null ? null : rigaInCimaDi(pre);
  let rigaInFondo: number | null = null;
  if (pre !== null) {
    const fondo = pre.getBoundingClientRect().bottom - pre.clientTop;
    const ultima = righe.findLastIndex((r) => r.getBoundingClientRect().top < fondo - 2);
    rigaInFondo = ultima < 0 ? null : ultima + 1;
  }
  const scelte = document.querySelector<HTMLElement>(".destra .scelte");
  const destra = document.querySelector<HTMLElement>(".destra");
  const apriTesto = document.getElementById("apri-come-testo");
  const pulsanti = (etichetta: string) => [...document.querySelectorAll<HTMLElement>(`[role=radiogroup][aria-label="${CSS.escape(etichetta)}"] [role=radio]`)].map((b) => ({ nome: b.textContent ?? "", attivo: b.getAttribute("aria-checked") === "true" }));
  const colori: Record<string, string | null> = {};
  for (const sp of SPECIE) {
    const k = document.querySelector(`#codice .k-${sp}`);
    colori[sp] = k === null ? null : getComputedStyle(k).color;
  }
  return {
    testoVisibile: document.body.innerText,
    titolo: document.getElementById("titolo")?.textContent ?? "",
    codice: pre === null ? null : righe.map((r) => r.querySelector(".t")?.textContent ?? "").join("\n"),
    assente: document.getElementById("assente")?.textContent ?? null,
    linguaggi: stato === null ? [] : pulsanti(stato.testi.linguaggio),
    lingue: stato === null ? [] : pulsanti(stato.testi.lingua),
    funzioni: [...document.querySelectorAll<HTMLElement>("[role=tab]")].map((t) => ({ nome: t.textContent ?? "", attiva: t.getAttribute("aria-selected") === "true" })),
    voci: [...document.querySelectorAll<HTMLElement>(".voci li")].map((l) => l.innerText),
    rigaInCima,
    rigaInFondo,
    codiceInFondo: pre !== null && pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 2,
    nascita: NASCITA,
    titoloDelCodice: document.getElementById("titolo-del-codice")?.textContent ?? null,
    pulsanteDelTesto: apriTesto === null ? null : { testo: apriTesto.textContent ?? "", suggerimento: apriTesto.getAttribute("title") ?? "" },
    aCapo: aCapo(pre),
    colonna: { barra: scelte?.getBoundingClientRect().top ?? Number.NaN, barraSenzaAggancio: senzaAggancio(scelte), riquadro: destra?.getBoundingClientRect().top ?? Number.NaN, altezzaDelCodice: pre?.getBoundingClientRect().height ?? 0, altezzaDellaFinestra: window.innerHeight, scorrimento: window.scrollY },
    editabili: document.querySelectorAll("input, textarea, select, [contenteditable]:not([contenteditable=false])").length,
    colori,
    fuoco: document.activeElement instanceof Element ? (document.activeElement.id || (document.activeElement as HTMLElement).dataset?.["scelta"] || (document.activeElement.getAttribute("data-id") !== null ? `bollino:${document.activeElement.getAttribute("data-id")}` : document.activeElement.tagName.toLowerCase())) : "",
    disegno: fotografiaDelDisegno(),
    salvataggio: {
      comando: document.getElementById("salva-codice")?.textContent ?? null,
      avviso: document.getElementById("avviso-testo")?.textContent ?? null,
      pulsanti: [...document.querySelectorAll<HTMLElement>("#avviso-salvataggio button")].map((b) => b.textContent ?? ""),
      aspetti: [...document.querySelectorAll<HTMLElement>("#avviso-salvataggio button")].map((b) => ({ testo: b.textContent ?? "", colore: getComputedStyle(b).color, bordo: getComputedStyle(b).borderTopColor })),
      riga: document.getElementById("salvato")?.textContent ?? null,
    },
    versione: stato?.versione ?? -1,
  };
}

window.addEventListener("message", (e: MessageEvent<VersoLaPagina>) => {
  const m = e.data;
  if (m.tipo === "stato") {
    stato = m.stato;
    disegna(m.stato);
  } else if (m.tipo === "salvataggio") {
    salvataggio = m.salvataggio;
    if (stato !== null) disegna(stato);
    // Il fuoco sulla scelta proposta dell'avviso; il file salvato e un errore li dice anche la lettura dello schermo.
    if (salvataggio?.stato === "avviso") document.getElementById("salva-con-altro-nome")?.focus();
    const detto = salvataggio?.stato === "avviso" ? document.getElementById("avviso-testo")?.textContent : document.getElementById("salvato")?.textContent;
    const annuncio = document.getElementById("annuncio");
    if (annuncio !== null && detto) annuncio.textContent = detto;
  } else if (m.tipo === "fotografia") manda({ tipo: "fotografia", id: m.id, fotografia: fotografia() });
  else if (m.tipo === "scorri") {
    // La pagina scorsa fino in fondo (come la rotella fuori dal codice), poi la fotografia al fotogramma dopo.
    window.scrollTo(0, document.documentElement.scrollHeight);
    requestAnimationFrame(() => manda({ tipo: "fotografia", id: m.id, fotografia: fotografia() }));
  } else if (m.tipo === "prova") {
    prova = m.prova;
    if (stato !== null) disegna(stato);
  } else if (m.tipo === "tasto") {
    // Un tasto premuto sull'elemento col fuoco: arriva ai gestori della pagina (non alle azioni predefinite del browser).
    const bersaglio = document.querySelector<HTMLElement | SVGElement>(m.selettore);
    if (bersaglio === null) manda({ tipo: "fotografia", id: m.id, fotografia: null, errore: `nessun elemento per ${m.selettore}` });
    else {
      bersaglio.focus();
      bersaglio.dispatchEvent(new KeyboardEvent("keydown", { key: m.tasto, shiftKey: m.maiuscolo, bubbles: true, cancelable: true }));
      manda({ tipo: "fotografia", id: m.id, fotografia: fotografia() });
    }
  } else if (m.tipo === "clic") {
    const bersaglio = document.querySelector<Element>(m.selettore);
    if (bersaglio === null) manda({ tipo: "fotografia", id: m.id, fotografia: null, errore: `nessun elemento per ${m.selettore}` });
    else {
      // Un clic vero sull'elemento (anche un bollino dell'SVG, che non ha `click()`).
      bersaglio.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      // Il clic manda una scelta all'estensione: la fotografia la chiede chi prova, quando lo stato nuovo è arrivato.
      manda({ tipo: "fotografia", id: m.id, fotografia: fotografia() });
    }
  }
});
// Quando l'editor dà il fuoco alla pagina e dentro non c'è nessun elemento col fuoco, lo prende la scheda della funzione mostrata:
// il tabulatore parte da lì (dall'apertura servivano nove Tab per entrare nella pagina).
window.addEventListener("focus", () => {
  if (document.activeElement === null || document.activeElement === document.body) document.querySelector<HTMLElement>('[role=tab][aria-selected="true"]')?.focus();
});
// La misura del testo vuole i caratteri pronti: la pagina si dice pronta dopo.
void document.fonts.ready.then(() => manda({ tipo: "pronta" }));

// La pagina del flowchart, dentro la webview: mostra lo stato che l'estensione le manda e le rimanda le scelte. Non calcola nulla
// del flowchart (il nucleo nella pagina arriverà col disegno). Il DOM si costruisce con createElement e textContent; i colori
// del codice sono proprietà CSS messe da qui, che la politica dei contenuti della pagina permette.

import { pezzi, SPECIE } from "../colori";
import type { DallaPagina, Fotografia, Stato, VersoLaPagina } from "../messaggi";

declare function acquireVsCodeApi(): { postMessage(m: DallaPagina): void };
const editor = acquireVsCodeApi();
const manda = (m: DallaPagina) => editor.postMessage(m);

const radice = document.getElementById("radice")!;
let stato: Stato | null = null;
let schedaAttiva: string | null = null;
/** La segnalazione cliccata: il riquadro del disegno mostra il suo blocco, finché il disegno non c'è (rilievo del valutatore). */
let segnalata: { dove: string; genere: "errore" | "avviso" } | null = null;
let codiceMostrato = "";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attributi: Record<string, string> = {}, ...figli: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi)) e.setAttribute(k, v);
  for (const f of figli) e.append(f);
  return e;
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

/** Il codice, una riga per elemento, coi numeri di riga fuori dal testo e le parti colorate. */
function codice(testo: string, linguaggio: string, etichetta: string): HTMLElement {
  const pre = el("pre", { id: "codice", tabindex: "0", "aria-label": etichetta });
  const righe: HTMLElement[] = [];
  let riga = el("span", { class: "t" });
  const chiudi = () => {
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

function disegna(s: Stato): void {
  const { modello: m, testi } = s;
  for (const sp of SPECIE) document.documentElement.style.setProperty(`--k-${sp}`, s.colori[sp]);
  if (schedaAttiva === null || !m.funzioni.some((f) => f.id === schedaAttiva)) schedaAttiva = m.funzioni[0]?.id ?? null;

  const testata = el("header", { class: "testata" }, el("h1", { id: "titolo" }, m.titolo));
  const apriTesto = el("button", { type: "button", id: "apri-come-testo" }, testi.apriComeTesto);
  apriTesto.addEventListener("click", () => manda({ tipo: "apriComeTesto" }));
  testata.append(apriTesto);

  // A sinistra: le schede delle funzioni, il posto del disegno, le segnalazioni.
  const schede = el("div", { role: "tablist", "aria-label": testi.funzioni, class: "schede" });
  for (const f of m.funzioni) {
    const t = el("button", { type: "button", role: "tab", "aria-selected": String(f.id === schedaAttiva), "data-funzione": f.id, "aria-controls": "disegno" }, f.nome);
    t.addEventListener("click", () => {
      schedaAttiva = f.id;
      if (stato !== null) disegna(stato);
    });
    schede.append(t);
  }
  if (segnalata !== null && !m.segnalazioni.some((v) => v.dove === segnalata?.dove)) segnalata = null;
  const disegno = el("div", { id: "disegno", role: "tabpanel", tabindex: "0", class: "disegno" }, el("p", {}, testi.disegno));
  if (segnalata !== null) disegno.append(el("p", { id: "blocco-segnalato", class: `segnalato ${segnalata.genere}` }, testi.bloccoSegnalato.replace("{dove}", segnalata.dove)));
  const elenco = el("ul", { class: "voci" });
  for (const v of m.segnalazioni) {
    const segno = el("span", { class: `segno ${v.genere}`, "aria-hidden": "true" }, v.genere === "errore" ? "!" : "?");
    const testo = v.funzione === null ? el("span", { class: "voce" }, v.testo) : el("button", { type: "button", class: "voce", "data-funzione": v.funzione, ...(v.blocco !== null ? { "data-blocco": v.blocco } : {}) }, v.testo);
    if (v.funzione !== null) {
      const f = v.funzione;
      testo.addEventListener("click", () => {
        schedaAttiva = f;
        segnalata = { dove: v.dove, genere: v.genere };
        if (stato !== null) disegna(stato);
        document.getElementById("disegno")?.focus();
      });
    }
    elenco.append(el("li", { class: v.genere }, segno, el("div", {}, testo, el("p", { class: "spiegazione" }, v.spiegazione))));
  }
  const segnalazioni = el("section", { class: "segnalazioni", "aria-labelledby": "titolo-segnalazioni" }, el("h2", { id: "titolo-segnalazioni" }, testi.segnalazioni), m.segnalazioni.length > 0 ? elenco : el("p", { class: "vuoto" }, testi.nessunaSegnalazione));
  const sinistra = el("section", { class: "sinistra" }, schede, disegno, segnalazioni);

  // A destra: le scelte sopra il codice, e il codice o la frase che dice perché non c'è.
  const nomeDelLinguaggio = s.offerti.find((o) => o.id === s.scelta.linguaggio)?.nome ?? s.scelta.linguaggio;
  const scelte = el(
    "div",
    { class: "scelte" },
    gruppo(testi.linguaggio, s.offerti, s.scelta.linguaggio, (id) => manda({ tipo: "scegli", linguaggio: id })),
    gruppo(testi.lingua, s.lingue, s.scelta.lingua, (id) => manda({ tipo: "scegli", lingua: id as "it" | "en" })),
  );
  const contenuto = "assente" in m.codice ? el("p", { id: "assente", class: "assente" }, m.codice.assente) : codice(m.codice.testo, s.scelta.linguaggio, testi.codiceIn.replace("{linguaggio}", nomeDelLinguaggio));
  const destra = el("section", { class: "destra" }, scelte, contenuto);

  const fuoco = document.activeElement instanceof HTMLElement ? (document.activeElement.dataset["scelta"] ?? document.activeElement.id) : "";
  radice.replaceChildren(testata, el("div", { class: "corpo" }, sinistra, destra));
  // Il fuoco resta dove lo studente l'aveva: sul pulsante scelto o sull'elemento con lo stesso id.
  const ritrovato = fuoco !== "" ? (radice.querySelector<HTMLElement>(`[data-scelta="${CSS.escape(fuoco)}"]`) ?? document.getElementById(fuoco)) : null;
  ritrovato?.focus();

  // Il codice si apre sulla riga di `main`, solo quando cambia il codice: un aggiornamento uguale non sposta chi sta leggendo.
  if (!("assente" in m.codice)) {
    const chiave = `${s.scelta.linguaggio} ${s.scelta.lingua}\n${m.codice.testo}`;
    if (chiave !== codiceMostrato) {
      codiceMostrato = chiave;
      portaSuMain(m.codice.rigaDiMain);
    }
  } else codiceMostrato = "";
}

/** Porta il codice sulla riga di `main`. Lo rifà dopo il primo disegno, a caratteri pronti e poco dopo, finché lo studente non
 *  tocca il codice: misurato nell'editor vero, un solo scorrimento subito restava sei righe sopra (l'impaginazione cambiava dopo). */
function portaSuMain(riga: number): void {
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

/** Ciò che lo schermo mostra, letto dal DOM. */
function fotografia(): Fotografia {
  const pre = document.getElementById("codice");
  const righe = pre === null ? [] : [...pre.querySelectorAll<HTMLElement>(".riga")];
  let rigaInCima: number | null = null;
  if (pre !== null) {
    // Dal bordo interno, e una riga è visibile se ne sporgono più di 2 pixel: lo scorrimento si arrotonda al pixel, e con un'altra
    // altezza delle righe (le macchine delle Actions) una frazione della riga sopra restava «visibile» (misurato: 25 invece di 26).
    const cima = pre.getBoundingClientRect().top + pre.clientTop;
    const prima = righe.findIndex((r) => r.getBoundingClientRect().bottom > cima + 2);
    rigaInCima = prima < 0 ? null : prima + 1;
  }
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
    editabili: document.querySelectorAll("input, textarea, select, [contenteditable]:not([contenteditable=false])").length,
    colori,
    fuoco: document.activeElement instanceof HTMLElement ? (document.activeElement.id || document.activeElement.dataset["scelta"] || document.activeElement.tagName.toLowerCase()) : "",
    versione: stato?.versione ?? -1,
  };
}

window.addEventListener("message", (e: MessageEvent<VersoLaPagina>) => {
  const m = e.data;
  if (m.tipo === "stato") {
    stato = m.stato;
    disegna(m.stato);
  } else if (m.tipo === "fotografia") manda({ tipo: "fotografia", id: m.id, fotografia: fotografia() });
  else if (m.tipo === "clic") {
    const bersaglio = document.querySelector<HTMLElement>(m.selettore);
    if (bersaglio === null) manda({ tipo: "fotografia", id: m.id, fotografia: null, errore: `nessun elemento per ${m.selettore}` });
    else {
      bersaglio.click();
      // Il clic manda una scelta all'estensione: la fotografia la chiede chi prova, quando lo stato nuovo è arrivato.
      manda({ tipo: "fotografia", id: m.id, fotografia: fotografia() });
    }
  }
});
manda({ tipo: "pronta" });

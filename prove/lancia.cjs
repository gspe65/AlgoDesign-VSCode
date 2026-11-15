// Avvia l'editor dato con l'estensione estratta dal pacchetto, e dentro `finestra.cjs`. Nessun download: l'eseguibile è dato.
//
//   node prove/lancia.cjs <eseguibile> <estensione> <cartella da aprire> <cartella dei dati> <ambiente in JSON>
//
// L'ambiente della prova (i file, il file di uscita) arriva all'host delle estensioni, con ALGO_PROVA=1 che accende i comandi di
// prova dell'estensione. L'editor è in inglese: con un profilo nuovo e le estensioni spente non c'è un pacchetto della lingua
// (misurato), e la lingua dell'interfaccia la riporta `finestra.cjs`, gli attesi la seguono. Su Linux parte senza la sandbox di
// Chromium: sulle macchine senza namespace utente (Ubuntu 24.04 delle Actions) non si avvia, e qui gira solo con un profilo
// temporaneo.

const { join } = require("node:path");
const { runTests } = require("@vscode/test-electron");

const [eseguibile, estensione, cartella, dati, ambiente] = process.argv.slice(2);

runTests({
  vscodeExecutablePath: eseguibile,
  extensionDevelopmentPath: estensione,
  extensionTestsPath: join(__dirname, "finestra.cjs"),
  extensionTestsEnv: { ...JSON.parse(ambiente), ALGO_PROVA: "1" },
  launchArgs: [cartella, "--user-data-dir", join(dati, "profilo"), "--extensions-dir", join(dati, "estensioni"), "--disable-extensions", ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
}).catch((e) => {
  console.error(String(e));
  process.exit(1);
});

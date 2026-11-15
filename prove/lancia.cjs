// Avvia l'editor dato con l'estensione estratta dal pacchetto, e dentro `finestra.cjs`. Nessun download: l'eseguibile è dato.
//
//   node prove/lancia.cjs <eseguibile> <estensione> <file .algo> <file di uscita> <cartella dei dati> <casi in JSON>
//
// Su Linux l'editor parte senza la sandbox di Chromium: sulle macchine senza namespace utente (Ubuntu 24.04 delle Actions) non si
// avvia, e qui gira solo con un profilo temporaneo.

const { dirname, join } = require("node:path");
const { runTests } = require("@vscode/test-electron");

const [eseguibile, estensione, file, uscita, dati, casi] = process.argv.slice(2);

runTests({
  vscodeExecutablePath: eseguibile,
  extensionDevelopmentPath: estensione,
  extensionTestsPath: join(__dirname, "finestra.cjs"),
  extensionTestsEnv: { ALGO_FILE: file, ALGO_USCITA: uscita, ALGO_CASI: casi },
  launchArgs: [dirname(file), "--user-data-dir", join(dati, "profilo"), "--extensions-dir", join(dati, "estensioni"), "--disable-extensions", ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
}).catch((e) => {
  console.error(String(e));
  process.exit(1);
});

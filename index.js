const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const DATA_FILE = path.join(__dirname, 'commands.json');

// Zorg dat we POST-data kunnen parsen
app.use(express.urlencoded({ extended: true }));

// Laad bestaande commando's, of maak een leeg object als het bestand nog niet bestaat
let commands = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    commands = JSON.parse(data);
  } catch (err) {
    console.error("Fout bij het inlezen van het data bestand:", err);
  }
}

/**
 * Bereken de Modbus CRC16 van een hex-reeks.
 * @param {string} hexInput - bv. "01 06 00 86 06 40"
 * @returns {string} De CRC16 in little-endian, bv. "6A 73"
 */
function calculateCRC16(hexInput) {
  const hexStr = hexInput.replace(/\s+/g, '');
  const bytes = [];
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes.push(parseInt(hexStr.substr(i, 2), 16));
  }
  let crc = 0xFFFF;
  bytes.forEach(byte => {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
    }
  });
  const low = crc & 0xFF;
  const high = (crc >> 8) & 0xFF;
  return low.toString(16).padStart(2, '0').toUpperCase() + " " +
         high.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Formatteer een hex-string zonder spaties naar een nette hex-string met spaties.
 * @param {string} hexStr - bv. "010600860640"
 * @returns {string} bv. "01 06 00 86 06 40"
 */
function formatHexString(hexStr) {
  return hexStr.replace(/(.{2})/g, '$1 ').trim().toUpperCase();
}

/**
 * Analyseer een Modbus-frame door de laatste 4 hextekens (de checksum) te verwijderen.
 * Er wordt vervolgens gekeken naar de resterende data:
 *
 * - Voor een write-response verwacht men 12 hextekens (6 bytes):
 *     Byte0: Slave adres
 *     Byte1: Function code
 *     Byte2-3: Registeradres
 *     Byte4-5: Registerwaarde
 *
 * - Voor een read-response verwacht men 10 hextekens (5 bytes):
 *     Byte0: Slave adres
 *     Byte1: Function code
 *     Byte2: Byte count
 *     Byte3-4: Registerwaarde
 *
 * De registerwaarde wordt omgezet naar een decimale waarde en gedeeld door 100 (schaalfactor 0.01).
 *
 * @param {string} hexFrame - Volledig frame als hex-string met of zonder spaties.
 * @returns {object|null} Object met analysegegevens of null bij onbekende structuur.
 */
function analyzeModbusFrame(hexFrame) {
  const cleaned = hexFrame.replace(/\s+/g, '').toUpperCase();
  if (cleaned.length < 4) return null; // minimaal voor CRC aanwezig
  // Verwijder de laatste 4 hextekens (CRC)
  const dataWithoutCRC = cleaned.slice(0, -4);
  
  // Write response: verwacht 12 hextekens (6 bytes)
  if (dataWithoutCRC.length === 12) {
    const slave = dataWithoutCRC.substr(0, 2);
    const func = dataWithoutCRC.substr(2, 2);
    const regAddrHex = dataWithoutCRC.substr(4, 4); // Registeradres
    const regValueHex = dataWithoutCRC.substr(8, 4);  // Registerwaarde
    const regAddr = parseInt(regAddrHex, 16);
    const regValue = parseInt(regValueHex, 16);
    const regValueScaled = regValue / 100; // schaalfactor
    return {
      type: 'write',
      slave,
      func,
      regAddrHex: regAddrHex.match(/.{1,2}/g).join(' '),
      regAddr,
      regValueHex: regValueHex.match(/.{1,2}/g).join(' '),
      regValue,
      regValueScaled
    };
  }
  // Read response: verwacht 10 hextekens (5 bytes)
  else if (dataWithoutCRC.length === 10) {
    const slave = dataWithoutCRC.substr(0, 2);
    const func = dataWithoutCRC.substr(2, 2);
    const byteCount = dataWithoutCRC.substr(4, 2);
    const regValueHex = dataWithoutCRC.substr(6, 4);
    const regValue = parseInt(regValueHex, 16);
    const regValueScaled = regValue / 100;
    return {
      type: 'read',
      slave,
      func,
      byteCount,
      regValueHex: regValueHex.match(/.{1,2}/g).join(' '),
      regValue,
      regValueScaled
    };
  }
  else {
    return null;
  }
}

/**
 * Converteer een hex-string naar een base64-string.
 * @param {string} hexStr - bv. "01 06 00 86 06 40"
 * @returns {string} Base64-representatie.
 */
function hexToBase64(hexStr) {
  const cleaned = hexStr.replace(/\s+/g, '');
  const buffer = Buffer.from(cleaned, 'hex');
  return buffer.toString('base64');
}

/* Helpers voor HTML-rendering met Bootstrap */
function renderHeader(title) {
  return `
  <!DOCTYPE html>
  <html lang="nl">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <!-- Bootstrap CSS via CDN -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  </head>
  <body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
    <div class="container">
      <a class="navbar-brand" href="/">Commando CRC16</a>
      <div class="collapse navbar-collapse">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item"><a class="nav-link" href="/">Home</a></li>
          <li class="nav-item"><a class="nav-link" href="/decode">Payload decoderen</a></li>
          <li class="nav-item"><a class="nav-link" href="/hex2base64">Hex naar Base64</a></li>
        </ul>
      </div>
    </div>
  </nav>
  <div class="container">
  `;
}

function renderFooter() {
  return `
  </div>
  <!-- Bootstrap JS via CDN -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  </body>
  </html>
  `;
}

/* Routes */

// Homepagina: Toon formulier voor opslaan én lijst met opgeslagen commando's inclusief analyse
app.get('/', (req, res) => {
  let listHtml = '<ul class="list-group">';
  for (const key in commands) {
    // Analyseer het opgeslagen volledige commando
    const analysis = analyzeModbusFrame(commands[key].command);
    let analysisText = "";
    if (analysis) {
      if (analysis.type === 'write') {
        analysisText = `<br/><small>Analyse: Registeradres ${analysis.regAddr} (0x${analysis.regAddrHex}) - Registerwaarde ${analysis.regValueScaled} (${analysis.regValue} raw, 0x${analysis.regValueHex})</small>`;
      } else if (analysis.type === 'read') {
        analysisText = `<br/><small>Analyse: Registerwaarde ${analysis.regValueScaled} (${analysis.regValue} raw, 0x${analysis.regValueHex})</small>`;
      }
    }
    listHtml += `<li class="list-group-item">
      <strong>${commands[key].name}</strong>: ${commands[key].command}
      ${analysisText}
    </li>`;
  }
  listHtml += '</ul>';

  res.send(`
    ${renderHeader('Commando en CRC16 Opslaan')}
    <h2 class="mb-4">Commando met CRC16 opslaan</h2>
    <form method="POST" action="/">
      <div class="mb-3">
        <label for="cmdName" class="form-label">Commando naam:</label>
        <input type="text" id="cmdName" name="cmdName" class="form-control" required>
      </div>
      <div class="mb-3">
        <label for="cmdBytes" class="form-label">Hex bytes (zonder CRC, bv. "01 06 00 86 06 40"):</label>
        <input type="text" id="cmdBytes" name="cmdBytes" class="form-control" required>
      </div>
      <button type="submit" class="btn btn-primary">Opslaan</button>
    </form>
    <hr>
    <h3>Opgeslagen commando's</h3>
    ${listHtml}
    ${renderFooter()}
  `);
});

// Verwerk formulier en sla commando op
app.post('/', (req, res) => {
  const cmdName = req.body.cmdName.trim();
  let cmdBytes = req.body.cmdBytes.trim();
  const cleaned = cmdBytes.replace(/\s+/g, '').toUpperCase();

  if (cleaned.length % 2 !== 0 || /[^0-9A-F]/.test(cleaned)) {
    return res.send(`
      ${renderHeader('Fout')}
      <div class="alert alert-danger" role="alert">
        Fout: Voer een geldige hex-reeks in (even aantal hextekens, alleen 0-9 en A-F).
      </div>
      <a href="/" class="btn btn-secondary">Terug</a>
      ${renderFooter()}
    `);
  }

  // Bereken de CRC en vorm het volledige commando (data + CRC)
  const crc = calculateCRC16(cmdBytes);
  const formattedData = formatHexString(cleaned);
  const completeCommand = formattedData + " " + crc;

  // Gebruik de data (zonder CRC) als key; update de naam indien de data al bestaat.
  if (commands.hasOwnProperty(formattedData)) {
    commands[formattedData].name = cmdName;
  } else {
    commands[formattedData] = {
      name: cmdName,
      command: completeCommand
    };
  }
  fs.writeFile(DATA_FILE, JSON.stringify(commands, null, 2), err => {
    if (err) console.error("Fout bij opslaan:", err);
  });

  res.send(`
    ${renderHeader('Commando Opgeslagen')}
    <div class="card">
      <div class="card-body">
        <h5 class="card-title">Commando opgeslagen</h5>
        <p class="card-text"><strong>Naam:</strong> ${cmdName}</p>
        <p class="card-text"><strong>Bytes (zonder CRC):</strong> ${formattedData}</p>
        <p class="card-text"><strong>CRC16:</strong> ${crc}</p>
        <p class="card-text"><strong>Volledige commando:</strong> ${completeCommand}</p>
        <a href="/" class="btn btn-primary">Terug naar overzicht</a>
      </div>
    </div>
    ${renderFooter()}
  `);
});

// Payload decoderen (bestaande functionaliteit)
app.get('/decode', (req, res) => {
  res.send(`
    ${renderHeader('Payload decoderen')}
    <h2 class="mb-4">Payload decoderen</h2>
    <form method="POST" action="/decode">
      <div class="mb-3">
        <label for="payload" class="form-label">Voer payload in (base64):</label>
        <input type="text" id="payload" name="payload" class="form-control" required>
      </div>
      <button type="submit" class="btn btn-primary">Decodeer Payload</button>
    </form>
    ${renderFooter()}
  `);
});

app.post('/decode', (req, res) => {
  const payload = req.body.payload.trim();
  try {
    const buffer = Buffer.from(payload, 'base64');
    const hex = buffer.toString('hex').toUpperCase().match(/.{1,2}/g).join(' ');
    res.send(`
      ${renderHeader('Payload Gedecodeerd')}
      <div class="card">
        <div class="card-body">
          <h5 class="card-title">Payload gedecodeerd</h5>
          <p class="card-text"><strong>Invoer (base64):</strong> ${payload}</p>
          <p class="card-text"><strong>Gecodeerd naar hex:</strong> ${hex}</p>
          <a href="/decode" class="btn btn-primary">Nieuwe decodering</a>
        </div>
      </div>
      ${renderFooter()}
    `);
  } catch (error) {
    res.send(`
      ${renderHeader('Fout')}
      <div class="alert alert-danger" role="alert">
        Fout bij het decoderen van de payload. Controleer de invoer.
      </div>
      <a href="/decode" class="btn btn-secondary">Probeer opnieuw</a>
      ${renderFooter()}
    `);
  }
});

// Nieuwe route: Converteer een hex-string naar een base64-string
app.get('/hex2base64', (req, res) => {
  res.send(`
    ${renderHeader('Hex naar Base64 Converter')}
    <h2 class="mb-4">Converteer Hex naar Base64</h2>
    <form method="POST" action="/hex2base64">
      <div class="mb-3">
        <label for="hexInput" class="form-label">Voer hex-string in (bv. "01 06 00 86 06 40"):</label>
        <input type="text" id="hexInput" name="hexInput" class="form-control" required>
      </div>
      <button type="submit" class="btn btn-primary">Converteer</button>
    </form>
    ${renderFooter()}
  `);
});

app.post('/hex2base64', (req, res) => {
  const hexInput = req.body.hexInput.trim();
  const cleaned = hexInput.replace(/\s+/g, '');
  if (cleaned.length % 2 !== 0 || /[^0-9A-Fa-f]/.test(cleaned)) {
    return res.send(`
      ${renderHeader('Fout')}
      <div class="alert alert-danger" role="alert">
        Fout: Voer een geldige hex-string in (even aantal hextekens, alleen 0-9 en A-F).
      </div>
      <a href="/hex2base64" class="btn btn-secondary">Probeer opnieuw</a>
      ${renderFooter()}
    `);
  }
  const base64Result = hexToBase64(hexInput);
  res.send(`
    ${renderHeader('Resultaat')}
    <div class="card">
      <div class="card-body">
        <h5 class="card-title">Conversie Resultaat</h5>
        <p class="card-text"><strong>Invoer (hex):</strong> ${formatHexString(cleaned)}</p>
        <p class="card-text"><strong>Resultaat (base64):</strong> ${base64Result}</p>
        <a href="/hex2base64" class="btn btn-primary">Nieuwe conversie</a>
      </div>
    </div>
    ${renderFooter()}
  `);
});

// Start de server op poort 3000
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
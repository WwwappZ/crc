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
 * @param {string} hexInput - De invoer in hex, bv. "01 06 00 86 06 40"
 * @returns {string} De CRC16 in little-endian, bv. "6A 73"
 */
function calculateCRC16(hexInput) {
  // Verwijder spaties en andere witruimtes
  const hexStr = hexInput.replace(/\s+/g, '');
  
  // Zet de hexstring om naar een array met bytes
  const bytes = [];
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes.push(parseInt(hexStr.substr(i, 2), 16));
  }
  
  // Initialiseer CRC met 0xFFFF
  let crc = 0xFFFF;
  
  // Verwerk elk byte
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
  
  // Haal de lage en hoge byte, in little-endian (laag eerst)
  const low = crc & 0xFF;
  const high = (crc >> 8) & 0xFF;
  
  // Geef terug als hexstring met twee cijfers per byte
  return low.toString(16).padStart(2, '0').toUpperCase() + " " +
         high.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Zet de array van bytes (hex string zonder spaties) om in een nette hexstring met spaties.
 * @param {string} hexStr - bv. "010600860640"
 * @returns {string} bv. "01 06 00 86 06 40"
 */
function formatHexString(hexStr) {
  return hexStr.replace(/(.{2})/g, '$1 ').trim().toUpperCase();
}

/**
 * Slaat de huidige commands op in een JSON bestand.
 */
function saveCommands() {
  fs.writeFile(DATA_FILE, JSON.stringify(commands, null, 2), err => {
    if (err) {
      console.error("Fout bij opslaan:", err);
    }
  });
}

// Toon het formulier en de lijst met opgeslagen commando's
app.get('/', (req, res) => {
  let listHtml = '<ul>';
  for (const key in commands) {
    listHtml += `<li><strong>${commands[key].name}</strong>: ${commands[key].command}</li>`;
  }
  listHtml += '</ul>';

  res.send(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>Commando en CRC16 Opslaan</title>
      </head>
      <body>
        <h2>Commando met CRC16 opslaan</h2>
        <form method="POST" action="/">
          <label for="cmdName">Commando naam:</label><br/>
          <input type="text" id="cmdName" name="cmdName" required style="width:300px;"/><br/><br/>
          <label for="cmdBytes">Hex bytes (zonder CRC, bv. "01 06 00 86 06 40"):</label><br/>
          <input type="text" id="cmdBytes" name="cmdBytes" required style="width:300px;"/><br/><br/>
          <button type="submit">Opslaan</button>
        </form>
        <h3>Opgeslagen commando's</h3>
        ${listHtml}
      </body>
    </html>
  `);
});

// Verwerk formulier en sla commando op
app.post('/', (req, res) => {
  const cmdName = req.body.cmdName.trim();
  let cmdBytes = req.body.cmdBytes.trim();

  // Verwijder spaties en maak uppercase
  const cleaned = cmdBytes.replace(/\s+/g, '').toUpperCase();

  // Valideer: Moet een even aantal hextekens hebben en alleen hextekens bevatten
  if (cleaned.length % 2 !== 0 || /[^0-9A-F]/.test(cleaned)) {
    return res.send(`
      <html>
        <head>
          <meta charset="utf-8">
          <title>Fout</title>
        </head>
        <body>
          <p>Fout: Voer een geldige hex-reeks in (even aantal hextekens, alleen 0-9 en A-F).</p>
          <a href="/">Terug</a>
        </body>
      </html>
    `);
  }

  // Bereken de CRC
  const crc = calculateCRC16(cmdBytes);
  // Voeg de CRC toe aan de ingevoerde bytes (in nette notatie)
  const formattedData = formatHexString(cleaned);
  const completeCommand = formattedData + " " + crc;

  // Gebruik de data (zonder de CRC) als key. Zo voorkomen we duplicaten.
  // Als de bytes reeds bestaan, wordt alleen de omschrijving aangepast.
  if (commands.hasOwnProperty(formattedData)) {
    // Update de omschrijving
    commands[formattedData].name = cmdName;
  } else {
    commands[formattedData] = {
      name: cmdName,
      command: completeCommand
    };
  }

  // Sla de commands op in het JSON-bestand
  saveCommands();

  // Toon resultaat
  res.send(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>Commando Opgeslagen</title>
      </head>
      <body>
        <h2>Commando opgeslagen</h2>
        <p><strong>Naam:</strong> ${cmdName}</p>
        <p><strong>Bytes (zonder CRC):</strong> ${formattedData}</p>
        <p><strong>CRC16:</strong> ${crc}</p>
        <p><strong>Volledige command:</strong> ${completeCommand}</p>
        <br/>
        <a href="/">Terug naar overzicht</a>
      </body>
    </html>
  `);
});

// Start de server op poort 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
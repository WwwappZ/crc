const express = require('express');
const router = express.Router();
const crc = require('crc');  // Zorg dat je de 'crc' module hebt geïnstalleerd (npm install crc)
const { renderHeader, renderFooter } = require('../../helpers/render');

/**
 * Formatteer een hex byte tot 2 karakters, uppercase.
 */
function formatHexByte(hexByte) {
  return hexByte.padStart(2, "0").toUpperCase();
}

/**
 * Converteer een aantal seconden naar een 8-cijferige hex-string (4 bytes).
 */
function secondsToHex(seconds) {
  if (!Number.isInteger(seconds) || seconds < 0) {
    throw new Error("Seconds must be a non-negative integer");
  }
  return seconds.toString(16).padStart(8, "0").toUpperCase();
}

/**
 * Bereken de CRC16 (Modbus) over de hex-string (spaties verwijderd).
 * De checksum wordt geretourneerd als een 4-karakter hex-string met de laagste byte eerst.
 */
function calculateCRC(input) {
  const formattedInput = input.replace(/\s+/g, "");
  const buffer = Buffer.from(formattedInput, "hex");
  let crcValue = crc.crc16modbus(buffer).toString(16).padStart(4, "0").toUpperCase();
  // De Modbus CRC wordt in little-endian opgeleverd:
  return crcValue.match(/.{1,2}/g).reverse().join(" ");
}

/**
 * Bouwt het volledige hex-commando op voor het uitschakelen.
 * De basis bestaat uit: "01 10 00 A7 00 02 04"
 * Vervolgens wordt de 4-bytes data (seconden) toegevoegd en daarna de CRC.
 */
function createFullHexCommandWithCRC(seconds) {
  const baseHex = "01 10 00 A7 00 02 04";
  const secondsHex = secondsToHex(seconds);
  const fullHexWithoutCRC = `${baseHex} ${secondsHex}`;
  const crcResult = calculateCRC(fullHexWithoutCRC);
  return `${fullHexWithoutCRC.toUpperCase()} ${crcResult}`;
}

/**
 * Converteer een hex-string (spaties verwijderd) naar een base64-string.
 */
function convertHexToBase64(hexString) {
  const buffer = Buffer.from(hexString.replace(/\s+/g, ""), "hex");
  return buffer.toString("base64");
}

router.get('/', (req, res) => {
  let html = renderHeader("Meter Uitschakelen");
  html += `
    <h2 class="mb-4">Schakel de meter uit voor X aantal minuten</h2>
    <form method="POST" action="/wizard/off">
      <div class="mb-3">
        <label for="minutes" class="form-label">Aantal minuten:</label>
        <input type="number" class="form-control" id="minutes" name="minutes" min="1" required>
      </div>
      <button type="submit" class="btn btn-primary">Bereken & Verstuur</button>
    </form>
    <hr>
    <h4>Lees en analyseer de read-respons</h4>
    <p>Voer hieronder de hex payload in die je ontvangt na een read-commando op register 00A7.</p>
    <a href="/wizard/off/read" class="btn btn-info">Analyseer read respons</a>
    <br><br>
    <a href="/wizard" class="btn btn-secondary">Terug naar Wizard overzicht</a>
  `;
  html += renderFooter();
  res.send(html);
});

router.post('/', (req, res) => {
  const minutes = parseInt(req.body.minutes, 10);
  if (isNaN(minutes) || minutes <= 0) {
    return res.send(renderHeader("Fout") + "<p>Ongeldige invoer voor minuten.</p>" + renderFooter());
  }
  const seconds = minutes * 60;
  const fullHexCommandWithCRC = createFullHexCommandWithCRC(seconds);
  const base64Result = convertHexToBase64(fullHexCommandWithCRC);
  
  let html = renderHeader("Resultaat Meter Uitschakelen");
  html += `<h4>Meter uitschakelen voor ${minutes} minuut(en)</h4>
           <p><strong>Hex commando:</strong> ${fullHexCommandWithCRC}</p>
           <p><strong>Base64 payload:</strong> ${base64Result}</p>
           <a href="/wizard/off" class="btn btn-primary">Nieuwe berekening</a>
           <a href="/wizard" class="btn btn-secondary">Terug naar overzicht</a>`;
  html += renderFooter();
  res.send(html);
});

// Extra: Read-respons analyseren voor Off status
router.get('/read', (req, res) => {
  let html = renderHeader("Analyse Read Response");
  html += `
    <h2 class="mb-4">Analyse Read Response - Meter Off Status</h2>
    <form method="POST" action="/wizard/off/read">
      <div class="mb-3">
        <label for="readPayload" class="form-label">Voer read respons payload in (hex):</label>
        <input type="text" class="form-control" id="readPayload" name="readPayload" required>
      </div>
      <button type="submit" class="btn btn-primary">Analyseer</button>
    </form>
    <a href="/wizard/off" class="btn btn-secondary mt-3">Terug</a>
  `;
  html += renderFooter();
  res.send(html);
});

router.post('/read', (req, res) => {
  // Voorbeeld: Een geldige read respons voor register 00A7 zou er als volgt uitzien:
  // Slave: 01, Functie: 03, Byte count: 04, Data: 00 00 00 01, CRC: 79 F1
  const readPayload = req.body.readPayload.trim();
  // Hier kun je eventueel een analysefunctie inbouwen. Voor dit voorbeeld gaan we uit van de structuur:
  // Als de data 4 bytes is, interpreteren we dit als een 32-bit getal (big-endian).
  const cleaned = readPayload.replace(/\s+/g, '').toUpperCase();
  let html = renderHeader("Analyse Read Response Resultaat");
  if (cleaned.length < 12) { // minimaal 1+1+1+4+2 = 9 bytes, maar hier verwachten we 13 hex bytes (for write) of 12 voor read?
    html += `<p>Payload te kort of ongeldig formaat.</p>`;
  } else {
    // Neem aan dat de data begint na de eerste 4 bytes (slave, functie en byte count) en bestaat uit 4 bytes
    const dataHex = cleaned.substr(6, 8);
    const dataValue = parseInt(dataHex, 16);
    html += `<h4>Analyse van read respons</h4>
             <p><strong>Data (hex):</strong> ${dataHex.match(/.{1,2}/g).join(' ')}</p>
             <p><strong>Data (decimaal):</strong> ${dataValue}</p>`;
    if (dataValue === 0) {
      html += `<p>Resultaat: Meter is ingeschakeld (geen off-timer actief).</p>`;
    } else {
      html += `<p>Resultaat: Meter is uitgeschakeld. Resterende off-tijd: ${dataValue} seconden.</p>`;
    }
  }
  html += `<a href="/wizard/off/read" class="btn btn-primary">Nieuwe Analyse</a>
           <a href="/wizard/off" class="btn btn-secondary">Terug</a>`;
  html += renderFooter();
  res.send(html);
});

module.exports = router;
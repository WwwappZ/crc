const express = require('express');
const router = express.Router();
const { calculateCRC16, formatHexString, hexToBase64 } = require('../helpers/modbus');
const { renderHeader, renderFooter } = require('../helpers/render');

/**
 * Bouwt een write single register commando op.
 * @param {string} registerAddress - Registeradres als 4-digit hex (bijv. "00A7")
 * @param {number} value - De te schrijven waarde (decimaal)
 * @returns {object} Object met eigenschappen:
 *  - hexCommand: De volledige hex-string (in nette notatie)
 *  - base64Payload: De base64-encoded payload (van de hex-string zonder spaties)
 */
function buildWriteCommand(registerAddress, value) {
  // Slave adres en functecode zijn vast: 0x01 en 0x06
  const slave = "01";
  const func = "06";
  // Zet de waarde om naar een 4-digit hex-string (hoogste byte eerst)
  const valueHex = value.toString(16).padStart(4, '0').toUpperCase();
  // Bouw de command string op: slave + func + registerAddress + valueHex
  const dataPart = slave + func + registerAddress + valueHex;
  // Bereken de CRC16 over de dataPart (met spaties verwijderen)
  const crc = calculateCRC16(dataPart);
  // Formatteer de dataPart (met spaties) en voeg de CRC toe
  const formattedData = formatHexString(dataPart);
  const fullCommand = formattedData + " " + crc;
  // Bereken de payload: base64-encoding van de volledige hex-string (zonder spaties)
  const base64Payload = hexToBase64(fullCommand);
  return { hexCommand: fullCommand, base64Payload };
}

router.get('/', (req, res) => {
  let html = renderHeader("Meter Functies Wizard");
  html += `<h2 class="mb-4">Meter Functies Wizard</h2>
    <div class="mb-5">
      <h4>Schakel de meter uit voor X aantal minuten</h4>
      <p>Geef het aantal minuten op. De meter wordt uitgeschakeld (relay open) gedurende die tijd.</p>
      <form method="POST" action="/wizard">
        <input type="hidden" name="action" value="off">
        <div class="mb-3">
          <label for="minutes" class="form-label">Aantal minuten:</label>
          <input type="number" class="form-control" id="minutes" name="minutes" min="1" required>
        </div>
        <button type="submit" class="btn btn-primary">Bereken & Verstuur</button>
      </form>
    </div>
    <div class="mb-5">
      <h4>Zet de meter op X aantal ampère</h4>
      <p>Geef het gewenste ampèrage op. De waarde wordt vermenigvuldigd met 100 (0.01A eenheid) en naar register 134 geschreven.</p>
      <form method="POST" action="/wizard">
        <input type="hidden" name="action" value="current">
        <div class="mb-3">
          <label for="ampere" class="form-label">Ampère:</label>
          <input type="number" class="form-control" id="ampere" name="ampere" min="1" required>
        </div>
        <button type="submit" class="btn btn-primary">Bereken & Verstuur</button>
      </form>
    </div>`;
  html += renderFooter();
  res.send(html);
});

router.post('/', (req, res) => {
  const action = req.body.action;
  let result = {};
  if (action === "off") {
    // Meter uitschakelen: gebruik register 167 (0x00A7)
    // Input: aantal minuten; waarde = minutes * 60 (seconden)
    const minutes = parseInt(req.body.minutes, 10);
    if (isNaN(minutes) || minutes <= 0) {
      return res.send(renderHeader("Fout") + "<p>Ongeldige invoer voor minuten.</p>" + renderFooter());
    }
    const seconds = minutes * 60;
    // Bouw het commando: register 167 = 0x00A7
    result = buildWriteCommand("00A7", seconds);
  } else if (action === "current") {
    // Meter instellen op x ampère: gebruik register 134 (0x0086)
    // Input: ampère; waarde = ampère * 100
    const ampere = parseInt(req.body.ampere, 10);
    if (isNaN(ampere) || ampere <= 0) {
      return res.send(renderHeader("Fout") + "<p>Ongeldige invoer voor ampère.</p>" + renderFooter());
    }
    const value = ampere * 100;
    result = buildWriteCommand("0086", value);
  } else {
    return res.send(renderHeader("Fout") + "<p>Onbekende actie.</p>" + renderFooter());
  }
  
  let html = renderHeader("Wizard Resultaat");
  if (action === "off") {
    html += `<h4>Meter uitschakelen voor ${req.body.minutes} minuut(en)</h4>`;
  } else if (action === "current") {
    html += `<h4>Meting instellen op ${req.body.ampere} ampère</h4>`;
  }
  html += `<p><strong>Hex commando:</strong> ${result.hexCommand}</p>
           <p><strong>Base64 payload:</strong> ${result.base64Payload}</p>
           <a href="/wizard" class="btn btn-primary">Nieuwe berekening</a>`;
  html += renderFooter();
  res.send(html);
});

module.exports = router;
const express = require('express');
const router = express.Router();
const { calculateCRC16, formatHexString, hexToBase64 } = require('../../helpers/modbus');
const { renderHeader, renderFooter } = require('../../helpers/render');

/**
 * Bouwt een write single register commando op.
 * 
 * Gebruik: Dit commando schrijft een 2-bytes waarde naar een specifiek register.
 * 
 * @param {string} registerAddress - Registeradres als 4-digit hex (bijv. "0016")
 * @param {number} value - De te schrijven waarde (decimaal)
 * @returns {object} Object met:
 *  - hexCommand: De volledige hex-string met spaties (in nette notatie)
 *  - base64Payload: De base64-encoded payload van het volledige commando (zonder spaties)
 */
function buildWriteCommand(registerAddress, value) {
  const slave = "01";      // Slave adres
  const func = "06";       // Functiecode write single register
  // Zet de waarde om naar een 4-digit hex-string (bijv. 100 -> "0064")
  const valueHex = value.toString(16).padStart(4, '0').toUpperCase();
  // Bouw het data-deel op: slave + func + registeradres + waarde
  const dataPart = slave + func + registerAddress + valueHex;
  // Bereken de CRC16 (de helper verwacht een hex-string zonder spaties)
  const crc = calculateCRC16(dataPart);
  // Formatteer de data-part (met spaties) en voeg de CRC toe
  const formattedData = formatHexString(dataPart);
  const fullCommand = `${formattedData} ${crc}`;
  // Converteer naar base64 (verwijder spaties voor de conversie)
  const base64Payload = hexToBase64(fullCommand);
  return { hexCommand: fullCommand, base64Payload };
}

router.get('/', (req, res) => {
  let html = renderHeader("Meter Opladen met kWh");
  html += `
    <h2 class="mb-4">Laad de meter op met X kWh voor X aantal dagen</h2>
    <form method="POST" action="/wizard/energy">
      <div class="mb-3">
        <label for="kwh" class="form-label">Aantal kWh:</label>
        <input type="number" step="0.01" class="form-control" id="kwh" name="kwh" min="0.01" required>
      </div>
      <div class="mb-3">
        <label for="days" class="form-label">Aantal dagen:</label>
        <input type="number" class="form-control" id="days" name="days" min="1" required>
      </div>
      <button type="submit" class="btn btn-primary">Bereken & Verstuur</button>
    </form>
    <a href="/wizard" class="btn btn-secondary mt-3">Terug naar Wizard overzicht</a>
  `;
  html += renderFooter();
  res.send(html);
});

router.post('/', (req, res) => {
  const kwh = parseFloat(req.body.kwh);
  const days = parseInt(req.body.days, 10);
  if (isNaN(kwh) || kwh <= 0 || isNaN(days) || days <= 0) {
    return res.send(renderHeader("Fout") + "<p>Ongeldige invoer voor kWh of dagen.</p>" + renderFooter());
  }
  // Bereken de recharge-waarde: kWh in 0.01 eenheden (bijv. 1 kWh -> 1 * 100 = 100)
  const rechargeValue = Math.round(kwh * 100);
  // Bouw het commando op voor energie recharge via register 0016
  const result = buildWriteCommand("0016", rechargeValue);
  
  // Opmerking: Het aantal dagen wordt NIET in het commando opgenomen; dit is puur informatief
  let html = renderHeader("Resultaat Energie Recharge");
  html += `<h4>Meter opladen met ${kwh} kWh voor ${days} dag(en)</h4>
           <p><strong>Hex commando:</strong> ${result.hexCommand}</p>
           <p><strong>Base64 payload:</strong> ${result.base64Payload}</p>
           <p><em>Opmerking:</em> Het aantal dagen wordt als aanvullende info getoond en wordt niet opgenomen in het commando.</p>
           <a href="/wizard/energy" class="btn btn-primary">Nieuwe berekening</a>
           <a href="/wizard" class="btn btn-secondary">Terug naar Wizard overzicht</a>`;
  html += renderFooter();
  res.send(html);
});

module.exports = router;
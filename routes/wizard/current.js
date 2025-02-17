const express = require('express');
const router = express.Router();
const { calculateCRC16, formatHexString, hexToBase64 } = require('../../helpers/modbus');
const { renderHeader, renderFooter } = require('../../helpers/render');

function buildWriteCommand(registerAddress, value) {
  const slave = "01";
  const func = "06";
  const valueHex = value.toString(16).padStart(4, '0').toUpperCase();
  const dataPart = slave + func + registerAddress + valueHex;
  const crc = calculateCRC16(dataPart);
  const formattedData = formatHexString(dataPart);
  const fullCommand = formattedData + " " + crc;
  const base64Payload = hexToBase64(fullCommand);
  return { hexCommand: fullCommand, base64Payload };
}

router.get('/', (req, res) => {
  let html = renderHeader("Meter Instellen op Ampère");
  html += `
    <h2 class="mb-4">Zet de meter op X aantal ampère</h2>
    <form method="POST" action="/wizard/current">
      <div class="mb-3">
        <label for="ampere" class="form-label">Ampère:</label>
        <input type="number" class="form-control" id="ampere" name="ampere" min="1" required>
      </div>
      <button type="submit" class="btn btn-primary">Bereken & Verstuur</button>
    </form>
    <a href="/wizard" class="btn btn-secondary mt-3">Terug</a>
  `;
  html += renderFooter();
  res.send(html);
});

router.post('/', (req, res) => {
  const ampere = parseInt(req.body.ampere, 10);
  if (isNaN(ampere) || ampere <= 0) {
    return res.send(renderHeader("Fout") + "<p>Ongeldige invoer voor ampère.</p>" + renderFooter());
  }
  const value = ampere * 100;
  const result = buildWriteCommand("0086", value);
  let html = renderHeader("Resultaat Ampère Instellen");
  html += `<h4>Meting instellen op ${ampere} ampère</h4>
           <p><strong>Hex commando:</strong> ${result.hexCommand}</p>
           <p><strong>Base64 payload:</strong> ${result.base64Payload}</p>
           <a href="/wizard/current" class="btn btn-primary">Nieuwe berekening</a>
           <a href="/wizard" class="btn btn-secondary">Terug</a>`;
  html += renderFooter();
  res.send(html);
});

module.exports = router;
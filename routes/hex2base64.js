const express = require('express');
const router = express.Router();
const { hexToBase64, formatHexString } = require('../helpers/modbus');
const { renderHeader, renderFooter } = require('../helpers/render');

router.get('/', (req, res) => {
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

router.post('/', (req, res) => {
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

module.exports = router;
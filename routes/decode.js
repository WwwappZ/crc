const express = require('express');
const router = express.Router();
const { renderHeader, renderFooter } = require('../helpers/render');

router.get('/', (req, res) => {
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

router.post('/', (req, res) => {
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

module.exports = router;
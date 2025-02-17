const express = require('express');
const router = express.Router();
const { renderHeader, renderFooter } = require('../../helpers/render');

router.get('/', (req, res) => {
  let html = renderHeader("Meter Functies Wizard");
  html += `
    <h2 class="mb-4">Meter Functies Wizard</h2>
    <ul class="list-group">
      <li class="list-group-item"><a href="/wizard/off">Schakel de meter uit voor X aantal minuten</a></li>
      <li class="list-group-item"><a href="/wizard/current">Zet de meter op X aantal ampère</a></li>
      <li class="list-group-item"><a href="/wizard/energy">Laad de meter op met X kWh voor X aantal dagen</a></li>
    </ul>
  `;
  html += renderFooter();
  res.send(html);
});

module.exports = router;
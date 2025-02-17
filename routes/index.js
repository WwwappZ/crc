const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { calculateCRC16, formatHexString, analyzeModbusFrame } = require('../helpers/modbus');
const { renderHeader, renderFooter } = require('../helpers/render');

const DATA_FILE = path.join(__dirname, '..', 'commands.json');

// GET: Toon homepagina
router.get('/', (req, res) => {
  let listHtml = '<ul class="list-group">';
  for (const key in global.commands) {
    const analysis = analyzeModbusFrame(global.commands[key].command);
    let analysisText = "";
    if (analysis) {
      if (analysis.type === 'write') {
        analysisText = `<br/><small>Analyse: Registeradres ${analysis.regAddr} (0x${analysis.regAddrHex}) - Registerwaarde ${analysis.regValueScaled} (${analysis.regValue} raw, 0x${analysis.regValueHex})</small>`;
      } else if (analysis.type === 'read') {
        analysisText = `<br/><small>Analyse: Registerwaarde ${analysis.regValueScaled} (${analysis.regValue} raw, 0x${analysis.regValueHex})</small>`;
      }
    }
    listHtml += `<li class="list-group-item">
      <strong>${global.commands[key].name}</strong>: ${global.commands[key].command}
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

// POST: Verwerk en sla een commando op
router.post('/', (req, res) => {
  const cmdName = req.body.cmdName.trim();
  const cmdBytes = req.body.cmdBytes.trim();
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

  const crc = calculateCRC16(cmdBytes);
  const formattedData = formatHexString(cleaned);
  const completeCommand = formattedData + " " + crc;

  if (global.commands.hasOwnProperty(formattedData)) {
    global.commands[formattedData].name = cmdName;
  } else {
    global.commands[formattedData] = {
      name: cmdName,
      command: completeCommand
    };
  }
  fs.writeFile(DATA_FILE, JSON.stringify(global.commands, null, 2), err => {
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

module.exports = router;
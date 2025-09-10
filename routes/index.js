const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { calculateCRC16, formatHexString, analyzeModbusFrame, hexToBase64 } = require('../helpers/modbus');
const { renderHeader, renderFooter } = require('../helpers/render');

const DATA_FILE = path.join(__dirname, '..', 'commands.json');

// GET: Redirect naar read commando's
router.get('/', (req, res) => {
  res.redirect('/readcommands');
});

// GET: Toon oude homepagina (legacy)
router.get('/legacy', (req, res) => {
  let listHtml = '<ul class="list-group">';
  for (const key in global.commands) {
    const analysis = analyzeModbusFrame(global.commands[key].command);
    const base64 = hexToBase64(global.commands[key].command);
    let analysisText = "";
    if (analysis) {
      if (analysis.type === 'write') {
        analysisText = `<br/><small>Analyse: Registeradres ${analysis.regAddr} (0x${analysis.regAddrHex}) - Registerwaarde ${analysis.regValueScaled} (${analysis.regValue} raw, 0x${analysis.regValueHex})</small>`;
      } else if (analysis.type === 'read') {
        analysisText = `<br/><small>Analyse: Registerwaarde ${analysis.regValueScaled} (${analysis.regValue} raw, 0x${analysis.regValueHex})</small>`;
      }
    }
    // Use base64 encoding for the key to avoid URL issues with spaces
    const encodedKey = Buffer.from(key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    listHtml += `<li class="list-group-item d-flex justify-content-between align-items-start">
      <div class="ms-2 me-auto">
        <div class="fw-bold">${global.commands[key].name}</div>
        <div><strong>Hex:</strong> ${global.commands[key].command}</div>
        <div><strong>Base64:</strong> ${base64}</div>
        ${analysisText}
      </div>
      <div class="btn-group" role="group">
        <a href="/edit/${encodedKey}" class="btn btn-outline-primary btn-sm">Bewerken</a>
        <form method="POST" action="/delete/${encodedKey}" class="d-inline" onsubmit="return confirm('Weet je zeker dat je dit commando wilt verwijderen?')">
          <button type="submit" class="btn btn-outline-danger btn-sm">Verwijderen</button>
        </form>
      </div>
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

// GET: Toon bewerk formulier
router.get('/edit/:key', (req, res) => {
  // Decode base64 URL-safe key back to original hex string
  const encodedKey = req.params.key.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const paddedKey = encodedKey + '='.repeat((4 - encodedKey.length % 4) % 4);
  const key = Buffer.from(paddedKey, 'base64').toString();
  const command = global.commands[key];
  
  if (!command) {
    return res.send(`
      ${renderHeader('Fout')}
      <div class="alert alert-danger" role="alert">
        Commando niet gevonden.
      </div>
      <a href="/" class="btn btn-secondary">Terug naar overzicht</a>
      ${renderFooter()}
    `);
  }

  res.send(`
    ${renderHeader('Commando Bewerken')}
    <h2 class="mb-4">Commando bewerken</h2>
    <form method="POST" action="/edit/${req.params.key}">
      <div class="mb-3">
        <label for="cmdName" class="form-label">Commando naam:</label>
        <input type="text" id="cmdName" name="cmdName" class="form-control" value="${command.name}" required>
      </div>
      <div class="mb-3">
        <label for="cmdBytes" class="form-label">Hex bytes (zonder CRC):</label>
        <input type="text" id="cmdBytes" name="cmdBytes" class="form-control" value="${key}" required>
      </div>
      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-primary">Opslaan</button>
        <a href="/" class="btn btn-secondary">Annuleren</a>
      </div>
    </form>
    ${renderFooter()}
  `);
});

// POST: Verwerk bewerkt commando
router.post('/edit/:key', (req, res) => {
  // Decode base64 URL-safe key back to original hex string
  const encodedKey = req.params.key.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const paddedKey = encodedKey + '='.repeat((4 - encodedKey.length % 4) % 4);
  const oldKey = Buffer.from(paddedKey, 'base64').toString();
  const cmdName = req.body.cmdName.trim();
  const cmdBytes = req.body.cmdBytes.trim();
  const cleaned = cmdBytes.replace(/\s+/g, '').toUpperCase();

  if (cleaned.length % 2 !== 0 || /[^0-9A-F]/.test(cleaned)) {
    return res.send(`
      ${renderHeader('Fout')}
      <div class="alert alert-danger" role="alert">
        Fout: Voer een geldige hex-reeks in (even aantal hextekens, alleen 0-9 en A-F).
      </div>
      <a href="/edit/${req.params.key}" class="btn btn-secondary">Terug</a>
      ${renderFooter()}
    `);
  }

  const crc = calculateCRC16(cmdBytes);
  const formattedData = formatHexString(cleaned);
  const completeCommand = formattedData + " " + crc;

  // Verwijder het oude commando als de key is veranderd
  if (oldKey !== formattedData) {
    delete global.commands[oldKey];
  }

  global.commands[formattedData] = {
    name: cmdName,
    command: completeCommand
  };

  fs.writeFile(DATA_FILE, JSON.stringify(global.commands, null, 2), err => {
    if (err) console.error("Fout bij opslaan:", err);
  });

  res.send(`
    ${renderHeader('Commando Bijgewerkt')}
    <div class="card">
      <div class="card-body">
        <h5 class="card-title">Commando bijgewerkt</h5>
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

// POST: Verwijder commando
router.post('/delete/:key', (req, res) => {
  // Decode base64 URL-safe key back to original hex string
  const encodedKey = req.params.key.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const paddedKey = encodedKey + '='.repeat((4 - encodedKey.length % 4) % 4);
  const key = Buffer.from(paddedKey, 'base64').toString();
  
  if (global.commands[key]) {
    delete global.commands[key];
    fs.writeFile(DATA_FILE, JSON.stringify(global.commands, null, 2), err => {
      if (err) console.error("Fout bij opslaan:", err);
    });
  }

  res.redirect('/');
});

module.exports = router;
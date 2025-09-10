const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { calculateCRC16, formatHexString, analyzeModbusFrame, hexToBase64 } = require('../helpers/modbus');
const { renderHeader, renderFooter } = require('../helpers/render');

const READ_COMMANDS_FILE = path.join(__dirname, '..', 'data', 'read-commands.json');

// Laad read commando's
let readCommands = {};
if (fs.existsSync(READ_COMMANDS_FILE)) {
  try {
    const data = fs.readFileSync(READ_COMMANDS_FILE, 'utf8');
    readCommands = JSON.parse(data);
  } catch (err) {
    console.error("Fout bij het inlezen van read commands:", err);
  }
}

// GET: Toon read commando's overzicht
router.get('/', (req, res) => {
  let tableHtml = '<div class="table-responsive"><table class="table table-striped">';
  tableHtml += `
    <thead>
      <tr>
        <th>Register</th>
        <th>Naam</th>
        <th>Commando (Hex)</th>
        <th>Commando (Base64)</th>
        <th>Eenheid</th>
        <th>Actie</th>
      </tr>
    </thead>
    <tbody>
  `;

  for (const key in readCommands) {
    const cmd = readCommands[key];
    const commandWithCrc = cmd.command + " " + calculateCRC16(cmd.command);
    const base64Command = hexToBase64(commandWithCrc);
    
    tableHtml += `
      <tr>
        <td><code>${cmd.register}</code></td>
        <td>
          <strong>${cmd.name}</strong><br/>
          <small class="text-muted">${cmd.description}</small>
        </td>
        <td><code class="copyable" onclick="copyToClipboard('${commandWithCrc.replace(/'/g, "\\'")}', this)" style="cursor: pointer;" title="Klik om te kopiëren">${commandWithCrc}</code></td>
        <td><code class="copyable text-primary" onclick="copyToClipboard('${base64Command}', this)" style="cursor: pointer;" title="Klik om te kopiëren">${base64Command}</code></td>
        <td><small>${cmd.unit}</small></td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="showResponseForm('${key}')">
            Antwoord verwerken
          </button>
        </td>
      </tr>
    `;
  }

  tableHtml += '</tbody></table></div>';

  res.send(`
    ${renderHeader('Read Commando\'s Overzicht')}
    
    <style>
    .copyable:hover {
      background-color: #f8f9fa;
      border-radius: 3px;
      padding: 2px 4px;
    }
    .copyable {
      transition: all 0.2s ease;
    }
    </style>
    
    <h2 class="mb-4">Read Commando's Overzicht</h2>
    
    <div class="alert alert-info">
      <strong>Gebruiksaanwijzing:</strong>
      <ul class="mb-0">
        <li><strong>Klik op een Hex of Base64 commando</strong> om het automatisch te kopiëren</li>
        <li>Stuur het Base64 commando naar je LoRaWAN energiemeter</li>
        <li>Ontvang het Base64 antwoord van de meter</li>
        <li>Klik op "Antwoord verwerken" om het antwoord te decoderen en analyseren</li>
      </ul>
    </div>

    ${tableHtml}

    <!-- Response Modal -->
    <div class="modal fade" id="responseModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Antwoord Verwerken</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="responseForm">
              <input type="hidden" id="commandKey" name="commandKey">
              <div class="mb-3">
                <label class="form-label">Commando:</label>
                <div id="commandInfo" class="bg-light p-2 rounded"></div>
              </div>
              <div class="mb-3">
                <label for="response" class="form-label">Base64 Antwoord van meter:</label>
                <textarea id="response" name="response" class="form-control" rows="3" placeholder="Plak hier het Base64 antwoord..." required></textarea>
              </div>
              <div id="analysisResult" class="mt-3"></div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Sluiten</button>
            <button type="button" class="btn btn-primary" onclick="analyzeResponse()">Analyseer Antwoord</button>
          </div>
        </div>
      </div>
    </div>

    <script>
    const readCommands = ${JSON.stringify(readCommands)};
    
    // Copy to clipboard functie
    function copyToClipboard(text, element) {
      navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const originalText = element.textContent;
        const originalColor = element.style.color;
        element.style.color = 'green';
        element.textContent = '✓ Gekopieerd!';
        
        setTimeout(() => {
          element.style.color = originalColor;
          element.textContent = originalText;
        }, 2000);
      }).catch(err => {
        // Fallback voor oudere browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // Visual feedback
        const originalText = element.textContent;
        const originalColor = element.style.color;
        element.style.color = 'green';
        element.textContent = '✓ Gekopieerd!';
        
        setTimeout(() => {
          element.style.color = originalColor;
          element.textContent = originalText;
        }, 2000);
      });
    }
    
    function showResponseForm(commandKey) {
      const cmd = readCommands[commandKey];
      const commandWithCrc = cmd.command + " " + calculateCRC16(cmd.command);
      const base64Command = btoa(commandWithCrc.replace(/\\s/g, '').match(/.{2}/g).map(hex => String.fromCharCode(parseInt(hex, 16))).join(''));
      
      document.getElementById('commandKey').value = commandKey;
      document.getElementById('commandInfo').innerHTML = 
        '<strong>' + cmd.name + '</strong><br/>' +
        '<small>Register: ' + cmd.register + ' | Hex: <code>' + commandWithCrc + '</code> | Base64: <code>' + base64Command + '</code></small>';
      document.getElementById('response').value = '';
      document.getElementById('analysisResult').innerHTML = '';
      
      const modal = new bootstrap.Modal(document.getElementById('responseModal'));
      modal.show();
    }
    
    function calculateCRC16(hexInput) {
      const hexStr = hexInput.replace(/\\s+/g, '');
      const bytes = [];
      for (let i = 0; i < hexStr.length; i += 2) {
        bytes.push(parseInt(hexStr.substr(i, 2), 16));
      }
      let crc = 0xFFFF;
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
      const low = crc & 0xFF;
      const high = (crc >> 8) & 0xFF;
      return low.toString(16).padStart(2, '0').toUpperCase() + " " +
             high.toString(16).padStart(2, '0').toUpperCase();
    }
    
    async function analyzeResponse() {
      const commandKey = document.getElementById('commandKey').value;
      const response = document.getElementById('response').value.trim();
      
      if (!response) {
        alert('Voer een Base64 antwoord in');
        return;
      }
      
      try {
        const result = await fetch('/readcommands/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            commandKey: commandKey,
            response: response
          })
        });
        
        const data = await result.json();
        
        if (data.error) {
          document.getElementById('analysisResult').innerHTML = 
            '<div class="alert alert-danger">' + data.error + '</div>';
        } else {
          document.getElementById('analysisResult').innerHTML = data.html;
        }
      } catch (error) {
        document.getElementById('analysisResult').innerHTML = 
          '<div class="alert alert-danger">Fout bij analyseren: ' + error.message + '</div>';
      }
    }
    </script>

    ${renderFooter()}
  `);
});

// POST: Analyseer Base64 antwoord
router.post('/analyze', (req, res) => {
  const { commandKey, response } = req.body;
  
  try {
    // Decodeer Base64 naar hex
    const buffer = Buffer.from(response, 'base64');
    const hex = buffer.toString('hex').toUpperCase().match(/.{1,2}/g).join(' ');
    
    // Analyseer het antwoord
    const analysis = analyzeModbusFrame(hex);
    const cmd = readCommands[commandKey];
    
    let analysisHtml = `
      <div class="card">
        <div class="card-header">
          <h6 class="mb-0">Analyse Resultaat</h6>
        </div>
        <div class="card-body">
          <p><strong>Ontvangen (Base64):</strong> <code>${response}</code></p>
          <p><strong>Gedecodeerd (Hex):</strong> <code>${hex}</code></p>
    `;
    
    if (analysis) {
      analysisHtml += `
        <div class="row">
          <div class="col-md-6">
            <h6>Frame Details:</h6>
            <ul class="list-unstyled">
              <li><strong>Type:</strong> ${analysis.type}</li>
              <li><strong>Slave:</strong> 0x${analysis.slave}</li>
              <li><strong>Function:</strong> 0x${analysis.func}</li>
      `;
      
      if (analysis.type === 'read') {
        analysisHtml += `
              <li><strong>Byte Count:</strong> 0x${analysis.byteCount}</li>
              <li><strong>Raw Value:</strong> ${analysis.regValue}</li>
              <li><strong>Scaled Value:</strong> ${analysis.regValueScaled}</li>
        `;
      }
      
      analysisHtml += `
            </ul>
          </div>
          <div class="col-md-6">
            <h6>Geïnterpreteerde Waarde:</h6>
      `;
      
      // Interpreteer de waarde op basis van het register
      if (cmd) {
        let interpretedValue = analysis.regValueScaled;
        let unit = cmd.unit;
        
        // Specifieke interpretaties en schaling per register type
        if (commandKey === '128') {
          // Relay status
          const bit0 = analysis.regValue & 0x01;
          const bit1 = (analysis.regValue & 0x02) >> 1;
          interpretedValue = `${bit0 ? 'Gesloten' : 'Open'} ${bit1 ? '(Storing)' : '(Normaal)'}`;
          unit = '';
        } else if (commandKey === '129') {
          // Working mode
          const modes = ['Postpaid', 'Energy prepaid', 'Amount prepaid'];
          interpretedValue = modes[analysis.regValue] || 'Onbekend';
          unit = '';
        } else if (commandKey === '136') {
          // Working status
          const highByte = (analysis.regValue >> 8) & 0xFF;
          const lowByte = analysis.regValue & 0xFF;
          const statuses = ['Config failure', 'Config stage', 'Network stage', 'Comm stage'];
          interpretedValue = `Laatste stap: ${highByte}, Status: ${statuses[lowByte] || 'Onbekend'}`;
          unit = '';
        } else {
          // Correcte schaling voor energie en andere waarden
          if (['104', '106', '116'].includes(commandKey)) {
            // Energie registers: raw value × 0.01 kWh
            interpretedValue = (analysis.regValue * 0.01).toFixed(2);
            unit = 'kWh';
          } else if (['108', '112', '118'].includes(commandKey)) {
            // Bedrag registers (4-byte): raw value × 0.0001 Rand
            interpretedValue = (analysis.regValue * 0.0001).toFixed(4);
            unit = 'Rand';
          } else if (['122', '123'].includes(commandKey)) {
            // Vermogen registers: raw value in W/Var
            interpretedValue = analysis.regValue;
            unit = commandKey === '122' ? 'W' : 'Var';
          } else if (commandKey === '124') {
            // Voltage: raw value × 0.01V
            interpretedValue = (analysis.regValue * 0.01).toFixed(2);
            unit = 'V';
          } else if (commandKey === '125') {
            // Stroom: raw value × 0.01A
            interpretedValue = (analysis.regValue * 0.01).toFixed(2);
            unit = 'A';
          } else if (commandKey === '126') {
            // Power factor: raw value × 0.001
            interpretedValue = (analysis.regValue * 0.001).toFixed(3);
            unit = '';
          } else if (commandKey === '127') {
            // Frequentie: raw value × 0.01Hz
            interpretedValue = (analysis.regValue * 0.01).toFixed(2);
            unit = 'Hz';
          } else if (['134', '135'].includes(commandKey)) {
            // Overstroom drempel en tijd
            if (commandKey === '134') {
              interpretedValue = (analysis.regValue * 0.01).toFixed(2);
              unit = 'A';
            } else {
              interpretedValue = analysis.regValue;
              unit = 'minuten';
            }
          } else if (commandKey === '137') {
            // Signaalsterkte
            interpretedValue = analysis.regValue;
            unit = '%';
          } else if (commandKey === '162') {
            // Data rapportage interval
            interpretedValue = analysis.regValue;
            unit = 'minuten';
          } else {
            // Default: gebruik de geschaalde waarde van de analyse
            interpretedValue = analysis.regValueScaled;
          }
        }
        
        analysisHtml += `
            <div class="alert alert-success">
              <strong>${cmd.name}:</strong><br/>
              ${interpretedValue} ${unit}
            </div>
        `;
      }
      
      analysisHtml += `
          </div>
        </div>
      `;
    } else {
      analysisHtml += `
        <div class="alert alert-warning">
          <strong>Waarschuwing:</strong> Kon het antwoord niet automatisch analyseren. 
          Controleer of het een geldig Modbus antwoord is.
        </div>
      `;
    }
    
    analysisHtml += `
        </div>
      </div>
    `;
    
    res.json({ html: analysisHtml });
    
  } catch (error) {
    res.json({ error: "Fout bij decoderen van Base64: " + error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { calculateCRC16, formatHexString, hexToBase64 } = require('../helpers/modbus');
const { renderHeader, renderFooter } = require('../helpers/render');

const WRITE_COMMANDS_FILE = path.join(__dirname, '..', 'data', 'write-commands.json');

// Laad write commando's
let writeCommands = {};
if (fs.existsSync(WRITE_COMMANDS_FILE)) {
  try {
    const data = fs.readFileSync(WRITE_COMMANDS_FILE, 'utf8');
    writeCommands = JSON.parse(data);
  } catch (err) {
    console.error("Fout bij het inlezen van write commands:", err);
  }
}

// GET: Toon write commando's overzicht
router.get('/', (req, res) => {
  let cardsHtml = '<div class="row">';

  for (const key in writeCommands) {
    const cmd = writeCommands[key];
    
    cardsHtml += `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card h-100">
          <div class="card-header">
            <h6 class="mb-0">${cmd.name}</h6>
            <small class="text-muted">Register ${cmd.register}</small>
          </div>
          <div class="card-body">
            <p class="card-text"><small>${cmd.description}</small></p>
            <p class="text-muted mb-2">${cmd.help}</p>
          </div>
          <div class="card-footer">
            <button class="btn btn-primary btn-sm w-100" onclick="showWriteForm('${key}')">
              Configureren
            </button>
          </div>
        </div>
      </div>
    `;
  }

  cardsHtml += '</div>';

  res.send(`
    ${renderHeader('Write Commando\'s')}
    
    <style>
    .copyable:hover {
      background-color: #f8f9fa;
      border-radius: 3px;
      padding: 2px 4px;
    }
    .copyable {
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .form-control:invalid {
      border-color: #dc3545;
    }
    .form-control:valid {
      border-color: #28a745;
    }
    </style>
    
    <h2 class="mb-4">Write Commando's</h2>
    
    <div class="alert alert-warning">
      <strong>⚠️ Waarschuwing:</strong> Write commando's wijzigen de configuratie van je energiemeter.
      Zorg ervoor dat je begrijpt wat elk commando doet voordat je het verstuurt.
      <br><strong>Sommige instellingen vereisen het indrukken van de knop op de meter.</strong>
    </div>

    ${cardsHtml}

    <!-- Write Modal -->
    <div class="modal fade" id="writeModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Commando Configureren</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="writeForm">
              <input type="hidden" id="commandKey" name="commandKey">
              
              <div class="mb-3">
                <label class="form-label">Commando:</label>
                <div id="commandInfo" class="bg-light p-3 rounded">
                  <!-- Command info will be filled by JavaScript -->
                </div>
              </div>

              <div id="inputFields">
                <!-- Dynamic input fields will be added here -->
              </div>

              <div id="generatedCommand" class="mt-4" style="display: none;">
                <h6>Gegenereerd Commando:</h6>
                <div class="row">
                  <div class="col-md-6 mb-2">
                    <label class="form-label">Hex:</label>
                    <code id="hexCommand" class="copyable d-block p-2 bg-light rounded" onclick="copyToClipboard(this.textContent, this)" title="Klik om te kopiëren"></code>
                  </div>
                  <div class="col-md-6 mb-2">
                    <label class="form-label">Base64:</label>
                    <code id="base64Command" class="copyable d-block p-2 bg-primary text-white rounded" onclick="copyToClipboard(this.textContent, this)" title="Klik om te kopiëren"></code>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Sluiten</button>
            <button type="button" class="btn btn-primary" onclick="generateCommand()">Genereer Commando</button>
          </div>
        </div>
      </div>
    </div>

    <script>
    const writeCommands = ${JSON.stringify(writeCommands)};
    
    // Helper functions
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

    function hexToBase64(hexStr) {
      const cleaned = hexStr.replace(/\\s/g, '');
      const bytes = [];
      for (let i = 0; i < cleaned.length; i += 2) {
        bytes.push(parseInt(cleaned.substr(i, 2), 16));
      }
      return btoa(String.fromCharCode.apply(null, bytes));
    }
    
    // Copy to clipboard functie
    function copyToClipboard(text, element) {
      navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const originalText = element.textContent;
        const originalBg = element.style.backgroundColor;
        element.style.backgroundColor = '#28a745';
        element.textContent = '✓ Gekopieerd!';
        
        setTimeout(() => {
          element.style.backgroundColor = originalBg;
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
        const originalBg = element.style.backgroundColor;
        element.style.backgroundColor = '#28a745';
        element.textContent = '✓ Gekopieerd!';
        
        setTimeout(() => {
          element.style.backgroundColor = originalBg;
          element.textContent = originalText;
        }, 2000);
      });
    }

    function showWriteForm(commandKey) {
      const cmd = writeCommands[commandKey];
      document.getElementById('commandKey').value = commandKey;
      
      // Update command info
      document.getElementById('commandInfo').innerHTML = 
        '<strong>' + cmd.name + '</strong><br/>' +
        '<small class="text-muted">' + cmd.description + '</small><br/>' +
        '<small>Register: ' + cmd.register + ' | Function: 0x' + cmd.functionCode + ' | Unit: ' + cmd.unit + '</small><br/>' +
        '<div class="mt-2"><strong>Help:</strong> ' + cmd.help + '</div>';

      // Generate input fields
      const inputFields = document.getElementById('inputFields');
      inputFields.innerHTML = '';

      if (cmd.dataType === 'uint16') {
        inputFields.innerHTML = 
          '<div class="mb-3">' +
          '<label for="value" class="form-label">Waarde (' + cmd.unit + '):</label>' +
          '<input type="number" class="form-control" id="value" name="value" ' +
          'min="' + (cmd.min || 0) + '" max="' + (cmd.max || 65535) + '" ' +
          'step="' + (cmd.step || 1) + '" value="' + (cmd.defaultValue || 0) + '" required>' +
          '</div>';
      } else if (cmd.dataType === 'int16') {
        inputFields.innerHTML = 
          '<div class="mb-3">' +
          '<label for="value" class="form-label">Waarde (' + cmd.unit + '):</label>' +
          '<input type="number" class="form-control" id="value" name="value" ' +
          'min="' + (cmd.min || -32768) + '" max="' + (cmd.max || 32767) + '" ' +
          'step="' + (cmd.step || 1) + '" value="' + (cmd.defaultValue || 0) + '" required>' +
          '</div>';
      } else if (cmd.dataType === 'uint32') {
        inputFields.innerHTML = 
          '<div class="mb-3">' +
          '<label for="value" class="form-label">Waarde (' + cmd.unit + '):</label>' +
          '<input type="number" class="form-control" id="value" name="value" ' +
          'min="' + (cmd.min || 0) + '" max="' + (cmd.max || 4294967295) + '" ' +
          'step="' + (cmd.step || 1) + '" value="' + (cmd.defaultValue || 0) + '" required>' +
          '</div>';
      } else if (cmd.dataType === 'select') {
        let optionsHtml = '';
        cmd.options.forEach(option => {
          optionsHtml += '<option value="' + option.value + '"' + 
            (option.value === cmd.defaultValue ? ' selected' : '') + '>' + 
            option.label + '</option>';
        });
        inputFields.innerHTML = 
          '<div class="mb-3">' +
          '<label for="value" class="form-label">Selecteer optie:</label>' +
          '<select class="form-control" id="value" name="value" required>' +
          optionsHtml +
          '</select>' +
          '</div>';
      } else if (cmd.dataType === 'datetime') {
        const now = new Date();
        const dateTimeStr = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
        inputFields.innerHTML = 
          '<div class="mb-3">' +
          '<label for="value" class="form-label">Datum en Tijd:</label>' +
          '<input type="datetime-local" class="form-control" id="value" name="value" ' +
          'value="' + dateTimeStr + '" required>' +
          '</div>';
      } else if (cmd.dataType === 'special') {
        inputFields.innerHTML = 
          '<div class="alert alert-warning">' +
          '<strong>Speciale functie:</strong> Dit commando gebruikt een vaste waarde (' + cmd.specialValue + ').' +
          '<br/>Klik op "Genereer Commando" om het commando te maken.' +
          '</div>';
      }

      // Reset generated command
      document.getElementById('generatedCommand').style.display = 'none';
      
      const modal = new bootstrap.Modal(document.getElementById('writeModal'));
      modal.show();
    }

    function generateCommand() {
      const commandKey = document.getElementById('commandKey').value;
      const cmd = writeCommands[commandKey];
      
      try {
        let hexCommand = '';
        let slaveAddr = '01'; // Default slave address
        let functionCode = cmd.functionCode.padStart(2, '0');
        let registerHex = parseInt(cmd.register).toString(16).padStart(4, '0').toUpperCase();
        
        if (cmd.dataType === 'special') {
          // Special commands like restart
          let valueHex = cmd.specialValue.replace('0x', '').toUpperCase().padStart(4, '0');
          hexCommand = slaveAddr + functionCode + registerHex + valueHex;
        } else if (cmd.functionCode === '06') {
          // Single register write (Function 06)
          let value = parseFloat(document.getElementById('value').value);
          let valueHex;
          
          if (cmd.dataType === 'datetime') {
            // For datetime, we need special handling - this is complex, using current approach
            alert('Datetime schrijven is complex en vereist meerdere registers. Gebruik de AES128 encrypted operaties voor tijdsinstelling.');
            return;
          } else if (cmd.dataType === 'int16') {
            // Handle negative values for signed integers
            if (value < 0) {
              valueHex = (65536 + Math.round(value * (1 / (cmd.step || 1)))).toString(16).toUpperCase().padStart(4, '0');
            } else {
              valueHex = Math.round(value * (1 / (cmd.step || 1))).toString(16).toUpperCase().padStart(4, '0');
            }
          } else {
            // Scale the value based on step (for decimal inputs)
            let scaledValue = Math.round(value * (1 / (cmd.step || 1)));
            valueHex = scaledValue.toString(16).toUpperCase().padStart(4, '0');
          }
          
          hexCommand = slaveAddr + functionCode + registerHex + valueHex;
        } else if (cmd.functionCode === '10') {
          // Multiple register write (Function 10) for 32-bit values
          let value = parseFloat(document.getElementById('value').value);
          let scaledValue = Math.round(value * (1 / (cmd.step || 1)));
          let valueHex = scaledValue.toString(16).toUpperCase().padStart(8, '0');
          
          let regCount = '0002'; // 2 registers for 32-bit
          let byteCount = '04'; // 4 bytes
          
          hexCommand = slaveAddr + functionCode + registerHex + regCount + byteCount + valueHex;
        }
        
        // Add CRC
        const hexWithSpaces = hexCommand.replace(/(.{2})/g, '$1 ').trim().toUpperCase();
        const crc = calculateCRC16(hexWithSpaces);
        const completeHex = hexWithSpaces + ' ' + crc;
        
        // Generate Base64
        const base64 = hexToBase64(completeHex);
        
        // Display results
        document.getElementById('hexCommand').textContent = completeHex;
        document.getElementById('base64Command').textContent = base64;
        document.getElementById('generatedCommand').style.display = 'block';
        
      } catch (error) {
        alert('Fout bij genereren commando: ' + error.message);
      }
    }
    </script>

    ${renderFooter()}
  `);
});

module.exports = router;
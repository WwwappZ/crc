const express = require('express');
const app = express();

// Zorg dat we POST-data kunnen parsen
app.use(express.urlencoded({ extended: true }));

/**
 * Bereken de Modbus CRC16 van een hex-reeks.
 * @param {string} hexInput - De invoer in hex, bv. "01 06 00 86 06 40"
 * @returns {string} De CRC16 in little-endian, bv. "6A 73"
 */
function calculateCRC16(hexInput) {
  // Verwijder spaties en andere witruimtes
  const hexStr = hexInput.replace(/\s+/g, '');
  
  // Zet de hexstring om naar een array met bytes
  const bytes = [];
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes.push(parseInt(hexStr.substr(i, 2), 16));
  }
  
  // Initialiseer CRC met 0xFFFF
  let crc = 0xFFFF;
  
  // Verwerk elk byte
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
  
  // Haal de lage en hoge byte, in little-endian (laag eerst)
  const low = crc & 0xFF;
  const high = (crc >> 8) & 0xFF;
  
  // Geef terug als hexstring met twee cijfers per byte
  return low.toString(16).padStart(2, '0').toUpperCase() + " " +
         high.toString(16).padStart(2, '0').toUpperCase();
}

// Toon het formulier
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>CRC16 Calculator</title>
      </head>
      <body>
        <h2>CRC16 Calculator (Modbus)</h2>
        <form method="POST" action="/">
          <label for="inputHex">Voer hex data in (bijv. "01 06 00 86 06 40"):</label><br/>
          <input type="text" id="inputHex" name="inputHex" style="width:300px;" required /><br/><br/>
          <button type="submit">Bereken CRC16</button>
        </form>
      </body>
    </html>
  `);
});

// Verwerk het formulier en toon de uitkomst
app.post('/', (req, res) => {
  const inputHex = req.body.inputHex || '';
  let result = '';

  try {
    result = calculateCRC16(inputHex);
  } catch (error) {
    result = 'Fout bij berekening, controleer de invoer.';
  }

  res.send(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>CRC16 Resultaat</title>
      </head>
      <body>
        <h2>CRC16 Calculator (Modbus)</h2>
        <p><strong>Input data:</strong> ${inputHex}</p>
        <p><strong>CRC16 (Modbus):</strong> ${result}</p>
        <br/>
        <a href="/">Nieuwe berekening</a>
      </body>
    </html>
  `);
});

// Start de server op poort 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});

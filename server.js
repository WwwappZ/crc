const express = require('express');
const path = require('path');
const app = express();

// Stel de data file in
const DATA_FILE = path.join(__dirname, 'commands.json');

// Zorg dat we POST-data kunnen parsen
app.use(express.urlencoded({ extended: true }));

// Globale opslag voor commands (wordt in de routes ingelezen)
global.DATA_FILE = DATA_FILE;
global.commands = {};

// Laad bestaande commando's (indien aanwezig)
const fs = require('fs');
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    global.commands = JSON.parse(data);
  } catch (err) {
    console.error("Fout bij het inlezen van het data bestand:", err);
  }
}

// Stel de routes in
app.use('/', require('./routes/index'));
app.use('/decode', require('./routes/decode'));
app.use('/hex2base64', require('./routes/hex2base64'));
app.use('/wizard', require('./routes/wizard/index'));
app.use('/wizard/off', require('./routes/wizard/off'));
app.use('/wizard/current', require('./routes/wizard/current'));
app.use('/wizard/energy', require('./routes/wizard/energy'));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
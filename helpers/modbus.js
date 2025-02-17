/**
 * Bereken de Modbus CRC16 van een hex-reeks.
 */
function calculateCRC16(hexInput) {
    const hexStr = hexInput.replace(/\s+/g, '');
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
  
  /**
   * Formatteer een hex-string zonder spaties naar een nette hex-string met spaties.
   */
  function formatHexString(hexStr) {
    return hexStr.replace(/(.{2})/g, '$1 ').trim().toUpperCase();
  }
  
  /**
   * Analyseer een Modbus-frame (leesfunctie of schrijffunctie) door de laatste 4 hextekens (CRC) te verwijderen.
   * Bij leesfuncties wordt tevens de registerwaarde gedeeld door 100.
   */
  function analyzeModbusFrame(hexFrame) {
    const cleaned = hexFrame.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length < 4) return null;
    const dataWithoutCRC = cleaned.slice(0, -4);
    
    if (dataWithoutCRC.length === 12) {
      // Schrijf-response: slave, functecode, registeradres (2 bytes) en registerwaarde (2 bytes)
      const slave = dataWithoutCRC.substr(0, 2);
      const func = dataWithoutCRC.substr(2, 2);
      const regAddrHex = dataWithoutCRC.substr(4, 4);
      const regValueHex = dataWithoutCRC.substr(8, 4);
      const regAddr = parseInt(regAddrHex, 16);
      const regValue = parseInt(regValueHex, 16);
      const regValueScaled = regValue / 100;
      return {
        type: 'write',
        slave,
        func,
        regAddrHex: regAddrHex.match(/.{1,2}/g).join(' '),
        regAddr,
        regValueHex: regValueHex.match(/.{1,2}/g).join(' '),
        regValue,
        regValueScaled
      };
    } else if (dataWithoutCRC.length === 10) {
      // Lees-response: slave, functecode, byte count en registerwaarde (2 bytes)
      const slave = dataWithoutCRC.substr(0, 2);
      const func = dataWithoutCRC.substr(2, 2);
      const byteCount = dataWithoutCRC.substr(4, 2);
      const regValueHex = dataWithoutCRC.substr(6, 4);
      const regValue = parseInt(regValueHex, 16);
      const regValueScaled = regValue / 100;
      return {
        type: 'read',
        slave,
        func,
        byteCount,
        regValueHex: regValueHex.match(/.{1,2}/g).join(' '),
        regValue,
        regValueScaled
      };
    } else {
      return null;
    }
  }
  
  /**
   * Converteer een hex-string naar een base64-string.
   */
  function hexToBase64(hexStr) {
    const cleaned = hexStr.replace(/\s+/g, '');
    const buffer = Buffer.from(cleaned, 'hex');
    return buffer.toString('base64');
  }
  
  module.exports = {
    calculateCRC16,
    formatHexString,
    analyzeModbusFrame,
    hexToBase64
  };
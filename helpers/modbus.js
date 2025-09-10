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
   * Analyseer een Modbus-frame (leesfunctie of schrijffunctie).
   * Voor leesfuncties wordt de registerwaarde gedeeld door 100 (of 10000 voor 4-byte waarden).
   */
  function analyzeModbusFrame(hexFrame) {
    const cleaned = hexFrame.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length < 6) return null; // Minimaal slave + func + crc
    
    // Parse basic frame structure
    const slave = cleaned.substr(0, 2);
    const func = cleaned.substr(2, 2);
    
    // Check if this is a read response (function codes 03 or 04)
    if (func === '03' || func === '04') {
      if (cleaned.length < 10) return null; // Minimaal voor read response
      const byteCount = parseInt(cleaned.substr(4, 2), 16);
      const expectedLength = 6 + (byteCount * 2) + 4; // slave + func + bytecount + data + crc
      
      if (cleaned.length === expectedLength) {
        const dataStart = 6; // Start na slave + func + bytecount
        const dataHex = cleaned.substr(dataStart, byteCount * 2);
        
        // Voor 2-byte waarden (meest voorkomend)
        if (byteCount === 2) {
          const regValue = parseInt(dataHex, 16);
          const regValueScaled = regValue / 100;
          return {
            type: 'read',
            slave,
            func,
            byteCount: cleaned.substr(4, 2),
            regValueHex: dataHex.match(/.{1,2}/g).join(' '),
            regValue,
            regValueScaled
          };
        } 
        // Voor 4-byte waarden (zoals totaal bedrag)
        else if (byteCount === 4) {
          const regValue = parseInt(dataHex, 16);
          const regValueScaled = regValue / 10000; // Voor 4-byte waarden schaalfactor 0.0001
          return {
            type: 'read',
            slave,
            func,
            byteCount: cleaned.substr(4, 2),
            regValueHex: dataHex.match(/.{1,2}/g).join(' '),
            regValue,
            regValueScaled
          };
        }
        // Voor andere byte counts
        else {
          const regValue = parseInt(dataHex, 16);
          return {
            type: 'read',
            slave,
            func,
            byteCount: cleaned.substr(4, 2),
            regValueHex: dataHex.match(/.{1,2}/g).join(' '),
            regValue,
            regValueScaled: regValue / 100 // Default schaling
          };
        }
      }
    }
    
    // Check for write response (function code 06) - legacy support
    const dataWithoutCRC = cleaned.slice(0, -4);
    if (dataWithoutCRC.length === 12) {
      // Schrijf-response: slave, functecode, registeradres (2 bytes) en registerwaarde (2 bytes)
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
    }
    
    return null;
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
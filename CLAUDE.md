# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

This is a Node.js/Express web application for Modbus CRC16 command management and utility functions. The application provides:

- CRC16 calculation for Modbus commands
- Command storage with analysis
- Payload decoding (base64 to hex)
- Hex to base64 conversion
- Meter control wizard for common functions

## Development Commands

```bash
# Start the development server
node server.js

# The server runs on port 3001 by default
# Access at: http://localhost:3001
```

## Architecture

### Core Structure
- **server.js**: Main server entry point that sets up Express and loads global commands
- **index.js**: Alternative/legacy server file with embedded route logic
- **commands.json**: Data storage for saved Modbus commands

### Module Organization
- **routes/**: Express route handlers organized by functionality
  - `index.js`: Homepage with command creation and listing
  - `decode.js`: Base64 payload decoding functionality
  - `hex2base64.js`: Hex to base64 conversion
  - `wizard/`: Meter control wizards for common operations
- **helpers/**: Shared utility modules
  - `modbus.js`: Modbus-specific functions (CRC16, frame analysis, formatting)
  - `render.js`: HTML template generation with Bootstrap styling

### Key Functions

**Modbus Operations** (`helpers/modbus.js`):
- `calculateCRC16()`: Modbus CRC16 calculation with little-endian output
- `analyzeModbusFrame()`: Parse Modbus frames and extract register values (scaled by 100)
- `formatHexString()`: Format hex strings with proper spacing
- `hexToBase64()`: Convert hex strings to base64

**Data Management**:
- Commands are stored globally in `global.commands` object
- Persistence handled through `commands.json` file
- Commands keyed by hex data (without CRC) for deduplication

### Port Configuration
- Current server runs on port 3001 (server.js:35)
- Legacy server configuration shows port 3002 (index.js:364)
- There's also a reference to port 3000 in recent commits

### UI Framework
- Bootstrap 5.3.0 via CDN
- Dutch language interface
- Responsive design with container-based layout
- Consistent navigation across all pages

## Key Patterns

1. **Global State**: Commands are stored in `global.commands` and `global.DATA_FILE`
2. **Modular Routes**: Each major feature has its own route module
3. **Consistent HTML Rendering**: All pages use `renderHeader()`/`renderFooter()` helpers
4. **Error Handling**: Input validation with user-friendly error messages
5. **Command Analysis**: Automatic analysis of stored Modbus frames with register interpretation
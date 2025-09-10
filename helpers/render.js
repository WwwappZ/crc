/**
 * Genereer de HTML-header inclusief Bootstrap.
 */
function renderHeader(title) {
    return `
    <!DOCTYPE html>
    <html lang="nl">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
      <div class="container">
        <a class="navbar-brand" href="/">Commando CRC16</a>
        <div class="collapse navbar-collapse">
          <ul class="navbar-nav ms-auto">
            <li class="nav-item"><a class="nav-link" href="/readcommands">Read Commando's</a></li>
            <li class="nav-item"><a class="nav-link" href="/writecommands">Write Commando's</a></li>
            <li class="nav-item"><a class="nav-link" href="/decode">Payload decoderen</a></li>
            <li class="nav-item"><a class="nav-link" href="/hex2base64">Hex naar Base64</a></li>
          </ul>
        </div>
      </div>
    </nav>
    <div class="container">
    `;
  }
  
  /**
   * Genereer de HTML-footer inclusief Bootstrap JS.
   */
  function renderFooter() {
    return `
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    </body>
    </html>
    `;
  }
  
  module.exports = {
    renderHeader,
    renderFooter
  };
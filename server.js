const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Página principal
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>DevSecOps Demo App</title></head>
      <body>
        <h1>DevSecOps Demo Application</h1>
        <p>Esta aplicación sirve como objetivo para pruebas SAST/DAST</p>
        <ul>
          <li><a href="/api/users">API Users</a></li>
          <li><a href="/search?q=test">Search</a></li>
          <li><a href="/health">Health Check</a></li>
        </ul>
      </body>
    </html>
  `);
});

// VULN INTENCIONAL 1: XSS Reflejado (para que ZAP lo detecte)
app.get('/search', (req, res) => {
  const query = req.query.q || '';
  // Vulnerabilidad: refleja input sin sanitizar
  res.send(`<html><body><h2>Resultados para: ${query}</h2></body></html>`);
});

// VULN INTENCIONAL 2: Inyección SQL simulada
app.get('/api/users', (req, res) => {
  const id = req.query.id;
  // Vulnerabilidad: concatenación directa (simulada)
  const query = "SELECT * FROM users WHERE id = '" + id + "'";
  console.log("Query ejecutada:", query);
  res.json({
    message: "Simulación de consulta",
    query_used: query,
    users: [
      { id: 1, name: "Admin", role: "admin" },
      { id: 2, name: "User", role: "user" }
    ]
  });
});

// VULN INTENCIONAL 3: Información sensible expuesta
app.get('/api/debug', (req, res) => {
  res.json({
    env: process.env,
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// VULN INTENCIONAL 4: Header de seguridad faltante
// (No se configuran headers de seguridad a propósito)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Demo app corriendo en http://0.0.0.0:${PORT}`);
});

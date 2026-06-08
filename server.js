/**
 * @file server.js
 * @description Aplicación Objetivo de Pruebas (Vulnerable por diseño) con Observabilidad Integrada
 * @framework Express.js
 * @integrations Prometheus (Métricas) & Stack ELK via Logstash (Auditoría Forense)
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;


// 1. TELEMETRÍA Y MÉTRICAS NATIVAS (PROMETHEUS)
const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;

// Registro global de métricas del runtime (CPU, Event Loop, Memory Footprint)
collectDefaultMetrics({ register: client.register });

/**
 * @route GET /metrics
 * @description Expuesto antes de los middlewares globales de auditoría 
 * para prevenir ruido analítico de telemetría interna en Elasticsearch.
 */
app.get('/metrics', async (req, res) => {
    try {
        res.setHeader('Content-Type', client.register.contentType);
        res.send(await client.register.metrics());
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 2. MIDDLEWARES DE CAPA DE TRANSPORTE Y PARSING (OBLIGATORIO PRE-ROUTE)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// 3. PIPELINE DE AUDITORÍA REMOTA (LOGSTASH / INSTANCIA ELK)
const LogstashClient = require('logstash-client');
const logstash = new LogstashClient({
    host: 'logstash', // DNS interno asignado en la red bridge de Docker Compose
    port: 5000,
    transport: 'tcp'
});

/**
 * @middleware Auditoría Activa de Eventos (Access Logging)
 * Sincroniza sobre el evento 'finish' del ciclo Request-Response para garantizar 
 * la inmutabilidad de los datos de estado HTTP y telemetría de red.
 */
app.use((req, res, next) => {
    res.on('finish', () => {
        logstash.send({
            "@timestamp": new Date().toISOString(),
            "environment": "production",
            "service": "demo-app",
            "log_type": "access_log",
            "http": {
                "method": req.method,
                "url": req.url,
                "status_code": res.statusCode,
                "user_agent": req.headers['user-agent'] || 'unknown',
                "remote_ip": req.ip
            },
            "payload": {
                "query_string": req.query,
                "body_keys": req.body ? Object.keys(req.body) : []
            }
        });
    });
    next();
});

// 4. ENDPOINTS OPERATIVOS Y SUPERFICIES DE ATAQUE CONTROLADAS (TFG VULNS)


/**
 * @route GET /health
 * @description Health Check operativo para las sondas Liveness/Readiness de Docker
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * @route GET /
 * @description Landpage corporativa base del Framework DevSecOps
 */
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>DevSecOps Demo App</title></head>
            <body>
                <h1>DevSecOps Demo Application</h1>
                <p>Entorno controlado para la evaluación de capacidades SAST/DAST.</p>
                <ul>
                    <li><a href="/api/users">API Users (Simulación SQLi)</a></li>
                    <li><a href="/search?q=test">Buscador (Simulación XSS)</a></li>
                    <li><a href="/health">Health Check de Infraestructura</a></li>
                </ul>
            </body>
        </html>
    `);
});

/**
 * @route GET /search
 * @security_vulnerability CWE-79: Cross-site Scripting (XSS Reflejado)
 * @description El input del parámetro query es inyectado directamente en el DOM 
 * sin pasar por filtros de sanitización (Sanitization/Escaping Bypass).
 */
app.get('/search', (req, res) => {
    const query = req.query.q || '';
    res.send(`<html><body><h2>Resultados para: ${query}</h2></body></html>`);
});

/**
 * @route GET /api/users
 * @security_vulnerability CWE-89: SQL Injection (Inyección SQL)
 * @description Concatenación explícita de inputs en strings de comandos de base de datos.
 * Despacha un log forense especializado clasificado de seguridad extrema hacia el SIEM (ELK).
 */
app.get('/api/users', (req, res) => {
    const id = req.query.id || '';
    const query = `SELECT * FROM users WHERE id = '${id}'`;
    
    console.log(`[SECURITY WARN] Consulta SQL generada dinámicamente: ${query}`);

    // Ingesta forzada en Logstash de evento forense estructurado (Security Alert)
    logstash.send({
        "@timestamp": new Date().toISOString(),
        "environment": "production",
        "service": "demo-app",
        "log_type": "security_alert",
        "alert_level": "WARN",
        "message": "Superficie inestable expuesta: Ejecución de Query SQL parametrizada por URL.",
        "security_context": {
            "vulnerability_cwe": "CWE-89",
            "input_vector": id,
            "interpolated_query": query
        }
    });

    res.json({
        message: "Simulación de consulta a persistencia relacional",
        query_used: query,
        users: [
            { id: 1, name: "Admin", role: "admin" },
            { id: 2, name: "User", role: "user" }
        ]
    });
});

/**
 * @route GET /api/debug
 * @security_vulnerability CWE-200: Exposure of Sensitive Information to an Unauthorized Actor
 * @description Fuga de información sensible del sistema operativo y variables de entorno del contenedor.
 */
app.get('/api/debug', (req, res) => {
    res.json({
        env: process.env,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        platform: process.platform
    });
});


// 5. BOOTSTRAP DE LA APLICACIÓN
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[INFO] Demo app inicializada exitosamente en http://0.0.0.0:${PORT}`);
});

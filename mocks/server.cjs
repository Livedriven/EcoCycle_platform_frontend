// Servidor opcional de demonstração. Nunca é importado pelo frontend.
const jsonServer = require('json-server');
const seed = require('./db.json');
const { prepararDadosDemo } = require('./demo-data.cjs');

function criarServidorMock({ dados = seed, hoje } = {}) {
    const app = jsonServer.create();
    // Um banco novo em memória por servidor: POST não modifica os fixtures.
    app.db = jsonServer.router(prepararDadosDemo(dados, hoje)).db;
    app.use(jsonServer.defaults({ logger: false, bodyParser: true }));
    app.use(jsonServer.rewriter(require('./routes.json')));
    app.use(require('./auth.cjs'), require('./rbac.cjs'), require('./contract.cjs'));
    return app;
}

if (require.main === module) {
    const port = Number(process.env.MOCK_PORT ?? 3000);
    criarServidorMock().listen(port, '127.0.0.1', () => {
        process.stdout.write(`Mock EcoCycle: http://localhost:${port}/api\nDados fictícios em memória; reinicie para restaurar a demonstração.\n`);
    });
}

module.exports = { criarServidorMock };

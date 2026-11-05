/* global ARQUIVOS, NOME_CACHE */
// O build injeta apenas HTML/JS/CSS/fontes/imagens públicas. A API não passa por aqui.
const PREFIXO_CACHE = 'ecocycle-shell-';
const arquivos = new Set(ARQUIVOS);

self.addEventListener('install', (evento) => {
    evento.waitUntil(caches.open(NOME_CACHE).then((cache) => cache.addAll(
        ARQUIVOS.map((url) => new Request(new URL(url, self.location.origin), { cache: 'reload' })),
    )));
});

self.addEventListener('activate', (evento) => {
    evento.waitUntil((async () => {
        const nomes = await caches.keys();
        await Promise.all(nomes.filter((nome) => nome.startsWith(PREFIXO_CACHE) && nome !== NOME_CACHE)
            .map((nome) => caches.delete(nome)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (evento) => {
    const { request } = evento;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    const caminho = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!arquivos.has(caminho)) return;

    evento.respondWith((async () => {
        const cache = await caches.open(NOME_CACHE);
        if (request.mode === 'navigate') {
            // Online, carrega o HTML mais recente. Offline, usa a versão instalada.
            try { return await fetch(request); }
            catch (erro) {
                const salvo = await cache.match(caminho);
                if (salvo) return salvo;
                throw erro;
            }
        }
        return await cache.match(caminho) ?? fetch(request);
    })());
});

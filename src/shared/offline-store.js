// Nunca guarda JWT, senha ou credenciais. Cada registro pertence a uma API/usuário.
const DB_NAME = 'ecocycle-offline';
export const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 100;
let abertura;

function abrir() {
    if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB indisponível'));
    if (!abertura) {
        abertura = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                for (const nome of ['cache', 'envios', 'resultados']) {
                    const store = req.result.createObjectStore(nome, { keyPath: 'id' });
                    store.createIndex('escopo', 'escopo');
                    if (nome === 'cache') store.createIndex('porData', ['escopo', 'data']);
                }
            };
            req.onerror = () => reject(req.error);
            req.onblocked = () => reject(new Error('Feche as outras abas para atualizar o armazenamento local.'));
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = () => { db.close(); abertura = null; };
                db.onclose = () => { abertura = null; };
                resolve(db);
            };
        }).catch((erro) => { abertura = null; throw erro; });
    }
    return abertura;
}

// Só resolve após COMMIT, nunca no onsuccess isolado de um put/delete.
async function transacao(nomes, modo, executar) {
    const db = await abrir();
    return new Promise((resolve, reject) => {
        const durabilidade = modo === 'readwrite' && !nomes.includes('cache') ? { durability: 'strict' } : undefined;
        const tx = db.transaction(nomes, modo, durabilidade);
        let resultado;
        tx.oncomplete = () => resolve(resultado);
        tx.onabort = tx.onerror = () => reject(tx.error || new Error('Falha ao gravar os dados locais.'));
        try { executar(tx, (valor) => { resultado = valor; }); }
        catch (erro) { tx.abort(); reject(erro); }
    });
}

export function listar(nome, escopo) {
    return transacao([nome], 'readonly', (tx, retornar) => {
        tx.objectStore(nome).index('escopo').getAll(escopo).onsuccess = (e) => retornar(e.target.result);
    });
}

export function lerCache(escopo, perfil, url) {
    return transacao(['cache'], 'readonly', (tx, retornar) => {
        tx.objectStore('cache').get(JSON.stringify([escopo, perfil, url])).onsuccess = (e) => {
            const registro = e.target.result;
            retornar(registro && Date.now() - registro.data <= CACHE_TTL ? registro : null);
        };
    });
}

export function gravarCache(escopo, perfil, url, dados) {
    return transacao(['cache'], 'readwrite', (tx) => {
        const store = tx.objectStore('cache');
        store.put({ id: JSON.stringify([escopo, perfil, url]), escopo, data: Date.now(), dados });
        const limites = IDBKeyRange.bound([escopo, 0], [escopo, Infinity]);
        let quantidade = 0;
        store.index('porData').openKeyCursor(limites, 'prev').onsuccess = (e) => {
            const cursor = e.target.result;
            if (!cursor) return;
            if (++quantidade > CACHE_LIMIT || Date.now() - cursor.key[1] > CACHE_TTL) store.delete(cursor.primaryKey);
            cursor.continue();
        };
    });
}

export function guardarEnvio(envio) {
    return transacao(['envios'], 'readwrite', (tx, retornar) => {
        const store = tx.objectStore('envios');
        store.index('escopo').getAll(envio.escopo).onsuccess = (e) => {
            const existente = e.target.result.find((r) => r.assinatura === envio.assinatura);
            if (!existente) store.add(envio);
            retornar(existente || envio);
        };
    });
}

// Reserva atômica entre abas, inclusive em navegadores sem Web Locks.
export function reservarEnvio(id, prazo, reserva, podeRecuperar = false) {
    return transacao(['envios'], 'readwrite', (tx, retornar) => {
        const store = tx.objectStore('envios');
        store.get(id).onsuccess = (e) => {
            const envio = e.target.result;
            if (!envio || (!podeRecuperar && envio.reservadoAte > Date.now())) return retornar(null);
            envio.reservadoAte = Date.now() + prazo;
            envio.reserva = reserva;
            store.put(envio);
            retornar(envio);
        };
    });
}

export function atualizarEnvio(envio) {
    return transacao(['envios'], 'readwrite', (tx, retornar) => {
        const store = tx.objectStore('envios');
        store.get(envio.id).onsuccess = (e) => {
            if (e.target.result?.reserva !== envio.reserva) return retornar(false);
            store.put(envio);
            retornar(true);
        };
    });
}

// Retira o payload e grava o aviso na MESMA transação: um crash não perde o resultado.
export function concluirEnvio(envio, resultado) {
    return transacao(['envios', 'resultados'], 'readwrite', (tx, retornar) => {
        const store = tx.objectStore('envios');
        store.get(envio.id).onsuccess = (e) => {
            if (e.target.result?.reserva !== envio.reserva) return retornar(false);
            store.delete(envio.id);
            tx.objectStore('resultados').put(resultado);
            retornar(true);
        };
    });
}

export function dispensarResultado(id) {
    return transacao(['resultados'], 'readwrite', (tx) => tx.objectStore('resultados').delete(id));
}

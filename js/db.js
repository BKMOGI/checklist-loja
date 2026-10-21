// Armazenamento local (IndexedDB) dos check-lists — rascunhos e finalizados,
// incluindo as fotos (Blob). Nada sai do celular até a pessoa compartilhar.
const Db = (() => {
  const DB_NAME = "checklist_loja";
  const DB_VERSION = 1;
  const STORE = "registros";

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const result = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(result && "result" in result ? result.result : result);
      t.onerror = () => reject(t.error);
    });
  }

  const salvar = (registro) => tx("readwrite", (s) => { s.put(registro); return registro; });
  const obter = (id) => tx("readonly", (s) => s.get(id));
  const excluir = (id) => tx("readwrite", (s) => s.delete(id));
  const listar = async () => {
    const todos = await tx("readonly", (s) => s.getAll());
    return (todos || []).sort((a, b) => b.inicio - a.inicio);
  };

  // Apaga finalizados antigos para não lotar o armazenamento do celular com fotos.
  async function limparAntigos(dias) {
    const limite = Date.now() - dias * 86400000;
    const todos = await listar();
    for (const r of todos) {
      if (r.status === "finalizado" && r.fim < limite) await excluir(r.id);
    }
  }

  return { salvar, obter, excluir, listar, limparAntigos };
})();

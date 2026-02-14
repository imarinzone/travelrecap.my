/**
 * Shared IndexedDB cache for non-PII GeoJSON (countries, world globe).
 * Exposes geodataCache.get(key) and geodataCache.set(key, value).
 * Falls back gracefully when IndexedDB is unavailable (private mode, disabled).
 */
(function () {
    const DB_NAME = 'mytravelrecap_geodata';
    const STORE_NAME = 'geodata';
    const DB_VERSION = 1;

    let dbPromise = null;

    function openDB() {
        if (dbPromise !== null) return dbPromise;
        if (typeof indexedDB === 'undefined' || !indexedDB.open) {
            dbPromise = Promise.reject(new Error('IndexedDB not available'));
            return dbPromise;
        }
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = function () { reject(request.error); };
            request.onsuccess = function () { resolve(request.result); };
            request.onupgradeneeded = function (e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
        return dbPromise;
    }

    function get(key) {
        return openDB()
            .then(function (db) {
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.get(key);
                    req.onsuccess = function () { resolve(req.result !== undefined ? req.result : null); };
                    req.onerror = function () { reject(req.error); };
                });
            })
            .catch(function (err) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[geodata-cache] get failed:', key, err);
                }
                return null;
            });
    }

    function set(key, value) {
        return openDB()
            .then(function (db) {
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.put(value, key);
                    req.onsuccess = function () { resolve(); };
                    req.onerror = function () { reject(req.error); };
                });
            })
            .catch(function (err) {
                if (err && err.name === 'QuotaExceededError') {
                    return Promise.resolve();
                }
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[geodata-cache] set failed:', err);
                }
                return Promise.reject(err);
            });
    }

    window.geodataCache = {
        openDB: openDB,
        get: get,
        set: set
    };
})();

// js/db.js
const DB_NAME = "yabdos-db";
const DB_VERSION = 1;
// La variable dbPromise sera accessible dans tous vos autres fichiers JS
const dbPromise = idb.openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    // Création de la table pour les exercices favoris
    if (!db.objectStoreNames.contains("favorites")) {
      db.createObjectStore("favorites", { keyPath: "id" });
    }
  },
});

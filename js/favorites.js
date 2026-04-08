// js/favorites.js
async function toggleFavorite(articleId) {
  const db = await dbPromise; // dbPromise vient de db.js
  // Récupérer l'article complet (simulé ici, en vrai on le prendrait du DOM ou d'une variable)
  const article = {
    id: articleId,
    title: `Article ${articleId}`,
    timestamp: new Date(),
  };
  // Transaction Read-Write
  const tx = db.transaction("favorites", "readwrite");
  const store = tx.objectStore("favorites");
  // Vérifier s'il existe déjà
  const existing = await store.get(articleId);
  if (existing) {
    await store.delete(articleId);
    console.log("Retiré des favoris");
  } else {
    //  ... dans le bloc else (Ajout favori) ...
    // Notification
    await store.put(article);

    const hasPerm = await checkNotificationPermission();
    if (hasPerm) {
      // Si on est sur mobile Android, on passe souvent par le SW
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification("Article sauvegardé", {
            body: "Vous pourrez le lire hors connexion.",
            icon: "/images/icon512_maskable.png",
            vibrate: [100, 50, 100],
          });
        });
      } else {
        // Fallback PC Classique
        new Notification("Article sauvegardé");
      }
    }
  }
  await tx.done;
}

async function checkNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
}

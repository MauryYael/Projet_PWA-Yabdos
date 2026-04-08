// js/favorites.js
async function toggleFavorite(exercice) {
  // On passe l'objet exercice entier
  const db = await dbPromise;
  const tx = db.transaction("favorites", "readwrite");
  const store = tx.objectStore("favorites");

  const existing = await store.get(exercice.id);
  if (existing) {
    await store.delete(exercice.id);
    console.log("Retiré des favoris");
  } else {
    await store.put(exercice); // On stocke l'objet complet (id, title, largeThumbnail...)
    console.log("Ajouté aux favoris");

    const hasPerm = await checkNotificationPermission();
    if (hasPerm) {
      // Si on est sur mobile Android, on passe souvent par le SW
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification("Exercice sauvegardé", {
            body: "Cet exercice est maintenant dans vos favoris",
            icon: "/images/icon512_maskable.png",
            vibrate: [100, 50, 100],
          });
        });
      } else {
        // Fallback PC Classique
        new Notification("Exercice sauvegardé");
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

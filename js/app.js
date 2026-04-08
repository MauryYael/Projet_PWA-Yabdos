let deferredPrompt;
const installBtn = document.getElementById("install-btn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  installBtn.classList.remove("hidden");
  console.log(`[PWA] L'événement beforeinstallprompt a été intercepté.`);
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();

  const { outcome } = await deferredPrompt.userChoice;
  console.log(`[PWA] Choix de l'utilisateur : $(outcome)`);
  deferredPrompt = null;

  installBtn.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  console.log("[PWA] Application installée avec succès !");
});


const contentDiv = document.getElementById("content");

async function loadArticles() {
  contentDiv.innerHTML = "<p>Chargement...</p>";

  try {
    // Cette URL n'existe pas réellement sur le serveur !
    const response = await fetch(
      "https://api.goodbarber.net/front/get_items/3000155/73744247/",
    );

    if (!response.ok) throw new Error("Erreur réseau");

    const articles = await response.json();

    // Génération du HTML
    const html = articles.items
      .map(
        (article) => `
            <div class="card">
                <img src="${article.largeThumbnail}" alt="${article.title}">
                <h3>${article.title}</h3>
                <button class="fav-btn" data-id="${article.id}">
                ⭐ Favoris
                </button>
                </div>
        `,
      )
      .join("");

    contentDiv.innerHTML = html;
    const favButtons = document.querySelectorAll(".fav-btn");
    // Boucler dessus pour attacher l'événement click
    favButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const articleId = e.target.getAttribute("data-id");
        toggleFavorite(articleId); // Appel de la fonction globale
      });
    });
  } catch (e) {
    console.error(e);
    contentDiv.innerHTML =
      '<p style="color:red">Impossible de charger les articles.</p>';
  }
}

loadArticles();
function updateNetworkStatus() {
  const banner = document.getElementById("offline-banner");
  if (navigator.onLine) {
    banner.style.display = "none";
    // Optionnel : recharger les articles si on revient en ligne
  } else {
    banner.style.display = "block";
  }
}
// Écouteurs d'événements
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

// Vérification initiale
updateNetworkStatus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      // Cas 1 : une nouvelle version vient d'être détectée pendant cette session
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          // Installé mais pas encore actif → état « waiting »
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showUpdateNotification(newWorker);
          }
        });
      });
      // Cas 1 bis : vous avez rafraîchi sans cliquer sur « Mettre à jour ».
      // updatefound ne repasse pas : le SW en attente est dans reg.waiting
      if (reg.waiting) {
        showUpdateNotification(reg.waiting);
      }
    });
    // Après skipWaiting, le contrôleur change — une seule inscription ici (pas dans updatefound)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  });
}
function showUpdateNotification(worker) {
  const notif = document.getElementById("update-notification");
  const btn = document.getElementById("reload-btn");
  notif.style.display = "block";
  btn.addEventListener("click", () => {
    // Envoie un message au SW en attente pour lui dire de s'activer
    worker.postMessage({ action: "skipWaiting" });
  });
}
const form = document.getElementById('contact-form');
form.addEventListener('submit', async (e) => {
e.preventDefault();
// 1. Enregistrer le message en local d'abord
const db = await dbPromise;
await db.put('drafts', message.value, 'pending-sync');
// 2. Enregistrer l'intention de synchronisation
if ('serviceWorker' in navigator && 'SyncManager' in window) {
const swReg = await navigator.serviceWorker.ready;
await swReg.sync.register('sync-contact');
console.log('Synchro planifiée !');
// Optionnel : Afficher un toast UI "Message mis en file d'attente"
} else {
// Fallback classique si l'API n'est pas supportée (ex: Safari iOS)
console.log('Envoi immédiat sans Background Sync...');
// TODO: Exécuter le fetch() classique ici
}
});
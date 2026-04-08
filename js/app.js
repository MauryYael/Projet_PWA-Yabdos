import { mesExercices } from "./exercices.js";
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
async function loadExercices() {
  contentDiv.innerHTML = "<p>Chargement des exercices...</p>";
  try {
    if (!navigator.onLine) {
      throw new Error(
        "Pas de connexion internet. Impossible de charger les exercices.",
      );
    }
    const html = mesExercices
      .slice(0, 6)
      .map(
        (exo) => `
        <div class="card">
          <img src="${exo.largeThumbnail}" alt="${exo.title}">
          <h3>${exo.title}</h3>
          <p>⏱️ ${exo.time}s | ⏸️ ${exo.pause}s</p>
          <a href="exercice.html?id=${exo.id}" class="card-btn">Commencer</a>
          <button class="fav-btn" data-id="${exo.id}">⭐ Favoris</button>
        </div>
      `,
      )
      .join("");

    contentDiv.innerHTML = html;
    document.querySelectorAll(".fav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const exoId = e.currentTarget.getAttribute("data-id");
        // On trouve l'objet exercice complet pour l'envoyer aux favoris
        const exercice = mesExercices.find((item) => item.id == exoId);

        if (exercice) {
          toggleFavorite(exercice); // On envoie l'objet, pas juste l'ID
        }
      });
    });
  } catch (error) {
    contentDiv.innerHTML = `<p style="color:red">⚠️ ${error.message}</p>`;
  }
}


// loader uniquement les favoris
async function loadFavorisPage() {
  const contentDiv = document.getElementById("content");
  contentDiv.innerHTML = "<p>Chargement de vos favoris...</p>";

  try {
    const db = await dbPromise; // On récupère la base de données
    const favoris = await db.getAll("favorites"); // On lit tout le contenu

    if (favoris.length === 0) {
      contentDiv.innerHTML = `
        <div class="card empty-card" style="text-align: center; min-height: 250px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px;">
            <h2>Aucun favori</h2>
            <p style="color: grey; margin-top: 10px;">Allez sur l'accueil pour ajouter des exercices !</p>
        </div>
      `;
      return;
    }

    // On génère l'affichage (avec un bouton pour les retirer)
    const html = favoris.map(exo => `
      <div class="card">
        <img src="${exo.largeThumbnail}" alt="${exo.title}">
        <h3>${exo.title}</h3>
        <a class="launch-btn" href="exercice.html?id=${exo.id}">Démarrer</a>
        <button class="remove-fav-btn" data-json='${JSON.stringify(exo)}'>
          ❌ Retirer
        </button>
      </div>
    `).join("");

    contentDiv.innerHTML = html;

    document.querySelectorAll(".remove-fav-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const exerciceData = JSON.parse(e.target.getAttribute("data-json"));
        await toggleFavorite(exerciceData);
        loadFavorisPage(); // Recharge la liste instantanément !
      });
    });

  } catch (error) {
    console.error("Erreur favoris :", error);
    contentDiv.innerHTML = "<p>Erreur lors du chargement des favoris.</p>";
  }
}
if (window.location.pathname.includes("favoris.html")) {
  loadFavorisPage();
}else {
  loadExercices(); 
}





// loader l'exercice choisi
const contentExercice = document.getElementById("contentExercice");
const paramString = window.location.search;
const urlParams = new URLSearchParams(paramString);
const exerciceId = urlParams.get("id");
const exerciceTrouve = mesExercices.find((exo) => exo.id === exerciceId);
async function loadExercice() {
  contentExercice.innerHTML = "<p>Chargement des exercices...</p>";
  try {
    if (!navigator.onLine) {
      throw new Error(
        "Pas de connexion internet. Impossible de charger les exercices.",
      );
    }
    const html = `
        <div class="card">
          <img src="${exerciceTrouve.largeThumbnail}" alt="${exerciceTrouve.title}">
          <h3>${exerciceTrouve.title}</h3>
          <p>⏱️ Objectif : ${exerciceTrouve.time}s</p>
      
          <div id="timer-display" style="font-size: 3rem; font-weight: bold; margin: 20px 0;">
          ${exerciceTrouve.time}s
          </div>

          <button id="start-btn" class="card-btn">Démarrer</button>
        </div>`;

    contentExercice.innerHTML = html;
    const startBtn = document.getElementById("start-btn");
    const timerDisplay = document.getElementById("timer-display");
    let tempsRestant = exerciceTrouve.time;
    let foudre;

    startBtn.addEventListener("click", () => {
      startBtn.disabled = true;
      startBtn.innerText = "En cours...";
      foudre = setInterval(() => {
        tempsRestant--;
        timerDisplay.innerText = `${tempsRestant}s`;

        if (tempsRestant <= 0) {
          clearInterval(foudre);
          timerDisplay.innerText = "Terminé ! 🏁";
          timerDisplay.style.color = "green";
          startBtn.innerText = "Bravo !";
        }
      }, 1000);
    });
  } catch (error) {
    contentExercice.innerHTML = `<p style="color:red">⚠️ ${error.message}</p>`;
  }
}

if (contentExercice) {
  loadExercice();
}

function updateNetworkStatus() {
  const banner = document.getElementById("offline-banner");
  if (navigator.onLine) {
    banner.style.display = "none";
    // Optionnel : recharger les exercices si on revient en ligne
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
// const form = document.getElementById("contact-form");
// form.addEventListener("submit", async (e) => {
//   e.preventDefault();
//   // 1. Enregistrer le message en local d'abord
//   const db = await dbPromise;
//   await db.put("drafts", message.value, "pending-sync");
//   // 2. Enregistrer l'intention de synchronisation
//   if ("serviceWorker" in navigator && "SyncManager" in window) {
//     const swReg = await navigator.serviceWorker.ready;
//     await swReg.sync.register("sync-contact");
//     console.log("Synchro planifiée !");
//     // Optionnel : Afficher un toast UI "Message mis en file d'attente"
//   } else {
//     // Fallback classique si l'API n'est pas supportée (ex: Safari iOS)
//     console.log("Envoi immédiat sans Background Sync...");
//     // TODO: Exécuter le fetch() classique ici
//   }
// });

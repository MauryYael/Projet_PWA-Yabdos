# TP 2 : Service Workers, Cycle de Vie et Caching Avancé

**Contexte :** Votre application `PWA News` est maintenant installable (grâce au Manifeste du TP1). Mais si vous coupez le réseau, vous obtenez le dinosaure Chrome. L'objectif d'aujourd'hui est de transformer votre application en une forteresse "Offline-First" en maîtrisant le proxy réseau : le **Service Worker**.

---

## Étape 1 : Enregistrement Non-Bloquant (Performance)

Le téléchargement et l'analyse d'un Service Worker (SW) coûtent du CPU. En production, il ne faut **jamais** enregistrer un SW pendant que la page charge son contenu principal (risque de dégrader le LCP/TTI).

1. Dans votre fichier `js/app.js`, implémentez l'enregistrement robuste :

```javascript
// js/app.js

// 1. Feature Detection : Le navigateur supporte-t-il les SW ?
if ('serviceWorker' in navigator) {
    
    // 2. On attend que la page soit ENTIÈREMENT chargée (images incluses)
    // pour ne pas voler de la bande passante au contenu principal.
    window.addEventListener('load', async () => {
        try {
            // 3. Enregistrement du fichier à la RACINE du projet (très important pour le scope)
            const registration = await navigator.serviceWorker.register('/sw.js');
            
            console.log('[App] Service Worker enregistré avec succès ! Scope :', registration.scope);
            
            // (Bonus) Détection des mises à jour du SW
            registration.addEventListener('updatefound', () => {
                console.log('[App] Une nouvelle version du Service Worker est en cours d\'installation...');
            });

        } catch (error) {
            console.error('[App] Échec de l\'enregistrement du Service Worker :', error);
        }
    });
} else {
    console.warn('[App] Les Service Workers ne sont pas supportés sur ce navigateur.');
}
```

---

## Étape 2 : Phase d'Installation et Versioning (Precache)

C'est ici que nous allons mettre en cache notre "App Shell" (HTML, CSS, JS de base, icônes).
Le secret d'une PWA robuste est le **versioning**. Si vous modifiez votre CSS, vous devez changer la version du cache pour forcer la mise à jour chez vos utilisateurs.

1. Créez un fichier `sw.js` **à la racine de votre projet** (au même niveau que `index.html`).
2. Implémentez la phase d'installation :

```javascript
// sw.js

// Versioning strict : Changez ce numéro à chaque modification de vos assets statiques
const CACHE_VERSION = 'v1.0.0';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;

// Liste exacte des fichiers à mettre en cache (Attention aux erreurs 404, une seule fera échouer l'installation globale)
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/manifest.json',
    '/images/icons/icon-192.png'
    // Ajoutez ici votre page offline de secours si vous en avez une (ex: '/offline.html')
];

// Événement INSTALL : Déclenché lors du premier téléchargement du SW ou lors d'un changement de byte dans sw.js
self.addEventListener('install', (event) => {
    console.log(`[SW] Installation de la version ${CACHE_VERSION}...`);
    
    // event.waitUntil() force le navigateur à garder le SW en vie 
    // jusqu'à ce que la promesse à l'intérieur soit résolue.
    event.waitUntil(
        caches.open(APP_SHELL_CACHE)
            .then((cache) => {
                console.log('[SW] Mise en cache de l\'App Shell...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                // Force l'activation immédiate du nouveau SW (passe l'état "waiting")
                // Utile en développement, à utiliser avec précaution en production.
                return self.skipWaiting();
            })
    );
});
```

---

## Étape 3 : Phase d'Activation et Housekeeping (Nettoyage)

Quand vous passez à la `v2.0.0`, le cache `v1.0.0` reste sur le téléphone de l'utilisateur. C'est à vous de le supprimer lors de l'activation du nouveau SW.

1. Toujours dans `sw.js`, ajoutez la gestion de l'activation :

```javascript
// Événement ACTIVATE : Le SW prend le contrôle. Idéal pour faire le ménage.
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activation de la version ${CACHE_VERSION}...`);
    
    // Liste des caches autorisés (ceux qu'on veut garder)
    const cacheWhitelist = [APP_SHELL_CACHE];

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Si le cache analysé n'est pas dans notre whitelist, on le détruit
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log(`[SW] Suppression de l'ancien cache obsolète : ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Permet au SW de contrôler immédiatement les clients (pages) ouverts 
            // sans avoir à recharger la page.
            return self.clients.claim();
        })
    );
});
```

---

## Étape 4 : Le SW comme Mock Server (Proxy)

Plutôt que d'avoir des données en dur dans `app.js`, nous allons faire comme si nous appelions une API REST. Mais cette API n'existe pas : c'est le Service Worker qui va la simuler.

### 4.1 Côté Application (Client)

Modifiez `js/app.js` pour faire un vrai appel réseau.

```javascript
// js/app.js
const contentDiv = document.getElementById('content');

async function loadArticles() {
    contentDiv.innerHTML = '<p>Chargement...</p>';
    
    try {
        // Cette URL n'existe pas réellement sur le serveur !
        const response = await fetch('/api/articles'); 
        
        if (!response.ok) throw new Error('Erreur réseau');
        
        const articles = await response.json();
        
        // Génération du HTML
        const html = articles.map(article => `
            <div class="card">
                <img src="${article.image}" alt="${article.title}">
                <h3>${article.title}</h3>
            </div>
        `).join('');
        
        contentDiv.innerHTML = html;
        
    } catch (e) {
        console.error(e);
        contentDiv.innerHTML = '<p style="color:red">Impossible de charger les articles.</p>';
    }
}

loadArticles();
```

Si vous actualisez maintenant, vous aurez une erreur 404 (logique).

### 4.2 Côté Service Worker (Proxy)

Interceptez cette route spécifique dans `sw.js`.

```javascript
// sw.js

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // 1. Interception de l'API fictive
    if (url.pathname === '/api/articles') {
        // On construit une réponse artificielle (Mock)
        const fakeData = [
            { title: "PWA : Le Futur du Web", image: "[https://dummyimage.com/600x400/000/fff&text=PWA](https://dummyimage.com/600x400/000/fff&text=PWA)" },
            { title: "Service Worker Power", image: "[https://dummyimage.com/600x400/000/fff&text=SW](https://dummyimage.com/600x400/000/fff&text=SW)" },
            { title: "Offline First", image: "[https://dummyimage.com/600x400/000/fff&text=Offline](https://dummyimage.com/600x400/000/fff&text=Offline)" }
        ];

        const jsonResponse = new Response(JSON.stringify(fakeData), {
            headers: { 'Content-Type': 'application/json' }
        });

        // On répond à la requête avec notre faux JSON
        event.respondWith(jsonResponse);
    } 
    // 2. Interception des images
    // Remplacer aléatoirement 1 image sur 5
    else if (event.request.destination === 'image' && Math.random() < 0.2) {
        event.respondWith(fetch('[https://picsum.photos/200/300](https://picsum.photos/200/300)'));
    }
    // 3. Sinon, on laisse passer vers le réseau
    // Si on ne met pas ça, plus rien ne charge !
    else {
        // Pas de respondWith = comportement par défaut du navigateur
    }
});
```

👉 **Testez :** Actualisez la page. La liste doit s'afficher alors que l'URL `/api/articles` n'existe pas sur votre serveur. C'est la preuve que le SW a intercepté la requête.

## Étape 5 : UX Réseau (Online/Offline)

Une PWA doit réagir instantanément à la perte de connexion, même sans recharger la page.

1. Ajoutez un élément `#offline-banner` dans votre HTML (caché par défaut en CSS `display: none`).

```html
<div id="offline-banner" class="offline-banner">⚠️ Mode Hors-Ligne</div>
```

```css
.offline-banner {
    display: none;
    background: #ff4444; color: white; text-align: center; padding: 10px;
    position: fixed; top: 60px; width: 100%; z-index: 999;
}
```

1. Dans `js/app.js`, écoutez les événements du navigateur :

```javascript
function updateNetworkStatus() {
    const banner = document.getElementById('offline-banner');
    if (navigator.onLine) {
        banner.style.display = 'none';
        // Optionnel : recharger les articles si on revient en ligne
    } else {
        banner.style.display = 'block';
    }
}

// Écouteurs d'événements
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// Vérification initiale
updateNetworkStatus();
```

👉 **Testez :** Coupez le Wifi de votre ordinateur ou utilisez le mode "Offline" dans l'onglet Network des DevTools. Le bandeau doit apparaître immédiatement.

---

## 🧪 Étape 6 : Audit, Débogage et Tests de Résilience

C'est le moment de vérité.

1. **Vérification de l'installation :**v
  - DevTools > Onglet **Application** > **Service Workers**.
  - Vous devez voir votre SW "Activated and is running".
2. **Vérification du stockage :**
  - DevTools > Onglet **Application** > **Cache Storage**.
  - Vous devez voir votre cache `app-shell-v1.0.0` avec tous vos fichiers dedans.
3. **Le Test du Mode Avion (Offline) :**
  - DevTools > Onglet **Network** > Passez "No throttling" à **Offline**.
  - Rafraîchissez la page (F5). 
  
  - **Objectif :** Votre page HTML et son CSS s'affichent instantanément en provenance du Service Worker (Regardez la colonne "Size" dans l'onglet Network, il sera écrit `(ServiceWorker)`).
4. **Test du Versioning :**
  - Changez une couleur dans votre `style.css`.
  - Changez `CACHE_VERSION` en `v2.0.0` dans votre `sw.js`.
  - Rafraîchissez. Observez la console : vous verrez l'installation de la V2 et la suppression du cache V1 !

**Félicitations :** Votre application est maintenant officiellement une forteresse insensible aux coupures réseau (pour son interface de base).
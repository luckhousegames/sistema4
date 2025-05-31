const CACHE_NAME = 'luckhouse-sys-cache-v1.5.0'; // Mude a versão se atualizar os arquivos!
const urlsToCache = [
  './', // Alias para index.html se start_url for './'
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './offline.html', // Página para mostrar quando offline
  // Adicione aqui os caminhos para seus principais ícones e logo
  './favicon.ico',
  './favicon-96x96.png',
  './apple-touch-icon.png',
  './assets/logo.png', // Logo da sidebar
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-512x512.png', // Se você tiver
  // Adicione outras imagens ou fontes importantes que são carregadas inicialmente
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&family=Orbitron:wght@400;700&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js'
];

// Evento de Instalação: Cacheia os arquivos principais
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Cacheando arquivos principais');
        return cache.addAll(urlsToCache.map(url => new Request(url, { cache: 'reload' }))); // Força o recarregamento da rede
      })
      .then(() => {
        console.log('[ServiceWorker] Arquivos principais cacheados com sucesso.');
        return self.skipWaiting(); // Força o novo Service Worker a ativar imediatamente
      })
      .catch(error => {
        console.error('[ServiceWorker] Falha ao cachear arquivos principais:', error);
      })
  );
});

// Evento de Ativação: Limpa caches antigos
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Ativando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Limpando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
        console.log('[ServiceWorker] Cache limpo, cliente será controlado.');
        return self.clients.claim(); // Controla clientes não controlados imediatamente
    })
  );
});

// Evento Fetch: Intercepta requisições de rede
self.addEventListener('fetch', event => {
  // Só lida com requisições GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Estratégia: Cache first, then network, com fallback para offline.html para navegações
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request)
        .then(response => {
          if (response) {
            // console.log(`[ServiceWorker] Servindo do cache: ${event.request.url}`);
            return response;
          }
          // console.log(`[ServiceWorker] Buscando da rede: ${event.request.url}`);
          return fetch(event.request).then(networkResponse => {
            // Se for uma requisição bem-sucedida e não for de uma extensão do chrome, cacheia
            if (networkResponse && networkResponse.status === 200 && !event.request.url.startsWith('chrome-extension://')) {
              // Não cachear streaming de vídeo/áudio ou grandes arquivos dinâmicos por padrão aqui.
              // Verifique o tipo de conteúdo se precisar ser mais seletivo.
              // cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Se a requisição de navegação falhar (offline)
            if (event.request.mode === 'navigate') {
              console.log('[ServiceWorker] Falha na busca da rede (navegação). Servindo offline.html.');
              return caches.match('./offline.html');
            }
            // Para outros tipos de requisição (imagens, scripts, etc.), não retorna nada se falhar e não estiver no cache.
            // O navegador mostrará o erro padrão.
          });
        });
    })
  );
});

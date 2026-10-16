// public/sw.js

// 1. Ouvir o evento de notificação enviada pelo servidor (Push do Servidor WebPush)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body || 'Nova rotina ou tarefa atribuída.',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'routine-notification',
      renotify: true,
      requireInteraction: true,
      data: {
        url: data.url || '/tasks',
        timestamp: data.timestamp || Date.now()
      },
      actions: [
        { action: 'open', title: 'Visualizar' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || '📋 Nova Rotina!', options)
    );
  } catch (err) {
    console.error('Erro ao processar notificação push:', err);
  }
});

// 2. Ação ao clicar na notificação (Abre a aplicação na página correta tanto no desktop como mobile)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/tasks';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se a aba da aplicação já estiver aberta, foca e navega para a URL
      for (let client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(targetUrl)) {
            return client.focus();
          } else {
            return client.navigate(targetUrl).then(c => c ? c.focus() : null);
          }
        }
      }
      // Se estiver fechada (como em celular com o app em segundo plano), abre nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

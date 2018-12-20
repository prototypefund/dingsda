console.log('Loaded service worker!');

self.addEventListener('push', ev => {
  const data = ev.data.json();
  console.log('Got push', data);

  sendMessageToAllClients(data); // message mainly to make them relaoad/update notifications etc

  isClientFocused()
  .then((clientIsFocused) => {
    if (clientIsFocused) {
      console.log('Don\'t need to show a notification.');
      return;
    }

    // Client isn't focused, we need to show a notification.
    return self.registration.showNotification(data.title, {
            body: data.body,
            tag: 'new_notifications', // makes all coming push msgs with same tag overwrite this one
            //icon: 'images/example.png',
            vibrate: [100, 50, 100],
            data: {
              dateOfArrival: Date.now(),
              primaryKey: 1
            }
          });
  });

});

self.addEventListener('notificationclick', function(event) {
  const clickedNotification = event.notification;
  clickedNotification.close();
  console.log("notification clicked!!!");

  // Do something as the result of the notification click
  const examplePage = '/';
  const urlToOpen = new URL(examplePage, self.location.origin).href;

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  .then((windowClients) => {
    let matchingClient = null;

    for (let i = 0; i < windowClients.length; i++) {
      const windowClient = windowClients[i];
      if (windowClient.url === urlToOpen) {
        matchingClient = windowClient;
        break;
      }
    }

    if (matchingClient) {
      return matchingClient.focus();
    } else {
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});

self.addEventListener('message', function(event) {
    var data = event.data;

    if (data.command == "broadcast") {
        console.log("Broadcasting to the clients");

        self.clients.matchAll().then(function(clients) {
            clients.forEach(function(client) {
                client.postMessage({
                    "command": "broadcastOnRequest",
                    "message": "This is a broadcast on request from the SW"
                });
            })
        })
    }
});

function sendMessageToAllClients(msg)
{
  self.clients.matchAll().then(function(clients) {
      clients.forEach(function(client) {
          client.postMessage({
              "command": "broadcastOnRequest",
              "message": msg
          });
      })
  })
}

function isClientFocused() {
  console.log("checking if client is focussed");
  return clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  .then((windowClients) => {
    let clientIsFocused = false;

    for (let i = 0; i < windowClients.length; i++) {
      const windowClient = windowClients[i];
      if (windowClient.focused) {
        clientIsFocused = true;
        break;
      }
    }
    console.log(clientIsFocused);
    return clientIsFocused;
  });
}

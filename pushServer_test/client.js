// Hard-coded, replace with your public key
//const config = require("./../server_config.json")
//const publicVapidKey = config.publicVapidKey;
const publicVapidKey = "BG2mYab2K0_YOXhKMOI_0XGeGBwfwqtotTR4l5-SjfvVwTGZqy5cUfphDYJ9FITMNp4AQkMBzHib6EC-h-hWMJ0"

let glb_username = "jan" // just for testing. should later come from dingsda UI/two variable


async function register4Push()
{
  glb_username = document.getElementById("name").value 
  console.log("registering as "+glb_username);
  

  if ('serviceWorker' in navigator) {
    console.log('Registering service worker');

    run().catch(error => console.error(error)); // here there is ALWAYS an error the first time it happens. CONTINUE HERE: fix that!
  }

}
let registration;

async function run() {
  console.log('Registering service worker');
  registration = await navigator.serviceWorker.
    register('/worker.js', {scope: '/'});
  console.log('Registered service worker');

  requestBroadcast();

  console.log('Registering push');
  if (registration.pushManager)
  {
    const subscription = await registration.pushManager. // seems to not work in safari
      subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });
    console.log('Registered push');

    console.log('subscribing for push at push server');
    await fetch('/subscribe?user='+glb_username, { // HERE THE USERNAME gets handed over
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: {
        'content-type': 'application/json'
      }
    });
    console.log('Sent push');
  }
  else {
    console.log("pushManager not available in your Browser");
  }

}

function registerBroadcastReceiver() {
    navigator.serviceWorker.onmessage = function(event) {
        console.log("Broadcasted from SW : ", event.data);

        if (event.data.message.title === "test")
        {
          document.getElementById("main").append(event.data.message.body)
          // here load notifications and update notifications!!!!!
        }

        var data = event.data;

        if (data.command == "broadcastOnRequest") {
            console.log("Broadcasted message from the ServiceWorker : ", data.message);
        }
    };
}

function requestBroadcast() {
    console.log("Requesting for broadcast");
    registerBroadcastReceiver();
    if (navigator.serviceWorker.controller) {
        console.log("Sending message to service worker");
        navigator.serviceWorker.controller.postMessage({
            "command": "broadcast"
        });
    } else {
        console.log("No active ServiceWorker");
    }
}


function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

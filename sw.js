// Auto-generated -- do not hand-edit. Change tools/build-demo.js instead.
//
// Strategy: the page itself is network-first -- an installed PWA serving a
// stale index.html has no way to tell anyone it is stale, and on iOS it can
// stay that way for days. Everything else (icons, the manifest) stays
// cache-first, since those change only when the build does. Offline still
// works: a failed navigation falls back to the cached page.
const CACHE = "baobaoxiang-vdbf5e65e";
const FILES = ["./", "./index.html", "./manifest.json",
               "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES); }));
});

// On an upgrade -- and only on an upgrade, never on a first install --
// every open window is navigated to itself. Without this an installed
// iOS PWA keeps showing the build it woke up with until it is launched
// a second time, which is how a fix can look like it did not ship.
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    const old = keys.filter(function(k){ return k !== CACHE; });
    return Promise.all(old.map(function(k){ return caches.delete(k); }))
      .then(function(){ return self.clients.claim(); })
      .then(function(){
        if(!old.length) return;
        return self.clients.matchAll({ type: "window" }).then(function(cs){
          cs.forEach(function(c){ if(c.navigate) c.navigate(c.url); });
        });
      });
  }));
});

self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;

  // Only handle files from this site. Supabase requests always go to the
  // network and must never be cached.
  const url = new URL(e.request.url);
  if(url.origin !== location.origin) return;

  const save = function(res){
    if(res && res.status === 200){
      const copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
    }
    return res;
  };

  // The document: network first, cache only when the network is gone.
  if(e.request.mode === "navigate" || url.pathname.endsWith(".html")){
    e.respondWith(
      fetch(e.request).then(save).catch(function(){
        return caches.match(e.request).then(function(hit){
          return hit || caches.match("./index.html");
        });
      })
    );
    return;
  }

  // Everything else: cache first, refreshed in the background.
  e.respondWith(
    caches.match(e.request).then(function(hit){
      const net = fetch(e.request).then(save).catch(function(){ return hit; });
      return hit || net;
    })
  );
});

// ============================================================
//  Push: show a notification when the server pushes one
//
//  This is the only thing that runs while the app is closed -- the browser
//  wakes the service worker for a few seconds just for this.
//
//  Can do: show a notification, system notification sound, vibration.
//  Cannot do: play a custom alarm sound (browsers do not allow background audio).
//             Only once the user taps through into the app does it start ringing.
// ============================================================
self.addEventListener("push", function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch(err){}

  var title = d.title || "Alarm";
  var body  = d.body  || "Time is up";
  if(d.at)   body = d.at + "\u3000" + body;
  if(d.note) body += "\u3000\u00b7\u3000" + d.note;

  e.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: "alarm-" + (d.id || "x"),   // do not stack copies of the same alarm
    renotify: true,                  // but do alert again
    requireInteraction: true,        // do not dismiss itself
    silent: false,                   // make a sound
    vibrate: [400, 200, 400, 200, 400],
    data: { url: "./", id: d.id }
  }));
});

// Tapping the notification brings the app to the front and tells it to start ringing.
// Merely opening the app would show a silent screen -- that is a notification, not an alarm.
//
// The holiday warning is the exception. Its id is negative, and tapping it
// only opens the app: "tomorrow is a holiday" going off like an alarm in
// someone's hand is the wrong end of the same feature.
self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var id = (e.notification.data && e.notification.data.id) || 0;
  var ring = id > 0 ? id : 0;
  e.waitUntil(
    self.clients.matchAll({ type:"window", includeUncontrolled:true })
      .then(function(list){
        for(var i = 0; i < list.length; i++){
          if("focus" in list[i]){
            if(ring) try{ list[i].postMessage({ ring: ring }); }catch(err){}
            return list[i].focus();
          }
        }
        // Fully closed -> open it, passing "which alarm" through the URL
        if(self.clients.openWindow)
          return self.clients.openWindow(ring ? "./?ring=" + ring : "./");
      })
  );
});

// ============================================================
//  The browser rotated the subscription
//
//  A push subscription is not permanent -- browsers replace it after a long
//  idle spell, a storage clear, or an update. Once that happens the address
//  the server has is dead, it answers 410, and reminders stop arriving. No
//  error reaches the user: the app still says push is on.
//
//  This event is the only warning there is, and it fires while the app is
//  closed. Subscribe again straight away so a working address exists. This
//  worker has no login of its own, so it cannot tell the server -- the page
//  does that the next time it opens (pushSync() in webpage.h), which is why
//  it matters that the address is already valid by then.
// ============================================================
const VAPID_PUBLIC = "BN5ne9XHo_flJnoAdDBHWebJDL-UMOGvbAsUQXLI9ap4cqfVVBa1KV_rwUZlPYiiuN6vsWCpqLdHOZb5UEGOBgU";

function b64ToBytes(b64){
  var pad = "=".repeat((4 - b64.length % 4) % 4);
  var raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  var out = new Uint8Array(raw.length);
  for(var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

self.addEventListener("pushsubscriptionchange", function(e){
  e.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToBytes(VAPID_PUBLIC)
    }).catch(function(){})
  );
});

const STORAGE_KEY = 'autoClearLocalStorage';

browser.storage.local.get(STORAGE_KEY).then(result => {
  const autoClear = result[STORAGE_KEY] !== false;
  window.postMessage({ type: 'AUTO_CLEAR_SETTING', value: autoClear }, '*');
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    window.postMessage({ type: 'AUTO_CLEAR_SETTING', value: changes[STORAGE_KEY].newValue }, '*');
  }
});

var script = document.createElement('script');
script.src = browser.runtime.getURL('inject.js');
script.onload = function() { this.remove(); };
document.documentElement.appendChild(script);

window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data.type !== 'FETCH_GEO') return;
    const ip = event.data.ip;
    fetch(`http://ip-api.com/json/${ip}`)
        .then(r => r.json())
        .then(geo => {
            window.postMessage({type: 'GEO_RESULT', ip, geo}, '*');
        })
        .catch(() => {});
});
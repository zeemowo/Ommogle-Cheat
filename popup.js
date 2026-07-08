const STORAGE_KEY = 'autoClearLocalStorage';

const checkbox = document.getElementById('autoClear');

browser.storage.local.get(STORAGE_KEY).then(result => {
  checkbox.checked = result[STORAGE_KEY] !== false;
});

checkbox.addEventListener('change', () => {
  browser.storage.local.set({ [STORAGE_KEY]: checkbox.checked });
});

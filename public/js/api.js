var API_BASE_URL = window.API_BASE_URL || 'https://script.google.com/macros/s/AKfycbxCWUHr-33sTja9_mOE1r0-wDEfQ2iHnMiEerja0gujBicQpI82uWRbsMpDMk-b6oNw0g/exec';

window.APP_CONFIG = window.APP_CONFIG || {
  apiBaseUrl: 'https://script.google.com/macros/s/AKfycbxCWUHr-33sTja9_mOE1r0-wDEfQ2iHnMiEerja0gujBicQpI82uWRbsMpDMk-b6oNw0g/exec',
  partialBaseUrl: '/'
};

function callAppsScriptApi_(baseUrl, functionName, payload) {
  return new Promise(function (resolve, reject) {
    var callbackName = '__gasJsonp_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    var serializedPayload = typeof payload === 'undefined' ? 'null' : JSON.stringify(payload);
    var script = document.createElement('script');
    var timeoutId = setTimeout(function () {
      cleanup();
      reject(new Error('Timed out while calling Apps Script.'));
    }, 30000);

    function cleanup() {
      clearTimeout(timeoutId);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      try {
        delete window[callbackName];
      } catch (error) {
        window[callbackName] = undefined;
      }
    }

    window[callbackName] = function (result) {
      cleanup();
      if (result && result.error) {
        reject(new Error(result.error));
        return;
      }
      resolve(result);
    };

    script.async = true;
    script.src = baseUrl
      + (baseUrl.indexOf('?') === -1 ? '?' : '&')
      + 'action=' + encodeURIComponent(functionName)
      + '&data=' + encodeURIComponent(serializedPayload)
      + '&callback=' + encodeURIComponent(callbackName)
      + '&_ts=' + Date.now();
    script.onerror = function () {
      cleanup();
      reject(new Error('Failed to load Apps Script API.'));
    };

    document.head.appendChild(script);
  });
}

window.API = window.API || {
  call: function (functionName, payload) {
    if (window.google && google.script && google.script.run) {
      return new Promise(function (resolve, reject) {
        var args = Array.isArray(payload)
          ? payload
          : (typeof payload === 'undefined' || payload === null ? [] : [payload]);
        var runner = google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject);
        runner[functionName].apply(runner, args);
      });
    }

    return callAppsScriptApi_(window.APP_CONFIG.apiBaseUrl, functionName, payload);
  },

  loadHtml: function (name) {
    var fileName = String(name || '').replace(/\.html$/i, '') + '.html';
    var localUrl = (window.APP_CONFIG.partialBaseUrl || '/') + fileName;

    return fetch(localUrl, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .catch(function () {
        return API.call('getPage', String(name || '').replace(/\.html$/i, ''));
      });
  }
};

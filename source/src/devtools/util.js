let index = 0;
setInterval(() => {
  let msg = "util: " + index++;
  // chrome.extension.sendMessage(msg;
  if (typeof aa !== undefined) {
    msg = aa;
  }
  window.postMessage({type: 1, msg: msg}, "*");
}, 2000);




const {app,BrowserWindow}=require('electron');
BrowserWindow.prototype.show=function(){};
BrowserWindow.prototype.focus=function(){};
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.on('browser-window-created',(_event,window)=>window.webContents.setBackgroundThrottling(false));
require("C:\\Users\\zFlei\\repos\\lux\\.worktrees\\fiber-optic-heart\\apps\\studio\\dist\\main.cjs");

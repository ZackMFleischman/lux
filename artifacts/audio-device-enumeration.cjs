const {app,BrowserWindow,session}=require('electron');
const {join}=require('node:path');
const {writeFileSync}=require('node:fs');

app.setPath('userData',join(__dirname,'audio-device-diagnostic-profile'));
app.whenReady().then(async()=>{
  const observations=[];
  let window;
  session.defaultSession.setPermissionCheckHandler((webContents,permission,requestingOrigin,details)=>{
    observations.push({kind:'check',trusted:webContents===window?.webContents,permission,requestingOrigin,details});
    return webContents===window?.webContents&&permission==='media'&&details?.isMainFrame===true&&details?.mediaType==='audio';
  });
  session.defaultSession.setPermissionRequestHandler((webContents,permission,callback,details)=>{
    observations.push({kind:'request',trusted:webContents===window?.webContents,permission,details});
    callback(webContents===window?.webContents&&permission==='media'&&details?.isMainFrame===true&&details?.mediaTypes?.length===1&&details.mediaTypes[0]==='audio');
  });
  window=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await window.loadFile(join(__dirname,'audio-device-enumeration.html'));
  const devices=await window.webContents.executeJavaScript(`navigator.mediaDevices.enumerateDevices().then(rows=>rows.map(row=>({kind:row.kind,deviceId:row.deviceId,label:row.label,groupId:row.groupId})))`);
  const cable=devices.find(row=>row.kind==='audioinput'&&/CABLE Output/i.test(row.label));
  const capture=cable?await window.webContents.executeJavaScript(`navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:${JSON.stringify(cable?.deviceId)}}},video:false}).then(stream=>{const tracks=stream.getTracks().map(track=>({kind:track.kind,label:track.label,readyState:track.readyState}));for(const track of stream.getTracks())track.stop();return tracks;})`):null;
  const result=JSON.stringify({url:window.webContents.getURL(),observations,devices,capture},null,2);
  writeFileSync(join(__dirname,'audio-device-enumeration-result.json'),result);
  process.stdout.write(result);
  app.exit(0);
});

import { createTranscript } from './transcript.js';
const transcript = createTranscript();
const start = document.querySelector('#start'), stop = document.querySelector('#stop');
const status = document.querySelector('#status'), log = document.querySelector('#log'), speaker = document.querySelector('#speaker');
let socket, peer, stream, generation = 0, stopping = false;
const render = () => { log.textContent = transcript.text(); log.scrollTop = log.scrollHeight; };
const write = text => { transcript.activity(text); render(); };
function releaseMedia(closePeer = true) {
  stream?.getTracks().forEach(track => track.stop()); stream = undefined;
  if (closePeer) { peer?.close(); peer = undefined; }
  speaker.srcObject = null;
}
function release() {
  generation++; releaseMedia(); stopping = false;
  socket?.close(); socket = undefined; start.disabled = false; stop.disabled = true;
}
stop.onclick = () => {
  stopping = true; releaseMedia(false); stop.disabled = true; status.textContent = 'Stopping…';
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'disconnect' }));
  else { release(); status.textContent = 'Stopped before connecting'; }
};
start.onclick = async () => {
  transcript.reset();
  start.disabled = true; stop.disabled = false; status.textContent = 'Connecting…'; const attempt = ++generation;
  try {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    if (attempt !== generation) { mic.getTracks().forEach(track => track.stop()); return; }
    stream = mic; write('✓ Microphone active');
    const rtc = new RTCPeerConnection(); peer = rtc;
    for (const track of mic.getTracks()) rtc.addTrack(track, mic);
    rtc.ontrack = event => { speaker.srcObject = event.streams[0] ?? new MediaStream([event.track]); speaker.play().catch(() => write('Press play in the audio controls to hear Copilot.')); };
    const events = rtc.createDataChannel('oai-events');
    events.onmessage = ({ data }) => {
      const event = JSON.parse(data);
      if (event.type === 'session.started' && !stopping) status.textContent = 'Listening';
    };
    rtc.onconnectionstatechange = () => {
      if (rtc.connectionState === 'connected' && !stopping) status.textContent = 'Listening';
      if (['failed', 'disconnected'].includes(rtc.connectionState)) { write('✗ Audio connection lost. Start again to reconnect.'); release(); status.textContent = 'Disconnected'; }
    };
    const ws = new WebSocket(location.origin.replace('http:', 'ws:') + '/copilot'); socket = ws;
    ws.onmessage = async ({ data }) => {
      if (attempt !== generation) return;
      const event = JSON.parse(data);
      if (event.type === 'log') write(event.message);
      if (event.type === 'transcript') { transcript.append(event); render(); }
      if (event.type === 'answer' && !stopping) {
        try { await rtc.setRemoteDescription({ type: 'answer', sdp: event.sdp }); }
        catch (error) { write(`✗ ${error.message}`); release(); status.textContent = 'Connection failed'; }
      }
      if (event.type === 'error') { write(`✗ ${event.message}`); release(); status.textContent = 'Could not connect'; }
      if (event.type === 'stopped') { release(); status.textContent = event.confirmed ? 'Stopped' : 'Audio stopped; final voice usage unconfirmed'; }
    };
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(Error('Local copilot server unavailable')); });
    ws.onclose = () => { if (attempt === generation) { write('Local server disconnected.'); release(); status.textContent = 'Disconnected'; } };
    await rtc.setLocalDescription(await rtc.createOffer());
    await new Promise((resolve, reject) => {
      if (rtc.iceGatheringState === 'complete') return resolve();
      const timer = setTimeout(() => reject(Error('Audio connection setup timed out')), 10000);
      rtc.onicegatheringstatechange = () => { if (rtc.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); } };
    });
    if (attempt !== generation || stopping) return;
    ws.send(JSON.stringify({ type: 'connect', sdp: rtc.localDescription.sdp }));
  } catch (error) {
    if (attempt !== generation) return;
    write(`✗ ${error.message}. Check browser microphone permission.`); release(); status.textContent = 'Could not connect';
  }
};
window.addEventListener('pagehide', release);

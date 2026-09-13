import {handleImagePreview} from './admission-worker-handler.mjs';
onmessage=event=>{
  const result=handleImagePreview(event.data);
  postMessage(result,result.ok?[result.pixels.data.buffer]:[]);
};

import {normalizeComponentMetadata} from './components.mjs';
// Narrow executable profile; other metadata remains valid catalog data.
export function validateSingleImageProfile(input){
 const metadata=normalizeComponentMetadata(input),outputs=Object.keys(metadata.outputs),type=metadata.outputs.image?.type;
 if(Object.keys(metadata.inputs).length!==0||outputs.length!==1||outputs[0]!=='image'||type?.kind!=='image'||type.colorSpace!=='linear-srgb'||type.alphaMode!=='premultiplied')throw Error('single-image-source-v1 requires no inputs and exactly one linear-premultiplied image output');
 return metadata;
}

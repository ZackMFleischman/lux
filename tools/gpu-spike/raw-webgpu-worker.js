self.onmessage=async({data:{canvas}})=>{try{
 const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('no WebGPU adapter');
 const device=await adapter.requestDevice();const context=canvas.getContext('webgpu');const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'premultiplied'});
 self.postMessage({kind:'webgpu',adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description},format});
 const uniforms=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 const module=device.createShaderModule({code:`struct U { frame:u32, intensity:f32, time:f32, pad:f32 }; @group(0) @binding(0) var<uniform> u:U;
 @vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f { var p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(p[i],0,1); }
 @fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f { let uv=p.xy/vec2f(1920,1080); var c=vec3f(uv,u.intensity); var a=1.0; if(uv.x<0.2&&uv.y<0.2){c=vec3f(1,0,0);} if(uv.x>0.8&&uv.y<0.2){c=vec3f(0,1,0);} if(uv.x<0.2&&uv.y>0.8){c=vec3f(0,0,1);} if(uv.x>0.8&&uv.y>0.8){c=vec3f(1,1,0);} if(uv.y>0.4&&uv.y<0.6){a=floor(uv.x*4.0)/3.0;c=vec3f(u.intensity,0.3,0.6);} if(p.y<16.0){let bit=(u.frame>>u32(p.x/64.0))&1u;c=vec3f(f32(bit));a=1.0;} return vec4f(c*a,a); }`});
 const pipeline=device.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format}]}});
 const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniforms}}]});let frame=0;
 function render(t){let bytes=new ArrayBuffer(16);new Uint32Array(bytes)[0]=++frame;new Float32Array(bytes).set([0.65,t/1000,0],1);device.queue.writeBuffer(uniforms,0,bytes);const encoder=device.createCommandEncoder();const pass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,0]}]});pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.draw(3);pass.end();device.queue.submit([encoder.finish()]);if(frame<=3)self.postMessage({kind:'submitted',frame});requestAnimationFrame(render);}requestAnimationFrame(render);
}catch(e){self.postMessage({kind:'failure',reason:String(e)});}};


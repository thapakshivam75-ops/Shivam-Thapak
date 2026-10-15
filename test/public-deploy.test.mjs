import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

test('public Render profile streams hosted chat without exposing shared private data', async t => {
  let received;
  const provider=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    received={url:req.url,authorization:req.headers.authorization,body:JSON.parse(Buffer.concat(chunks).toString())};
    if(!received.body.stream&&received.body.messages?.some(m=>Array.isArray(m.content)&&m.content.some(part=>part.text?.includes('trigger Groq error')))){res.writeHead(400,{'content-type':'application/json'});return res.end(JSON.stringify({error:{message:'Vision model rejected the image request'}}))}
    if(!received.body.stream){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({choices:[{message:{content:'{"facts":["User prefers Hindi"]}'}}]}))}
    res.writeHead(200,{'content-type':'text/event-stream'});
    res.write('data: {"choices":[{"delta":{"content":"Namaste"}}]}\n\n');
    res.end('data: {"choices":[{"delta":{"content":"!"}}]}\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
  const providerPort=provider.address().port;
  const port=34128;
  const childEnv={...process.env};delete childEnv.HOST;Object.assign(childEnv,{PORT:String(port),NODE_ENV:'production',PUBLIC_CHAT_ONLY:'true',TRUST_PROXY:'false',AI_API_FORMAT:'openai',AI_BASE_URL:`http://127.0.0.1:${providerPort}/v1`,AI_API_KEY:'test-server-only-key',AI_MODEL:'test-model',AI_VISION_MODEL:'test-vision-model',AI_MAX_OUTPUT_TOKENS:'96',ASSISTANT_PASSWORD:''});
  const child=spawn(process.execPath,['server.mjs'],{env:childEnv,stdio:'ignore'});
  t.after(async()=>{child.kill();await new Promise(resolve=>provider.close(resolve))});
  let ready=false;
  for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){ready=true;break}}catch{}await delay(100)}
  assert.equal(ready,true,'server should start');
  const status=await(await fetch(`http://127.0.0.1:${port}/api/status`)).json();
  assert.equal(status.publicMode,true);assert.equal(status.apiFormat,'openai');assert.equal(status.ai,true);assert.equal(status.host,'0.0.0.0');
  const response=await fetch(`http://127.0.0.1:${port}/api/chat/stream`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Namaste',history:[],mode:'coding',memory:['User prefers Hindi']})});
  assert.equal(response.status,200);
  const events=await response.text();
  assert.match(events,/"token":"Namaste"/);assert.match(events,/"token":"!"/);assert.match(events,/"assistant":"Namaste!"/);
  assert.equal(received.url,'/v1/chat/completions');assert.equal(received.authorization,'Bearer test-server-only-key');
  assert.equal(received.body.stream,true);assert.equal(received.body.max_completion_tokens,96);
  assert.match(received.body.messages[0].content,/Coding Partner/);assert.match(received.body.messages[0].content,/User prefers Hindi/);
  const attachment=await fetch(`http://127.0.0.1:${port}/api/chat/stream`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Summarize the attached file',attachments:[{name:'notes.txt',kind:'text',text:'Project deadline is Friday.'}]})});
  assert.equal(attachment.status,200);await attachment.text();assert.match(received.body.messages[0].content,/thorough, well-organized answer/);assert.match(received.body.messages[1].content,/Project deadline is Friday/);
  const vision=await fetch(`http://127.0.0.1:${port}/api/chat/stream`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'What is in this image?',attachments:[{name:'tiny.png',kind:'image',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l0sAAAAASUVORK5CYII='}]})});
  assert.equal(vision.status,200);await vision.text();assert.equal(received.body.model,'test-vision-model');assert.ok(received.body.messages[1].content.some(x=>x.type==='image_url'&&x.image_url.url.startsWith('data:image/png;base64,')));
  const liveVision=await fetch(`http://127.0.0.1:${port}/api/vision/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==',prompt:'Describe this camera frame',mode:'jarvis'})});
  assert.equal(liveVision.status,200);assert.ok((await liveVision.json()).assistant);assert.equal(received.body.model,'test-vision-model');assert.ok(received.body.messages[1].content.some(x=>x.type==='image_url'&&x.image_url.url.startsWith('data:image/jpeg;base64,')));assert.match(received.body.messages[0].content,/Live Vision/);
  const visionFailure=await fetch(`http://127.0.0.1:${port}/api/vision/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==',prompt:'trigger Groq error',mode:'jarvis'})});
  assert.equal(visionFailure.status,503);assert.match((await visionFailure.json()).error,/Vision model rejected the image request/);
  const refreshed=await fetch(`http://127.0.0.1:${port}/api/memory/refresh`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({conversation:[{user:'I prefer Hindi responses.',assistant:'Understood.'}],facts:[]})});
  assert.equal(refreshed.status,200);assert.deepEqual((await refreshed.json()).facts,['User prefers Hindi']);
  assert.deepEqual(await(await fetch(`http://127.0.0.1:${port}/api/data`)).json(),{chats:[],tasks:[],analyses:[]});
  const privateFeature=await fetch(`http://127.0.0.1:${port}/api/tasks`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'private'})});
  assert.equal(privateFeature.status,403);
  const longMessage=await fetch(`http://127.0.0.1:${port}/api/chat/stream`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'x'.repeat(4001)})});
  assert.equal(longMessage.status,413);
  for(let i=0;i<11;i++) await fetch(`http://127.0.0.1:${port}/api/chat/stream`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  const limited=await fetch(`http://127.0.0.1:${port}/api/chat/stream`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(limited.status,429);assert.ok(limited.headers.get('retry-after'));
});

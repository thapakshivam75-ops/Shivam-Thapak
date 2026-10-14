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
    res.writeHead(200,{'content-type':'text/event-stream'});
    res.write('data: {"choices":[{"delta":{"content":"Namaste"}}]}\n\n');
    res.end('data: {"choices":[{"delta":{"content":"!"}}]}\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
  const providerPort=provider.address().port;
  const port=34128;
  const childEnv={...process.env};delete childEnv.HOST;Object.assign(childEnv,{PORT:String(port),NODE_ENV:'production',PUBLIC_CHAT_ONLY:'true',TRUST_PROXY:'false',AI_API_FORMAT:'openai',AI_BASE_URL:`http://127.0.0.1:${providerPort}/v1`,AI_API_KEY:'test-server-only-key',AI_MODEL:'test-model',AI_MAX_OUTPUT_TOKENS:'96',ASSISTANT_PASSWORD:''});
  const child=spawn(process.execPath,['server.mjs'],{env:childEnv,stdio:'ignore'});
  t.after(async()=>{child.kill();await new Promise(resolve=>provider.close(resolve))});
  let ready=false;
  for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){ready=true;break}}catch{}await delay(100)}
  assert.equal(ready,true,'server should start');
  const status=await(await fetch(`http://127.0.0.1:${port}/api/status`)).json();
  assert.equal(status.publicMode,true);assert.equal(status.apiFormat,'openai');assert.equal(status.ai,true);assert.equal(status.host,'0.0.0.0');
  const response=await fetch(`http://127.0.0.1:${port}/api/chat/stream`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Namaste',history:[]})});
  assert.equal(response.status,200);
  const events=await response.text();
  assert.match(events,/"token":"Namaste"/);assert.match(events,/"token":"!"/);assert.match(events,/"assistant":"Namaste!"/);
  assert.equal(received.url,'/v1/chat/completions');assert.equal(received.authorization,'Bearer test-server-only-key');
  assert.equal(received.body.stream,true);assert.equal(received.body.max_completion_tokens,96);
  assert.deepEqual(await(await fetch(`http://127.0.0.1:${port}/api/data`)).json(),{chats:[],tasks:[],analyses:[]});
  const privateFeature=await fetch(`http://127.0.0.1:${port}/api/tasks`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'private'})});
  assert.equal(privateFeature.status,403);
  const longMessage=await fetch(`http://127.0.0.1:${port}/api/chat/stream`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'x'.repeat(4001)})});
  assert.equal(longMessage.status,413);
  for(let i=0;i<11;i++) await fetch(`http://127.0.0.1:${port}/api/chat/stream`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  const limited=await fetch(`http://127.0.0.1:${port}/api/chat/stream`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(limited.status,429);assert.ok(limited.headers.get('retry-after'));
});

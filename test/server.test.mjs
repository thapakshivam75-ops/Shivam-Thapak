import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

test('server UI, Ollama-aware status, and chat route behave honestly', async t => {
  const port = 34127;
  const child = spawn(process.execPath, ['server.mjs'], { env:{...process.env,PORT:String(port),HOST:'127.0.0.1',AI_API_KEY:'',AI_MODEL:'',ASSISTANT_PASSWORD:''}, stdio:'ignore' });
  t.after(()=>child.kill());
  let response;
  for(let i=0;i<30;i++){try{response=await fetch(`http://127.0.0.1:${port}/api/health`);break}catch{await delay(100)}}
  assert.ok(response, 'server should start'); assert.equal(response.status,200);
  const status=await (await fetch(`http://127.0.0.1:${port}/api/status`)).json();
  assert.equal(typeof status.ai,'boolean'); assert.equal(status.email,false);
  const page=await(await fetch(`http://127.0.0.1:${port}/`)).text(); assert.match(page,/Manas/); assert.match(page,/id=\"app\" class=\"console-app\"/); assert.match(page,/utility-hud/); assert.match(page,/Jarvis Core/); assert.doesNotMatch(page,/authGate|type=\"module\"/);
  const ai=await fetch(`http://127.0.0.1:${port}/api/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'hello'})});
  if(status.ai){
    assert.equal(ai.status,200);
    const reply=await ai.json(); assert.ok(reply.assistant?.trim(),'configured AI should return a real answer');
  } else assert.equal(ai.status,503);
});

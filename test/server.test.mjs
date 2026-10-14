import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

test('server UI, Ollama-aware status, and chat route behave honestly', async t => {
  const port = 34127;
  const child = spawn(process.execPath, ['server.mjs'], { env:{...process.env,PORT:String(port),HOST:'127.0.0.1',AI_API_KEY:'',AI_MODEL:'',ASSISTANT_PASSWORD:'',FIREBASE_AUTH_REQUIRED:'false'}, stdio:'ignore' });
  t.after(()=>child.kill());
  let response;
  for(let i=0;i<30;i++){try{response=await fetch(`http://127.0.0.1:${port}/api/health`);break}catch{await delay(100)}}
  assert.ok(response, 'server should start'); assert.equal(response.status,200);
  const status=await (await fetch(`http://127.0.0.1:${port}/api/status`)).json();
  assert.equal(typeof status.ai,'boolean'); assert.equal(status.email,false);
  assert.match(await (await fetch(`http://127.0.0.1:${port}/`)).text(),/Manas/);
  const ai=await fetch(`http://127.0.0.1:${port}/api/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'hello'})});
  if(status.ai){
    assert.equal(ai.status,200);
    const reply=await ai.json(); assert.ok(reply.assistant?.trim(),'configured AI should return a real answer');
  } else assert.equal(ai.status,503);
});

test('Firebase-required mode fails closed when the Admin verifier is missing', async t => {
  const port=34126;const childEnv={...process.env,PORT:String(port),HOST:'127.0.0.1',FIREBASE_AUTH_REQUIRED:'true',FIREBASE_PROJECT_ID:'',FIREBASE_CLIENT_EMAIL:'',FIREBASE_PRIVATE_KEY:'',ASSISTANT_PASSWORD:''};
  const child=spawn(process.execPath,['server.mjs'],{env:childEnv,stdio:'ignore'});t.after(()=>child.kill());
  let response;for(let i=0;i<30;i++){try{response=await fetch(`http://127.0.0.1:${port}/api/health`);break}catch{await delay(100)}}
  assert.ok(response,'server should start');assert.equal(response.status,200);
  const page=await(await fetch(`http://127.0.0.1:${port}/`)).text();assert.match(page,/id="authGate"/);assert.match(page,/id="app" hidden inert/);assert.match(page,/type="module" src="\/app.js"/);
  const client=await(await fetch(`http://127.0.0.1:${port}/app.js`)).text();for(const method of ['signInWithEmailAndPassword','createUserWithEmailAndPassword','signInWithPhoneNumber','GoogleAuthProvider','FacebookAuthProvider','OAuthProvider','onAuthStateChanged'])assert.ok(client.includes(method),`client includes ${method}`);
  const status=await(await fetch(`http://127.0.0.1:${port}/api/status`)).json();assert.equal(status.firebaseAuthRequired,true);assert.equal(status.firebaseAdminReady,false);
  const protectedData=await fetch(`http://127.0.0.1:${port}/api/data`);assert.equal(protectedData.status,503);
});

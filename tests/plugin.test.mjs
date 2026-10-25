import {test} from "node:test";
import assert from "node:assert/strict";
import {activate} from "../dap_letsur/plugin.mjs";

function harness({apiVersion=2, enabled=false}={}) {
  const values={enabled}, actions=new Map(), listeners=new Set(), messages=[];
  let active=null, receive, closed=false, disposed=0, fail=false;
  const emit=()=>{for(const fn of listeners)fn();};
  const registration={id:"test.letsur",async apply(options){assert.deepEqual(options,{usePersona:false});if(fail)throw Error("apply rejected");active=this.id;emit();},async reset(){if(active===this.id){active=null;emit();}},async dispose(){disposed++;await this.reset();}};
  const api={apiVersion,getActiveSkin:()=>active,async registerSkin(skin){assert.equal(skin.id,"letsur");return registration;},onDidChange(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
  const ctx={pluginId:"test",actions:{registerAction({id,callback}){actions.set(id,callback);}},trayMenu:{addItem(){}},radialMenu:{addItem(){}},host:{petSkins:api,settings:{values:()=>({...values}),async set(_section,key,value){values[key]=value;}},windows:{openPalette(){closed=false;return{show(){},toggle(){},isDestroyed:()=>closed,close(){closed=true;},postMessage(message){messages.push(message);},onMessage(fn){receive=fn;return()=>{receive=null;};}};}}}};
  return {ctx,values,messages,actions,listeners,get active(){return active;},get closed(){return closed;},get disposed(){return disposed;},set fail(v){fail=v;},send(message){return receive(message);},otherSkin(){active="another.pet";emit();}};
}

test("apply, saved restore, reset, competing skin, errors and unloading",async()=>{
  const h=harness();let stop=await activate(h.ctx);
  h.actions.get("open")();await h.send({type:"ready"});assert.equal(h.messages.at(-1).active,false);
  await h.send({type:"untrusted",id:"../another"});assert.equal(h.active,null);
  await h.send({type:"apply"});assert.equal(h.active,"test.letsur");assert.equal(h.values.enabled,true);
  await stop();assert.equal(h.closed,true);assert.equal(h.listeners.size,0);assert.equal(h.active,null);
  stop=await activate(h.ctx);assert.equal(h.active,"test.letsur","restores the saved skin");
  h.actions.get("open")();await h.send({type:"reset"});assert.equal(h.active,null);assert.equal(h.values.enabled,false);
  h.fail=true;const original=console.error;console.error=()=>{};
  try{await h.send({type:"apply"});}finally{console.error=original;}
  assert.equal(h.messages.at(-1).busy,false);assert.match(h.messages.at(-1).message,/못했어요/);assert.equal(h.active,null);
  h.fail=false;await h.send({type:"apply"});assert.equal(h.active,"test.letsur","recovers after a failure");
  h.otherSkin();await Promise.resolve();await Promise.resolve();assert.equal(h.values.enabled,false,"does not reclaim another skin next launch");
  await stop();assert.equal(h.active,"another.pet");assert.equal(h.disposed,2);assert.equal(h.listeners.size,0);
});

test("older DAP can open the preview without trying to register or apply",async()=>{
  const h=harness({apiVersion:1,enabled:true});const stop=await activate(h.ctx);
  h.actions.get("open")();await h.send({type:"ready"});assert.equal(h.messages.at(-1).available,false);
  await h.send({type:"apply"});assert.equal(h.active,null);await stop();assert.equal(h.disposed,0);
});

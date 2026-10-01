import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractBook } from '../src/contracts.ts';
import { CONTRACTS, contractById } from '../src/contract-content.ts';
import { Game, type Echo } from '../src/engine.ts';
import { LEVELS, MAX_FRAMES } from '../src/levels.ts';

test('historical eligibility gates contracts; offers and active arrangements survive refresh independently',()=>{
  let unlocked=false;
  const book=new ContractBook(undefined,()=>unlocked);
  assert.equal(book.accept('station-platform'),false); assert.equal(book.refresh(),false);
  unlocked=true;
  assert.equal(book.offers.length,3); assert.equal(new Set(book.offers.map(c=>c.family)).size,3);
  assert.equal(book.accept('station-platform'),true);
  const first=book.export(); assert.equal(book.refresh(),true);
  assert.notDeepEqual(book.offers.map(c=>c.id),new ContractBook(first,()=>true).offers.map(c=>c.id));
  assert.equal(book.active?.id,'station-platform','free refresh must not reroll the accepted layout');
  const restored=new ContractBook(book.export(),()=>true);
  assert.deepEqual(restored.export(),book.export()); assert.equal(restored.inContracts,true);
  assert.equal(restored.accept('power-return'),false,'a different arrangement must be offered before accepting');
  assert.equal(restored.accept('station-platform'),true,'the active arrangement remains resumable');
  restored.leave(); assert.equal(restored.inContracts,false); assert.equal(restored.active?.id,'station-platform');
  assert.equal(new ContractBook(book.export(),()=>false).inContracts,false,'a contract save alone grants no main-story completion');
});

test('a lower echo budget governs manual recording, automatic loops, plan restoration, previews and rerecording',()=>{
  const game=new Game({...LEVELS[0],echoLimit:1});
  const idle={x:0,y:0,lure:false}; game.start(); game.step(idle); game.step(idle);
  assert.equal(game.rewind(),true); game.step(idle); game.step(idle);
  assert.equal(game.rewind(),false); assert.equal(game.echoes.length,1);
  const snapshot=structuredClone(game.localPlan);
  assert.equal(game.beginRerecord(0),true); game.start(); game.step({x:1,y:0,lure:false}); game.step(idle);
  assert.equal(game.rewind(),true); assert.equal(game.echoes.length,1);
  assert.equal(game.undoPlan(),true); assert.deepEqual(game.localPlan,snapshot);
  const three: Echo[]=Array.from({length:3},(_,colorIndex)=>({...snapshot[0],colorIndex}));
  game.restorePlan(three); assert.equal(game.echoes.length,1);
  const preview=game.previewAt(MAX_FRAMES); assert.equal(preview.echoLimit,1); assert.equal(preview.spectator,true); assert.equal(preview.echoes.length,1);
  game.start(); for(let i=0;i<MAX_FRAMES;i++) game.step(idle);
  assert.equal(game.status,'caught'); assert.equal(game.echoes.length,1,'a full budget must not silently append a second echo');
  const fresh=new Game({...LEVELS[0],echoLimit:1}); fresh.start(); for(let i=0;i<MAX_FRAMES;i++)fresh.step(idle);
  assert.equal(fresh.echoes.length,1); assert.equal(fresh.frame,0);
});

test('only successful active runs score; fastest time and fewest echoes are independent records',()=>{
  const book=new ContractBook(undefined,()=>true); assert.equal(book.accept('power-return'),true);
  const c=contractById('power-return')!;
  // This fixture isolates settlement rules; the content validator executes all real routes.
  function finish(frames:number,count:number) {
    const game=new Game(c.stage.level); game.start(); game.hasLoot=true;
    game.echoes=Array.from({length:count},(_,colorIndex)=>({colorIndex,frames:[{...game.player},{...game.player}]}));
    game.frame=frames-1; game.step({x:0,y:0,lure:false}); assert.equal(game.status,'won'); return game;
  }
  const ready=new Game(c.stage.level); assert.equal(book.commit(ready),false);
  const fast=finish(120,1); assert.equal(book.commit(fast),true); assert.equal(book.commit(fast),false);
  const lean=finish(180,0); assert.equal(book.commit(lean),true);
  assert.deepEqual(book.score(c.id),{completions:2,fastestFrames:120,fewestEchoes:0,last:{frames:180,echoes:0}});
  const preview=finish(80,0); preview.spectator=true; assert.equal(book.commit(preview),false);
  const wrong=finish(80,0); wrong.level=CONTRACTS[0].stage.level; assert.equal(book.commit(wrong),false);
  lean.restart(); assert.equal(book.commit(lean),false);
  const save=book.export(); const restored=new ContractBook(save,()=>true); assert.deepEqual(restored.export(),save);
  save.scores[c.id].fastestFrames=-1; assert.equal(new ContractBook(save,()=>true).score(c.id),undefined);
  book.leave(); assert.equal(book.commit(finish(90,0)),false);
});

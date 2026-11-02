const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const text=fs.readFileSync(path.join(__dirname,'../../web/index.html'),'utf8');
const code=text.slice(text.indexOf('  window.mpPen ='),text.indexOf('  window.mpMods ='));
const listeners={},canvas={};
const window={addEventListener:(name,handler)=>{(listeners[name]??=[]).push(handler)}};
const ctx={window,document:{getElementById:()=>canvas},Number,Object}; vm.createContext(ctx);vm.runInContext(code,ctx);
function send(kind,extra={}) { const e={target:canvas,pointerType:'mouse',buttons:1,clientX:20,clientY:30,pressure:.5,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},...extra};for(const f of listeners[kind])f(e);return e; }
send('pointerdown');assert.equal(window.mpPen.pressure,1);
send('pointerdown',{pointerType:'touch',pressure:.15});assert.equal(window.mpPen.pressure,1);
send('pointerdown',{pointerType:'pen',pressure:.25});assert.equal(window.mpPen.pressure,.25);assert(window.mpPen.penDown);
const palm=send('pointerdown',{pointerType:'touch'});assert(palm.prevented && palm.stopped);assert.equal(window.mpPen.pressure,.25);
send('pointermove',{pointerType:'pen',buttons:32,button:5,pressure:.75,getCoalescedEvents:()=>[{clientX:10,clientY:15,pressure:.4},{clientX:20,clientY:30,pressure:.75}]});
assert(window.mpPen.eraser);assert.equal(window.mpPen.points.length,2);assert.equal(window.mpPen.points[0][2],.4);
send('pointercancel',{pointerType:'pen'});assert(!window.mpPen.penDown && !window.mpPen.active);assert.equal(window.mpPen.points.length,0);
send('pointerdown',{pointerType:'pen'});for(const f of listeners.blur)f();assert(!window.mpPen.penDown);
console.log('Pen: mouse/touch neutral, variable pressure, coalesced points, eraser, palm rejection, cancellation and focus loss OK');

// cine3d: print an episode's shot start times (and hit-stop times) as JSON, no browser needed.   node tools/cuts.cjs episodes/<id>.js
// Imports the episode file as an ES module (same data qa.cjs reads from window.ep). Output: {"id","dur","cuts":[t0 of every shot],"hits":[t of every hit-stop],
//   "set","pack","places":[{t,place}]  (14/11: which set is on screen when: voice.py picks the room tone and the footstep surface from it)}
const path = require('path'), { pathToFileURL } = require('url');
(async () => {
  const f = process.argv[2]; if (!f) { console.error('usage: node tools/cuts.cjs episodes/<id>.js'); process.exit(2); }
  const ep = (await import(pathToFileURL(path.resolve(f)).href)).default;
  console.log(JSON.stringify({ id: ep.id, dur: ep.dur, cuts: ep.shots.map((s) => +s.t0.toFixed(3)), hits: (ep.hits || []).map((h) => h.t),
    set: ep.set || null, pack: ep.pack || null, places: (ep.setOpts && ep.setOpts.places || []).map((p) => ({ t: +(+p.t).toFixed(3), place: p.place })) }));
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });

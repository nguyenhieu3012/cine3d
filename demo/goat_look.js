// look test for the GOAT Beef pack: one framing of every kind, a few emotions and poses
const shots = [], add = (d, o) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1: t0 + d, ...o }); };
add(2, { cam: 'two' }); add(2, { cam: 'ms_ron' }); add(2, { cam: 'ms_leo' }); add(2, { cam: 'cu_ron' }); add(2, { cam: 'cu_leo' }); add(2, { cam: 'ecu_ron' });
add(2, { cam: 'ots_ron' }); add(2, { cam: 'ots_leo' }); add(2, { cam: 'wide' }); add(2, { cam: 'ms_ron_lo' }); add(2, { cam: 'cu_leo_hi' }); add(2, { cam: 'two_lo' });
export default {
  pack: 'goat', set: 'bar', fps: 30, dur: 24, cast: ['ron', 'leo'], shots, captions: { y: 1421, accent: '#ffe45a' },
  lines: [
    { who: 'ron', t0: 2.2, t1: 3.8, text: 'Seven Ballon d\'Ors!', emo: 'smug', pose: 'raise' },
    { who: 'leo', t0: 4.2, t1: 5.8, text: 'He lost the bet.', emo: 'sarcastic', pose: 'cross' },
    { who: 'ron', t0: 6.2, t1: 7.8, text: 'SIUUU!', emo: 'happy', pose: 'siu' },
    { who: 'leo', t0: 8.2, t1: 9.8, text: 'Sure he did.', emo: 'deadpan', pose: 'cup' },
    { who: 'ron', t0: 10.2, t1: 11.8, text: 'No way!', emo: 'shock', pose: 'head' },
    { who: 'ron', t0: 12.2, t1: 13.8, text: 'Please, mate...', emo: 'cry', pose: 'beg' },
    { who: 'leo', t0: 14.2, t1: 15.8, text: 'Not my problem.', emo: 'unimpressed', pose: 'shrug' },
    { who: 'ron', t0: 18.2, t1: 19.8, text: 'Let me check...', emo: 'think', pose: 'phone' },
    { who: 'leo', t0: 20.2, t1: 21.8, text: 'Cheers, buddy.', emo: 'laugh', pose: 'clap' },
  ],
  overlays: [{ kind: 'hook', t0: 0, t1: 2, text: ['NOW HE\'S IN RED.'] }],
};

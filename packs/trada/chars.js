// Trà đá với AI: Tèo and Bíp as real 3-D characters (lit by the scene, real shadows, heads that turn) with drawn faces.
// Local frame of a character: origin on the floor under the seat, +z = the way he faces, +x = screen-right when he faces the camera.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, smooth, fbm1, noise1, hash, canvasTex, std, mesh, ball, cyl, lathe, V } from '../../core/util.js';
import { touchArm } from '../../core/touch.js';
import { Noodle, armCtrl, facePatch, onHead, blink, idle, contactBlob, legRig, usesLegs, robotBeat, pivotRot } from '../../core/rig.js';
import { makeFollowerPhone, makeSlip, makePaperOn, makeFlood, Ribbon } from './thanks.js';
import { makeTeoP2b } from './gta_p2b_teo.js';   // GTA P2 new (20/11): opt-in castOpts teo.p2b
import { CAR_FIT, wheelPoint, carToRider, makeTeaGlass, makeTicket, makeMoneyBag, makeBelt } from './gta_cars.js';   // GTA special 19/11 (opt-in: castOpts teo.gta / bip.glass / bip.belt)

const INK = '#231a3d';

// ---------- face parameter sets (blended number by number) ----------
// eye: 1 open .. 0 shut · arc: 0 round eye .. 1 happy arc (^) · size · px, py pupil shift · brow: height · tilt: + worried (inner up), - angry (inner down)
// smile: -1 frown .. 1 smile · open: mouth open · wide: mouth width · blush · sweat · tear
export const TEO_FACE = {
  neutral: { eye: 1, arc: 0, size: 1, brow: 0, tilt: 0, smile: 0.45, open: 0, wide: 1, blush: 0.7, sweat: 0, tear: 0 },
  happy: { eye: 1, arc: 1, size: 1, brow: 0.35, tilt: 0, smile: 1, open: 0.25, wide: 1.25, blush: 0.9, sweat: 0, tear: 0 },
  smug: { eye: 0.55, arc: 0, size: 1, brow: 0.2, tilt: -0.35, smile: 0.8, open: 0, wide: 1.1, blush: 0.6, sweat: 0, tear: 0, skew: 1 },
  shock: { eye: 1, arc: 0, size: 1.45, brow: 0.9, tilt: 0.3, smile: -0.1, open: 0.85, wide: 0.75, blush: 0.2, sweat: 0.6, tear: 0 },
  worry: { eye: 1, arc: 0, size: 1.1, brow: 0.5, tilt: 0.9, smile: -0.55, open: 0.1, wide: 0.9, blush: 0.3, sweat: 1, tear: 0 },
  sad: { eye: 0.7, arc: 0, size: 1, brow: 0.2, tilt: 1, smile: -0.9, open: 0, wide: 0.85, blush: 0.25, sweat: 0, tear: 0.5 },
  cry: { eye: 0.25, arc: 0, size: 1, brow: 0.3, tilt: 1, smile: -1, open: 0.5, wide: 1.1, blush: 0.6, sweat: 0, tear: 1 },
  angry: { eye: 0.75, arc: 0, size: 1, brow: -0.25, tilt: -1, smile: -0.6, open: 0.15, wide: 1, blush: 0.75, sweat: 0, tear: 0 },
  think: { eye: 0.8, arc: 0, size: 1, brow: 0.45, tilt: -0.3, smile: -0.1, open: 0, wide: 0.7, blush: 0.4, sweat: 0, tear: 0, px: 0.6, py: -0.6, skew: 1 },
  deadpan: { eye: 0.38, arc: 0, size: 1, brow: -0.1, tilt: 0, smile: -0.05, open: 0, wide: 0.8, blush: 0.3, sweat: 0, tear: 0 },
  sleepy: { eye: 0.2, arc: 0, size: 1, brow: 0, tilt: 0.4, smile: 0, open: 0.1, wide: 0.8, blush: 0.4, sweat: 0, tear: 0 },
  zen: { eye: 0, arc: 0, size: 1, brow: 0.15, tilt: 0, smile: 0.3, open: 0, wide: 0.75, blush: 0.5, sweat: 0, tear: 0 },                       // meditating: eyes shut, a calm small smile
  power: { eye: 1, arc: 0, size: 1.14, brow: 0.3, tilt: -0.45, smile: 0.55, open: 0, wide: 1.05, blush: 0.35, sweat: 0, tear: 0, glow: 1 },   // the eyes light up gold
  squeeze: { eye: 0, arc: 0, size: 1, brow: -0.2, tilt: 0.9, smile: -0.7, open: 0, wide: 0.9, blush: 0.9, sweat: 1, tear: 0 },                // eyes screwed shut, wishing to vanish
  // thank-you special (13/11): moved to tears. Big wet eyes (extra glints, a bright water line along the lower lids, a bead welling at each inner corner), brows pushed up and together, a soft closed smile, rosy cheeks
  moved: { eye: 1, arc: 0, size: 1.22, brow: 0.5, tilt: 0.8, smile: 0.7, open: 0, wide: 0.95, blush: 0.95, sweat: 0, tear: 0, wet: 1 },
  // Zombie special, fear (13/11): pin = white eyes with tiny pupils, quiver = trembling mouth. Never half-lidded when afraid.
  terror: { eye: 1, arc: 0, size: 1.35, brow: 1, tilt: 1, smile: -0.6, open: 0.55, wide: 0.75, blush: 0.1, sweat: 1, tear: 0, pin: 1, quiver: 1, gape: 1 },
  dread: { eye: 1, arc: 0, size: 1.25, brow: 0.75, tilt: 0.9, smile: -0.45, open: 0, wide: 0.55, blush: 0.1, sweat: 1, tear: 0, pin: 1, quiver: 0.4 },
  scream: { eye: 1, arc: 0, size: 1.45, brow: 1.1, tilt: 0.8, smile: -0.8, open: 1, wide: 1.05, blush: 0.2, sweat: 1, tear: 0, pin: 1, quiver: 0.6, gape: 1 },
};
// Bíp: eyes are light bars on a dark visor. h: bar height (1 = normal) · arc: 1 = happy arcs · tilt: + sad, - angry · w: width · round: 1 = round surprised eyes
export const BIP_FACE = {
  neutral: { h: 1, arc: 0, tilt: 0, w: 1, round: 0, smile: 0, open: 0, blush: 0.6, heart: 0 },                              // flat bars, flat mouth: he is judging you
  judge: { h: 0.62, arc: 0, tilt: -0.22, w: 1, round: 0, smile: -0.12, open: 0, blush: 0.5, heart: 0 },                      // narrowed, a touch of frown
  smug: { h: 0.6, arc: 0, tilt: -0.3, w: 1, round: 0, smile: 0.5, open: 0, blush: 0.7, heart: 0, skew: 1, px: 0.5 },         // sly: one eye smaller, side glance, crooked smile
  side: { h: 0.8, arc: 0, tilt: 0, w: 1, round: 0, smile: 0, open: 0, blush: 0.5, heart: 0, px: 1 },                          // the side-eye
  deadpan: { h: 0.42, arc: 0, tilt: 0, w: 1.04, round: 0, smile: 0, open: 0, blush: 0.4, heart: 0 },
  happy: { h: 1, arc: 1, tilt: 0, w: 1, round: 0, smile: 1, open: 0.2, blush: 1, heart: 0 },
  shock: { h: 1, arc: 0, tilt: 0, w: 0.8, round: 1, smile: 0, open: 0.8, blush: 0.2, heart: 0 },
  worry: { h: 1.15, arc: 0, tilt: 0.8, w: 0.9, round: 0.3, smile: -0.5, open: 0.1, blush: 0.3, heart: 0 },
  sad: { h: 0.8, arc: 0, tilt: 1, w: 1, round: 0, smile: -0.9, open: 0, blush: 0.3, heart: 0 },
  angry: { h: 0.75, arc: 0, tilt: -1, w: 1, round: 0, smile: -0.6, open: 0.1, blush: 0.8, heart: 0 },
  think: { h: 0.7, arc: 0, tilt: -0.2, w: 0.9, round: 0, smile: 0, open: 0, blush: 0.5, heart: 0, px: 0.7, py: -0.5 },
  love: { h: 1, arc: 0, tilt: 0, w: 1, round: 0, smile: 1, open: 0.2, blush: 1, heart: 1 },
  scan: { h: 0.4, arc: 0, tilt: 0, w: 1.3, round: 0, smile: 0, open: 0, blush: 0.2, heart: 0, scan: 1 },
  wavy: { h: 0.7, arc: 0, tilt: 0, w: 1, round: 0, smile: 0.15, open: 0, blush: 1, heart: 0, wave: 1 },          // Zombie special: kissed on the cheek, the eye bars go wavy (never a red face)
};

// ---------- arm poses: hand targets [x, y, z] in the character's frame; l = screen-left hand, r = screen-right hand ----------
export const TEO_POSE = {
  rest: { l: [-0.13, 0.41, 0.21], r: [0.13, 0.41, 0.21] },
  table: { l: [-0.13, 0.5, 0.3], r: [0.13, 0.5, 0.3] },
  point: { l: [-0.13, 0.41, 0.21], r: [0.34, 0.74, 0.3] },
  pointL: { l: [-0.34, 0.74, 0.3], r: [0.13, 0.41, 0.21] },
  me: { l: [-0.13, 0.41, 0.21], r: [0.04, 0.62, 0.17] },
  raise: { l: [-0.13, 0.41, 0.21], r: [0.27, 1.06, 0.1] },
  cheer: { l: [-0.3, 1.1, 0.08], r: [0.3, 1.1, 0.08] },
  facepalm: { l: [-0.07, 0.97, 0.19], r: [0.07, 0.97, 0.19] },
  chin: { l: [-0.02, 0.5, 0.2], r: [0.05, 0.8, 0.17] },
  shrug: { l: [-0.32, 0.68, 0.14], r: [0.32, 0.68, 0.14], shrug: 1 },
  cross: { l: [0.09, 0.56, 0.17], r: [-0.09, 0.59, 0.19] },
  hug: { l: [0.12, 0.68, 0.15], r: [-0.12, 0.7, 0.16] },                           // arms crossed high over the chest, hiding it (Ngày 13)
  phone: { l: [-0.13, 0.41, 0.21], r: [0.13, 0.6, 0.3], phone: 1 },
  cup: { l: [-0.13, 0.41, 0.21], r: [0.07, 0.82, 0.2], cup: 1 },
  head: { l: [-0.19, 1.02, 0.02], r: [0.19, 1.02, 0.02] },
  beg: { l: [-0.05, 0.72, 0.22], r: [0.05, 0.72, 0.22] },
  zen: { l: [-0.21, 0.43, 0.29], r: [0.21, 0.43, 0.29] },                         // hands open on the knees
  give: { l: [-0.13, 0.41, 0.21], r: [0.3, 0.6, 0.42] },                           // palm out: hand it over
  push: { l: [-0.13, 0.41, 0.21], r: [0.3, 0.54, 0.44] },                          // pushes a glass away across the table
  pushA: { l: [-0.13, 0.41, 0.21], r: [-0.03, 0.535, 0.51] },                      // hand behind his glass ...
  pushB: { l: [-0.13, 0.41, 0.21], r: [0.35, 0.535, 0.46] },                       // ... and it has been pushed over to the other side
  grip: { l: [-0.1, 0.5, 0.24], r: [0.14, 0.5, 0.26] },                           // both hands clamp the near edge of the table
  cover: { l: [-0.13, 0.41, 0.21], r: [0.12, 0.525, 0.35] },                       // right hand flat on the phone lying on the table
  // Zombie special (13/11): standing / moving poses (also fine seated)
  pinch: { l: [-0.13, 0.41, 0.21], r: [0.135, 0.885, 0.115] },                     // pinches his own cheek ("Mơ à?… Á!")
  gag: { l: [-0.035, 0.865, 0.17], r: [0.045, 0.875, 0.165] },                     // both hands over his mouth
  stop: { l: [-0.13, 0.41, 0.21], r: [0.2, 0.78, 0.34] },                          // palm up, "từ từ"
  reach: { l: [-0.13, 0.41, 0.21], r: [0.16, 0.72, 0.46] },                        // holds something out at arm's length (the charger)
  sleep: { l: [-0.06, 0.545, 0.37], r: [0.14, 0.545, 0.34] },                      // forearms folded on the table (with fx slump)
  side: { l: [-0.215, 0.42, 0.04], r: [0.215, 0.42, 0.04] },                       // standing: arms down by the sides
  fists: { l: [-0.17, 0.6, 0.16], r: [0.17, 0.6, 0.16] },                          // standing: fists up by the chest (scared, ready to run)
  shoo: { l: [-0.13, 0.41, 0.21], r: [0.3, 0.64, 0.38, 1] },                       // shooing hand
  pushGlasses: { l: [-0.13, 0.41, 0.21], r: [0.012, 0.935, 0.2] },                 // a finger pushes the slipping glasses back up (with fx glasses going back to 0)
  guard: { l: [-0.13, 0.84, 0.27], r: [0.14, 0.83, 0.26] },                         // fists up under the chin (the eyes stay readable)
  // thank-you special (13/11): the follower phone (castOpts teo.counter) + the paper (castOpts teo.paper / slip)
  phoneHold: { l: [-0.13, 0.41, 0.21], r: [0.25, 0.79, 0.31], phoneC: 1 },        // holds the (big) counter phone up between the two of them, screen to the camera
  phoneNear: { l: [-0.13, 0.41, 0.21], r: [0.21, 0.77, 0.33], phoneC: 1 },         // the same, closer to his own face (a close-up: the screen light on his face)
  phoneSlap: { l: [-0.05, 0.66, 0.34], r: [0.12, 0.58, 0.3], phoneC: 1, slap: 1 },  // shakes the phone (held low, in front of his chest) and slaps its side with the other hand ("máy hỏng rồi!")
  swipeIdle: { l: [-0.02, 0.62, 0.3], r: [0.11, 0.55, 0.3], phoneC: 1 },          // the phone held low in front of his chest (his face stays free), the other hand ready to swipe (fx swipe 0 -> 1 does the pull-down)
  scroll: { l: [0.0, 0.7, 0.36], r: [0.11, 0.55, 0.3], phoneC: 1, scroll: 1 },    // the same, scrubs the screen up and down like mad (the list of names flies past; fx names 1)
  phoneEar: { l: [-0.13, 0.41, 0.21], r: [0.2, 0.9, 0.05], phoneEar: 1 },         // the phone at his ear (a call)
  slipHold: { l: [-0.13, 0.41, 0.21], r: [0.16, 0.8, 0.37], slipHold: 1 },        // reads Bíp's slip (castOpts teo.slip: the same lines as Bíp's)
  brush: { l: [-0.13, 0.41, 0.21], r: [0.12, 1.04, 0.1, 1] },
  // GTA special (19/11), all need castOpts teo.gta: true; the standing ones also stand: 1
  flail: { l: [-0.3, 1.0, 0.1], r: [0.3, 1.0, 0.1], flail: 1 },                      // falling through the sky: arms windmill, legs kick (slow waves), hair and hem fly up
  hips: { l: [-0.235, 0.44, -0.01], r: [0.235, 0.44, -0.01], hips: 1 },                 // both fists on the hips, chest out ("Cướp đây!"), not a threat: no weapon
  ticket: { l: [-0.068, 0.52, 0.29], r: [0.068, 0.52, 0.29], ticket: 1 },            // seated, both hands on the sides of the ticket 112 (nervous leg bounce)
  sign: { l: [-0.15, 0.95, 0.42], r: [0.12, 0.95, 0.42], sign: 1 },                  // bent over a counter, writing
  bag: { l: [-0.15, 0.52, 0.255], r: [0.15, 0.52, 0.255], bag: 1 },                  // the money bag hugged to the chest (works while running)
  drive: { l: [-0.13, 0.55, 0.36], r: [0.13, 0.55, 0.36], drive: 1 },                // seated in the car, both hands on the wheel (turns with fx steer)
  gloat: { l: [-0.13, 0.55, 0.36], r: [0.13, 0.55, 0.36], drive: 1, gloat: 1 },      // one hand on the wheel top, the other arm over the seat back, chin up                      // brushes his hair and face with one hand (with fx paperBrush 0 -> 1 the paper flies off)
  // GTA shop (20/11), needs castOpts teo.gta: true + stand: 1: stands at a counter, leans a little, the right hand taps a keypad at castOpts teo.keypadAt (root frame, default [0.12, 1.16, 0.34]: the resting fingertips sit 1.3 cm in front of a keypad that is 0.42 m from him; each tap presses 3 cm in); about 2.6 taps a second while the pose is on
  keypad: { l: [-0.15, 0.95, 0.42], r: [0.12, 0.95, 0.42], keypad: 1 },
};
export const BIP_POSE = {
  rest: { l: [-0.19, 0.4, 0.1], r: [0.19, 0.4, 0.1] },
  table: { l: [-0.15, 0.5, 0.26], r: [0.15, 0.5, 0.26] },
  point: { l: [-0.19, 0.4, 0.1], r: [0.33, 0.66, 0.26] },
  pointL: { l: [-0.33, 0.66, 0.26], r: [0.19, 0.4, 0.1] },
  me: { l: [-0.19, 0.4, 0.1], r: [0.06, 0.5, 0.2] },
  raise: { l: [-0.19, 0.4, 0.1], r: [0.28, 0.96, 0.08] },
  cheer: { l: [-0.3, 0.98, 0.06], r: [0.3, 0.98, 0.06] },
  facepalm: { l: [-0.19, 0.4, 0.1], r: [0.06, 0.88, 0.22] },
  chin: { l: [-0.19, 0.4, 0.1], r: [0.07, 0.68, 0.2] },
  shrug: { l: [-0.31, 0.6, 0.1], r: [0.31, 0.6, 0.1] },
  hug: { l: [0.13, 0.6, 0.16], r: [-0.13, 0.61, 0.17] },                         // arms crossed high over the chest, hugging himself; the plate and the spark stay visible below (Ngày 13)
  cross: { l: [0.07, 0.48, 0.19], r: [-0.07, 0.5, 0.2] },
  phone: { l: [-0.19, 0.4, 0.1], r: [0.12, 0.62, 0.26], phone: 1 },
  cup: { l: [-0.19, 0.4, 0.1], r: [0.09, 0.66, 0.22], cup: 1 },
  head: { l: [-0.24, 0.92, 0.02], r: [0.24, 0.92, 0.02] },
  beg: { l: [-0.06, 0.58, 0.22], r: [0.06, 0.58, 0.22] },
  // Zombie special (13/11)
  side: { l: [-0.23, 0.36, 0.05], r: [0.23, 0.36, 0.05] },                         // standing, arms down
  poke: { l: [-0.19, 0.4, 0.1], r: [0.1, 0.6, 0.42], finger: 1 },                  // pushes something away with one finger
  shoo: { l: [-0.19, 0.4, 0.1], r: [0.34, 0.5, 0.3, 1] },                          // lying on his side: one hand flaps "go, go" (the 4th number = wave)
  waveUp: { l: [-0.19, 0.4, 0.1], r: [0.12, 1.12, 0.12, 1] },                       // one hand high, waving (from under the pile)
  clasp: { l: [-0.035, 0.56, 0.24], r: [0.035, 0.56, 0.24] },                       // hands together at the chest
  finger: { l: [-0.19, 0.4, 0.1], r: [0.2, 0.86, 0.16], finger: 1 },               // raises one finger (listing)
  tap: { l: [-0.19, 0.4, 0.1], r: [0.03, 0.57, 0.27], tap: 1 },                    // taps her own chest plate
  block: { l: [-0.4, 0.62, 0.12], r: [0.4, 0.62, 0.12] },                          // arms out: nobody passes
  hugB: { l: [-0.08, 0.6, 0.4], r: [0.24, 0.62, 0.36] },                           // arms round someone standing at her front-right
  phoneUp: { l: [-0.19, 0.4, 0.1], r: [0.2, 0.66, 0.34], phoneUp: 1 },              // holds a phone up, screen to the camera
  plug: { l: [-0.19, 0.4, 0.1], r: [0.04, 0.5, 0.27] },                            // hand at the chest socket (fx plug draws the cable)
  hand: { l: [-0.19, 0.4, 0.1], r: [0.36, 0.42, 0.06] },                           // hand held out to the side (running hand in hand)
  handL: { l: [-0.36, 0.42, 0.06], r: [0.19, 0.4, 0.1] },                          // the same with the left hand
  // thank-you special (13/11)
  wipe: { l: [-0.085, 0.8, 0.21], r: [0.19, 0.4, 0.1], wipe: 1 },                  // wipes the tear on his visor with the screen-left hand (fx tear goes 1 -> 0 as the hand passes); wipeR below for the other eye
  wipeR: { l: [-0.19, 0.4, 0.1], r: [0.085, 0.8, 0.21], wipe: 1, wipeR: 1 },
  printing: { l: [-0.19, 0.4, 0.1], r: [0.19, 0.4, 0.1] },                          // arms down while the slip prints (the right hand takes the slip by itself with fx slip)
  rigid: { l: [-0.2, 0.4, 0.08], r: [0.2, 0.5, 0.2] },                              // GTA special: sits bolt upright, arms by his sides, the glass (castOpts bip.glass) held in the right hand
};

function phoneProp() { const g = new THREE.Group(); mesh(new RoundedBoxGeometry(0.075, 0.15, 0.009, 3, 0.008), std('#16161d', { roughness: 0.3, metalness: 0.4 }), [0, 0, 0], g); const scr = mesh(new THREE.PlaneGeometry(0.066, 0.138), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#bcd8ff', emissiveIntensity: 1.1 }), [0, 0, -0.0052], g, { cast: false, rot: [0, Math.PI, 0] }); g.userData.screen = scr; return g; }
function cupProp() { const g = new THREE.Group(); cyl(0.034, 0.027, 0.1, new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, roughness: 0.04, transmission: 0, metalness: 0.1 }), [0, 0, 0], g, { cast: false }, 20); cyl(0.03, 0.025, 0.078, std('#c8741f', { roughness: 0.15, emissive: '#6a3208', emissiveIntensity: 0.6 }), [0, -0.008, 0], g, {}, 20); return g; }

// =====================================================================================================================
// TÈO: round white head, black quiff, red round glasses, thin neck, mustard hoodie, navy trousers, white mitten hands
// =====================================================================================================================
// Tèo's trip (fx trip 0..1, Zombie motion pass): the foot catches (0-0.1), he pitches forward faster and faster (0.1-0.55), hits the ground with a small bounce,
// then slides forward a little and settles. With carry he lands on top of what he carries. Returns the rig rotation about a pivot at his toes.
export function tripXf(tr, carry = 0) {
  tr = clamp(tr); const u = clamp((tr - 0.55) / 0.45), hit = tr >= 0.55 ? 1 : 0;
  const ang = 1.42 * (0.1 * smooth(tr / 0.1) + 0.9 * Math.pow(clamp((tr - 0.1) / 0.45), 2.2)) + hit * 0.05 * Math.exp(-u * 10) * Math.sin(u * 26);
  return { ang, pivot: V(0, 0, 0.2), slide: 0.3 * (1 - Math.pow(1 - u, 3)), bounce: hit * 0.035 * Math.exp(-u * 9) * Math.abs(Math.sin(u * 22)), lift: carry * 0.24 * smooth(ang / 1.42) };
}
// Piggyback (fx piggy on Tèo, Zombie motion pass 13/11, the owner "Hay cho Tèo cõng Bíp đi"): Bíp rides on his BACK (ep.rides = { bip: 'teo' } + fx ride on Bíp).
// fx hoist 0..1 (about 1.4 s, ease 'lin'): crouched with his back to Bíp, pulls Bíp's arms over his shoulders (0-0.42), heaves up with effort (0.42-0.85), hooks his arms
// under Bíp's legs (0.85-1). Without a hoist track he simply stands with him. Shared by apply() and carryAt() so Bíp sits exactly where Tèo's back is.
export function piggyState(f) {
  const pg = clamp(f.piggy || 0), h = clamp(f.hoist ?? 1), up = smooth((h - 0.42) / 0.43);
  return { pg, h, up, crouch: pg * (1 - up), lean: pg * (0.27 + 0.08 * (1 - up) + 0.08 * Math.sin(Math.PI * clamp((h - 0.28) / 0.2)) * (1 - up)), effort: pg * Math.sin(Math.PI * clamp((h - 0.42) / 0.43)), grab: pg * smooth(h / 0.28) * (1 - smooth((h - 0.85) / 0.15)), hook: pg * smooth((h - 0.85) / 0.15) };
}
export function makeTeo({ hoodie = '#f0b12e', seed = 1, bags = 0, sight = null, stand: standDef = 0, counter = null, slip = null, paper = false, gta = false, p2b = false, counterY = 0.95, counterZ = 0.42, hood = false, keypadAt = [0.12, 1.16, 0.34] } = {}) {
  // GTA shop (20/11): hood: true = the hoodie's hood pulled up over his hair (fx hoodDrop 0..1 = it sags forward and flops); keypadAt = where the right hand taps for pose keypad (root frame)
  // thank-you special (13/11), all off by default: counter = { keys, roll, names, name, sub, size } = a big phone in his hand showing the follower counter (pose phoneHold / phoneNear / phoneSlap / swipeIdle / scroll, fx swipe, names);
  // slip = ['34.700', 'LƯỢT XEM', '2 NGÀY'] = Bíp's slip in his hand (pose slipHold); paper: true = paper on his head and shoulders (fx paper, paperFace, paperBrush)
  // stand (Zombie special): 1 = Tèo stands on his own legs (castOpts: { teo: { stand: 1 } }); fx stand 0..1 makes him get up / sit down. 0 = seated, unchanged.
  // sight: 'purple' = the Ngày 13 power (eyes, halo, rings, sparks and aura light purple instead of gold); null = the gold of Ngày 12, unchanged
  const PUR = sight === 'purple';
  const R = 0.17, root = new THREE.Group(); root.name = 'teo';
  const rig = new THREE.Group(); root.add(rig); const body = new THREE.Group(); rig.add(body);   // rig = body + standing legs: falls forward as one piece
  const skin = new THREE.MeshPhysicalMaterial({ color: '#efe9de', roughness: 0.62, sheen: 0.4, sheenColor: new THREE.Color('#ffd9c2'), sheenRoughness: 0.6 });
  const cloth = std(hoodie, { roughness: 0.92 }), cloth2 = std('#d99a1f', { roughness: 0.95 }), navy = std('#2a3a6b', { roughness: 0.9 });

  // torso: a soft bell, slightly flattened front to back
  const torso = lathe([[0.001, 0.3], [0.13, 0.3], [0.168, 0.36], [0.172, 0.46], [0.155, 0.58], [0.128, 0.68], [0.085, 0.735], [0.04, 0.752], [0.001, 0.755]], cloth, [0, 0, 0], body); torso.scale.set(1, 1, 0.82);
  // hood resting behind the neck, pouch, drawstrings, ribbed hem
  mesh(new THREE.TorusGeometry(0.075, 0.034, 14, 28), cloth2, [0, 0.725, -0.03], body, { rot: [1.25, 0, 0] });
  const hemT = mesh(new THREE.TorusGeometry(0.148, 0.02, 10, 36), cloth2, [0, 0.318, 0], body, { rot: [Math.PI / 2, 0, 0], scale: [1, 0.82, 1] });
  mesh(new RoundedBoxGeometry(0.16, 0.085, 0.03, 3, 0.014), cloth2, [0, 0.43, 0.128], body, { rot: [-0.08, 0, 0] });
  for (const s of [-1, 1]) { cyl(0.0045, 0.0045, 0.1, std('#fffdf4', { roughness: 0.6 }), [s * 0.03, 0.665, 0.108], body, { rot: [0.2, 0, s * 0.06] }, 8); ball(0.008, std('#fffdf4'), [s * 0.034, 0.612, 0.119], body, {}, 10); }
  // neck: the thin stick neck is part of who he is
  cyl(0.021, 0.024, 0.13, skin, [0, 0.79, 0], body, {}, 16);

  // legs (seated): thigh forward, shin down, sneakers
  const legs = [-1, 1].map((s) => { const n = new Noodle(0.05, navy, body, { seg: 12 }); n.set(V(s * 0.075, 0.33, 0.02), V(s * 0.1, 0.37, 0.3), V(s * 0.1, 0.08, 0.27)); const shoe = mesh(new THREE.SphereGeometry(0.058, 20, 14), std('#f4f1ea', { roughness: 0.6 }), [s * 0.1, 0.04, 0.31], body, { scale: [0.95, 0.66, 1.5] }); const toe = mesh(new THREE.SphereGeometry(0.059, 20, 14, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.4), std('#d8343c', { roughness: 0.7 }), [s * 0.1, 0.04, 0.31], body, { scale: [0.96, 0.67, 1.51] }); return { n, shoe, toe }; });
  // standing legs (Zombie special): hidden until stand / a gait / crouch / kneel is used; the seated legs above stay exactly as they were
  const LIFT = 0.36, legsS = new THREE.Group(); rig.add(legsS); legsS.visible = false;
  const legS = [-1, 1].map((s) => { const n = new Noodle(0.05, navy, legsS, { seg: 14 }); n.set(V(s * 0.075, 0.33, 0.02), V(s * 0.1, 0.37, 0.3), V(s * 0.1, 0.08, 0.27)); const sh = new THREE.Group(); legsS.add(sh);
    mesh(new THREE.SphereGeometry(0.058, 20, 14), std('#f4f1ea', { roughness: 0.6 }), [0, -0.04, 0.04], sh, { scale: [0.95, 0.66, 1.5] }); mesh(new THREE.SphereGeometry(0.059, 20, 14, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.4), std('#d8343c', { roughness: 0.7 }), [0, -0.04, 0.04], sh, { scale: [0.96, 0.67, 1.51] }); return { n, sh }; });
  const blobS = contactBlob(0.55, 0.5, legsS, [0, 0.004, 0.03], 0.5);

  // arms
  const sleeveL = new Noodle(0.04, cloth, body, { taper: 0.82 }), sleeveR = new Noodle(0.04, cloth, body, { taper: 0.82 });
  const handL = ball(0.047, skin, [0, 0, 0], body, {}, 24), handR = ball(0.047, skin, [0, 0, 0], body, {}, 24);
  const cuffL = mesh(new THREE.TorusGeometry(0.036, 0.012, 8, 20), cloth2, [0, 0, 0], body), cuffR = mesh(new THREE.TorusGeometry(0.036, 0.012, 8, 20), cloth2, [0, 0, 0], body);
  const phone = phoneProp(), cup = cupProp(); body.add(phone, cup); phone.visible = cup.visible = false;
  const fph = counter ? makeFollowerPhone(counter) : null; if (fph) { body.add(fph.group); fph.group.visible = false; }
  const slipT = slip ? makeSlip(slip, body, { w: 0.1, len: 0.25 }) : null, slipP = slipT ? slipT.ribbon : null, slipPts = Array.from({ length: 17 }, () => V());

  // head
  const head = new THREE.Group(); head.position.set(0, 0.955, 0); head.rotation.order = 'YXZ'; body.add(head);
  ball(R, skin, [0, 0, 0], head, {}, 64);
  const face = facePatch(R, { rough: 0.55 }); head.add(face.mesh);
  // hair: a cap over the crown and back + a quiff swept to screen-right
  const hairM = new THREE.MeshPhysicalMaterial({ color: '#17141f', roughness: 0.42, sheen: 1, sheenColor: new THREE.Color('#5b4f8a'), sheenRoughness: 0.4 });
  mesh(new THREE.SphereGeometry(R * 1.035, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.36), hairM, [0, 0.004, -0.012], head, { rot: [-0.34, 0, 0] });
  const quiff = new THREE.Group(); head.add(quiff);
  for (const [x, y, z, sx, sy, sz, rz] of [[-0.035, 0.168, 0.05, 0.105, 0.048, 0.08, 0.22], [0.045, 0.186, 0.062, 0.105, 0.052, 0.078, -0.12], [0.108, 0.172, 0.05, 0.072, 0.042, 0.062, -0.6], [-0.1, 0.142, 0.03, 0.062, 0.042, 0.066, 0.65], [0.0, 0.175, -0.01, 0.13, 0.05, 0.12, 0]]) mesh(new THREE.SphereGeometry(1, 24, 16), hairM, [x, y, z], quiff, { scale: [sx, sy, sz], rot: [0, 0, rz] });
  // glasses: real rims that catch the light
  const rimM = new THREE.MeshPhysicalMaterial({ color: '#e0303c', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 }), lensM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.03, depthWrite: false });
  const EY = 19.5, EP = 4; const P = new THREE.Vector3();
  for (const s of [-1, 1]) { onHead(R, s * EY, EP, 1.035, P); const rim = mesh(new THREE.TorusGeometry(0.0535, 0.0072, 14, 44), rimM, [P.x, P.y, P.z], head); rim.userData.noOutline = true; rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), P.clone().normalize()); const lens = mesh(new THREE.CircleGeometry(0.052, 32), lensM, [P.x, P.y, P.z], head, { cast: false }); lens.quaternion.copy(rim.quaternion); lens.renderOrder = 3;
    // temple: from the outer edge of the rim back along the side of the head
    const A = onHead(R, s * 38, EP, 1.045, new THREE.Vector3()), B = onHead(R, s * 88, EP + 3, 1.02, new THREE.Vector3()), mid = A.clone().add(B).multiplyScalar(0.5);
    const tm = cyl(0.0042, 0.0042, A.distanceTo(B), rimM, [mid.x, mid.y, mid.z], head, {}, 8); tm.userData.noOutline = true; tm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); }
  onHead(R, 0, EP + 1.5, 1.045, P); mesh(new THREE.TorusGeometry(0.014, 0.0055, 8, 16, Math.PI), rimM, [P.x, P.y - 0.004, P.z], head);
  const glassesG = new THREE.Group(); head.add(glassesG); for (const m of [...head.children]) if (m.isMesh && (m.material === rimM || m.material === lensM)) glassesG.add(m);   // fx glasses: they slip down the nose
  const paperOn = paper ? makePaperOn(body, head, R) : null;
  // ---- GTA shop (20/11): the hood pulled up (OFF unless castOpts teo.hood). A shell round the back, top and sides of the head with an oval opening for the face (the drawn face stays fully readable, brows to chin);
  // the hair cap and the quiff are hidden under it. A rim tube follows the opening; fx hoodDrop 0..1 lets it sag forward over the brow (the shell rotates about the nape). ----
  const hoodHair = [];   // the hair that hides under the hood (it shows once the hood has fallen back: fx hoodDrop)
  const HOOD = hood ? (() => {
    const g = new THREE.Group(); head.add(g); const Rh = R * 1.2, C0 = V(0, 0.01, -0.028), AZ = 50, EL0 = -8, ELH = 46, rad = Math.PI / 180;
    const sh = new THREE.SphereGeometry(Rh, 60, 40, 0, Math.PI * 2, 0, Math.PI * 0.8), pos = sh.attributes.position, idx = sh.index.array, keep = [];
    const inside = (x, y, z, k) => { const az = Math.atan2(x, z) / rad, el = Math.asin(y / Math.hypot(x, y, z)) / rad; return (az / (AZ * k)) ** 2 + ((el - EL0) / (ELH * k)) ** 2 < 1; };
    for (let i = 0; i < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2], x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, y = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3; if (!inside(x, y, z, 1)) keep.push(a, b, c); }
    sh.setIndex(keep); const cl = cloth.clone(); cl.side = THREE.DoubleSide;
    mesh(sh, cl, C0.toArray(), g, { cast: true, recv: true });
    const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, az = Math.sin(a) * AZ * 1.0, el = EL0 + Math.cos(a) * ELH * 1.0; pts.push(V(Math.sin(az * rad) * Math.cos(el * rad), Math.sin(el * rad), Math.cos(az * rad) * Math.cos(el * rad)).multiplyScalar(Rh * 1.005).add(C0)); }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 80, 0.0105, 8, true), cloth2, [0, 0, 0], g, { cast: false });
    for (const m of head.children) if (m.isMesh && m.material === hairM) { m.visible = false; hoodHair.push(m); } quiff.visible = false;
    return g; })() : null;

  // ---- the power (series "Tèo nhịn hạt"): eyes that light up gold, and an aura: halo, rising rings, sparks, a gold light on whoever sits near ----
  const GOLD = PUR ? new THREE.Color(0.95, 0.12, 2.2) : new THREE.Color(3.2, 2.2, 0.55), add = (o = {}) => new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...o });
  const eyeGlow = [-1, 1].map((s) => { onHead(R, s * EY, EP, 1.075, P); const m = mesh(new THREE.CircleGeometry(0.027, 28), add({ map: canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, '#fff'); g.addColorStop(0.45, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }) }), [P.x, P.y, P.z], head, { cast: false, recv: false }); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), P.clone().normalize()); m.renderOrder = 5; return m; });
  const aura = new THREE.Group(); root.add(aura); aura.visible = false;
  const haloT = canvasTex(256, 256, (c) => { const g = c.createRadialGradient(128, 140, 10, 128, 128, 126); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); });
  const halo = mesh(new THREE.PlaneGeometry(1.7, 2.1), add({ map: haloT, color: PUR ? new THREE.Color(0.32, 0.03, 0.75) : new THREE.Color(1.5, 0.95, 0.22) }), [0, 0.86, -0.24], aura, { cast: false, recv: false }); halo.renderOrder = -1;
  const rings = [0, 1, 2].map(() => mesh(new THREE.TorusGeometry(1, 0.011, 8, 72), add(), [0, 0, 0], aura, { cast: false, recv: false, rot: [Math.PI / 2, 0, 0] }));
  const NS = 54, sp = new Float32Array(NS * 3), sparks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: GOLD, size: 0.022, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false })); sparks.geometry.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sparks.frustumCulled = false; aura.add(sparks);
  const auraLight = new THREE.PointLight(PUR ? '#7a2cff' : '#ffc247', 0, 3.2, 2); auraLight.position.set(0, 0.95, 0.5); root.add(auraLight);
  // the aura stutters like a lamp on a bad wire: a smooth wander of the level, never a frame-by-frame on / off (that reads as dropped frames)
  const flk = (p, t) => ((p.flick || 0) > 0.02 ? lerp(1, clamp(0.5 + 0.62 * noise1(t * 5.5, seed + 40)), clamp(p.flick)) : 1);
  function drawAura(p, t) {
    const fl = flk(p, t), a = clamp(p.aura || 0, 0, 2) * fl, gl = clamp(Math.max(p.face.glow || 0, p.glow || 0)) * fl * clamp(p.face.eye * 1.6 - 0.2);
    for (const m of eyeGlow) m.material.opacity = gl * (PUR ? 0.16 : 0.5); aura.visible = a > 0.004; auraLight.intensity = PUR ? a * 0.14 + gl * 0.03 : a * 0.35 + gl * 0.08;
    if (!aura.visible) return;
    halo.material.opacity = a * (0.3 + 0.06 * Math.sin(t * 5.1)); halo.scale.setScalar(0.9 + 0.1 * Math.min(a, 1.5));
    rings.forEach((r, i) => { const u = (t * 0.62 + i / 3) % 1, rad = 0.27 + 0.16 * Math.sin(u * Math.PI) + 0.06 * a; r.position.y = 0.2 + u * 1.3; r.scale.set(rad, rad, 1); r.material.opacity = a * Math.sin(u * Math.PI) * 0.5; });
    for (let i = 0; i < NS; i++) { const u = (hash(i * 3.7) + t * (0.28 + 0.3 * hash(i * 1.9))) % 1, ang = hash(i * 9.1) * 6.28 + t * (0.6 + hash(i)), rr = 0.24 + 0.2 * hash(i * 5.3) + 0.05 * Math.sin(t * 3 + i); sp[i * 3] = Math.cos(ang) * rr; sp[i * 3 + 1] = 0.15 + u * 1.5; sp[i * 3 + 2] = Math.sin(ang) * rr * 0.8; } sparks.geometry.attributes.position.needsUpdate = true; sparks.material.opacity = a * 0.9;
  }

  // ---- the drawn face ----
  // xp (optional, only the faces-plus export passes it: packs/trada/faceplus.js): richer per-frame acting numbers drawn by this same code; null = the film's picture, unchanged
  let _faceKey = '';
  function drawFace(f, talk, t, glow = 0, print = 0, xp = null) {
    if (xp) f = xp.face; const sk = xp ? xp.skw : (f.skew ? 1 : 0);
    const bl = xp ? xp.blink : blink(t, seed), open = clamp(f.eye * (1 - bl)), arc = clamp(f.arc), sz = f.size || 1;
    const dynamic = !!xp || talk > 0.001 || (f.pin || 0) > 0.05 || (f.sweat || 0) > 0.05 || (f.tear || 0) > 0.05 || (f.quiver || 0) > 0.01;
    if (!dynamic) {
      const fk = `${open.toFixed(4)}|${arc.toFixed(4)}|${sz.toFixed(4)}|${(f.px || 0).toFixed(4)}|${(f.py || 0).toFixed(4)}|${(f.blush || 0).toFixed(4)}|${(f.brow || 0).toFixed(4)}|${(f.tilt || 0).toFixed(4)}|${(f.smile || 0).toFixed(4)}|${(f.open || 0).toFixed(4)}|${(f.wide || 1).toFixed(4)}|${sk}|${(f.wet || 0).toFixed(4)}|${(f.gape || 0).toFixed(4)}|${glow.toFixed(4)}|${print.toFixed(4)}`;
      if (fk === _faceKey) return;
      _faceKey = fk;
    } else _faceKey = '';
    const c = face.ctx, S = face.size, cx = S / 2, ex = EY * face.px, ey = S / 2 - EP * face.py; c.clearRect(0, 0, S, S);
    // blush
    if (f.blush > 0.01) for (const s of [-1, 1]) { const g = c.createRadialGradient(cx + s * 100, ey + 78, 2, cx + s * 100, ey + 78, 40); g.addColorStop(0, `rgba(255,112,128,${0.62 * f.blush})`); g.addColorStop(1, 'rgba(255,120,130,0)'); c.fillStyle = g; c.fillRect(cx + s * 100 - 40, ey + 40, 80, 80); }
    // eyes (inside the rims)
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of [-1, 1]) {
      const x = cx + s * ex + (f.px || 0) * 14, y = ey + (f.py || 0) * 12 + 2;
      if (arc > 0.5) { c.strokeStyle = INK; c.lineWidth = 9; c.beginPath(); c.arc(x, y + 10, 22, Math.PI * 1.13, Math.PI * 1.87); c.stroke(); }
      else if (open < 0.14) { c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.moveTo(x - 20, y + 3); c.quadraticCurveTo(x, y + 9, x + 20, y + 3); c.stroke(); }
      else if (f.pin > 0.5) { const rx = 21 * sz, ry = 25 * sz * lerp(0.35, 1, open), jx = Math.sin(t * 23 + s) * 1.6 * (f.quiver || 0); c.fillStyle = '#ffffff'; c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(x + jx + (f.px || 0) * 8, y + (f.py || 0) * 8, 8.5, 0, 7); c.fill(); }   // terror: white eyes, tiny pupils
      else { const rx = 18 * sz, ry = 24.5 * sz * lerp(0.35, 1, open); c.fillStyle = INK; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x - rx * 0.3, y - ry * 0.38, 5.6 * sz, 0, 7); c.fill(); c.beginPath(); c.arc(x + rx * 0.3, y + ry * 0.3, 2.2 * sz, 0, 7); c.fill();
        if (glow > 0.03) { c.globalAlpha = clamp(glow); c.fillStyle = PUR ? '#5b12c4' : '#ffc928'; c.beginPath(); c.ellipse(x, y, rx * 0.88, ry * 0.9, 0, 0, 7); c.fill(); c.fillStyle = PUR ? '#e2c4ff' : '#fff6c4'; c.beginPath(); c.ellipse(x, y, rx * (PUR ? 0.24 : 0.46), ry * (PUR ? 0.26 : 0.5), 0, 0, 7); c.fill(); c.globalAlpha = 1; }
        if (open < 0.8) { c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(x - rx - 5, y - ry + 1); c.lineTo(x + rx + 5, y - ry + 1 + -s * 3 * sk); c.stroke(); } }
    }
    if ((f.wet || 0) > 0.02) for (const s of [-1, 1]) { const x = cx + s * ex + (f.px || 0) * 14, y = ey + (f.py || 0) * 12 + 2, w = clamp(f.wet), ry = 24.5 * (f.size || 1) * lerp(0.35, 1, open);   // wet eyes: glints, a water line, a bead at the inner corner
      if (open > 0.3) { c.save(); c.globalAlpha = 0.85 * w; c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 7, y - ry * 0.12, 4.2, 0, 7); c.fill(); c.beginPath(); c.arc(x - 9, y + ry * 0.4, 2.6, 0, 7); c.fill(); c.globalAlpha = 0.9 * w; c.strokeStyle = '#b9e6ff'; c.lineWidth = 8; c.beginPath(); c.ellipse(x, y, 16 * (f.size || 1), ry - 2, 0, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke(); c.globalAlpha = 0.3 * w; c.fillStyle = '#7fc8ff'; c.beginPath(); c.ellipse(x, y + ry * 0.45, 15 * (f.size || 1), ry * 0.4, 0, 0, Math.PI); c.fill();
        c.globalAlpha = 0.9 * w; c.fillStyle = '#c9ecff'; c.beginPath(); c.ellipse(x - s * 13, y + ry + 5, 10, 14, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x - s * 16, y + ry + 1, 3.4, 0, 7); c.fill(); c.restore(); } }
    if (print > 0.01) { c.save(); c.globalAlpha = 0.55 * clamp(print); c.strokeStyle = '#d0505a'; c.lineWidth = 7; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(cx - 150, ey + 40 + i * 20); c.lineTo(cx - 82, ey + 26 + i * 20); c.stroke(); } c.restore(); }   // the table edge printed on his cheek (fx print)
    if (bags > 0) for (const s of [-1, 1]) { const x = cx + s * ex, y = ey + 4; const g = c.createLinearGradient(0, y + 20, 0, y + 50); g.addColorStop(0, `rgba(112,78,150,${0.5 * bags})`); g.addColorStop(1, 'rgba(112,78,150,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y + 22, 27, 26, 0, 0, Math.PI); c.fill(); }
    // brows, above the rims; tilt moves the inner end (towards the nose) up (worried) or down (angry)
    for (const s of [-1, 1]) { const x = cx + s * ex, by = ey - 88 - f.brow * 15 - (s > 0 ? 9 * sk : 0) - (xp ? xp.bro[s > 0 ? 1 : 0] * 15 : 0), inn = -f.tilt * 15; c.strokeStyle = INK; c.lineWidth = 11; c.beginPath(); c.moveTo(x - s * 30, by + inn); c.quadraticCurveTo(x, by - 7 + inn * 0.25, x + s * 32, by + 5 - inn * 0.35); c.stroke(); }
    // mouth
    const qv = f.quiver || 0, my = S / 2 + 22 * face.py, mo = clamp(Math.max(f.open, xp ? xp.mo : talk * 0.95) + qv * 0.08 * Math.sin(t * 29)), w = 30 * (f.wide || 1) * (xp ? xp.mw + qv * 0.06 * Math.sin(t * 31) : 1 + talk * 0.18 * Math.sin(t * 23) + qv * 0.06 * Math.sin(t * 31)), sm = f.smile, mx = cx + 9 * sk;
    if ((f.gape || 0) > 0.5 && mo > 0.08) { const gw = 21 * (f.wide || 1) * (1 + qv * 0.05 * Math.sin(t * 31)), gh = 30 + mo * 84;   // a scream: tall, corners dragged down, wider at the bottom, top teeth
      c.fillStyle = '#3a1630'; c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(mx - gw, my + 10); c.quadraticCurveTo(mx, my - 10, mx + gw, my + 10); c.quadraticCurveTo(mx + gw * 1.3, my + gh * 0.7, mx, my + gh); c.quadraticCurveTo(mx - gw * 1.3, my + gh * 0.7, mx - gw, my + 10); c.closePath(); c.fill(); c.stroke();
      c.save(); c.clip(); c.fillStyle = '#ff7f8f'; c.beginPath(); c.ellipse(mx, my + gh, gw * 0.7, gh * 0.3, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillRect(mx - gw, my - 8, gw * 2, 15); c.restore(); }
    else if (mo > 0.08) { const rd = xp ? xp.round : 0, h = (5 + mo * 30) * (1 + 0.3 * rd), bk = rd ? lerp(sm > 0 ? 1.2 : 0.8, 1.35, rd) : (sm > 0 ? 1.2 : 0.8); c.fillStyle = '#3a1630'; c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(mx - w, my - sm * 5); c.quadraticCurveTo(mx, my - sm * 5 - h * 0.25 * (1 + rd) + (sm < 0 ? -6 : 2), mx + w, my - sm * 5); c.quadraticCurveTo(mx + w * 0.9, my + h * bk, mx, my + h); c.quadraticCurveTo(mx - w * 0.9, my + h * bk, mx - w, my - sm * 5); c.closePath(); c.fill(); c.stroke();
      c.save(); c.clip(); c.fillStyle = '#ff7f8f'; c.beginPath(); c.ellipse(mx, my + h + 3, w * 0.62, h * 0.55, 0, 0, 7); c.fill(); if ((mo > 0.3 && sm > 0.2) || (xp && xp.teeth > 0.5 && mo > 0.12)) { c.fillStyle = '#fff'; c.fillRect(mx - w, my - sm * 5 - 6, w * 2, xp ? Math.min(11, 3 + h * 0.28) : 11); } c.restore(); }
    else { c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.moveTo(mx - w, my - sm * 9); c.quadraticCurveTo(mx, my + sm * 17, mx + w, my - sm * 9 - 7 * sk - (xp ? xp.smirk * 6 : 0)); c.stroke(); }
    // sweat, tears
    if ((f.pin || 0) > 0.05) for (const [dx, sp, ph] of [[-138, 0.9, 0.3], [150, 1.1, 0.7]]) { const k = (t * sp + ph) % 1, x = cx + dx, y = ey - 70 + k * 60; c.globalAlpha = clamp(f.pin) * (1 - k * 0.7); c.fillStyle = '#8fd2ff'; c.beginPath(); c.moveTo(x, y - 15); c.quadraticCurveTo(x + 11, y + 3, x, y + 8); c.quadraticCurveTo(x - 11, y + 3, x, y - 15); c.fill(); c.globalAlpha = 1; }
    if (f.sweat > 0.05) { const k = xp ? xp.sweatK : (t * 0.8) % 1, x = cx + 132, y = ey - 96 + k * 26; c.globalAlpha = f.sweat * (xp ? xp.sweatA : 1 - k * 0.6); c.fillStyle = '#8fd2ff'; c.beginPath(); c.moveTo(x, y - 17); c.quadraticCurveTo(x + 13, y + 3, x, y + 9); c.quadraticCurveTo(x - 13, y + 3, x, y - 17); c.fill(); c.globalAlpha = 1; }
    if (f.tear > 0.05) for (const s of [-1, 1]) { const k = (t * 0.9 + (s > 0 ? 0.4 : 0)) % 1, x = cx + s * (ex + 6), y = ey + 62 + k * 60; c.globalAlpha = f.tear * (1 - k); c.fillStyle = '#8fd2ff'; c.beginPath(); c.ellipse(x, y, 7, 11, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
    face.tex.needsUpdate = true;
  }

  const S0 = [V(-0.128, 0.675, 0.0), V(0.128, 0.675, 0.0)], H = [V(), V()], C = V();
  // GTA P2 new (20/11, gta6p2b): the pump-up body, bánh mì, barbell, key fob and belt: OFF unless castOpts teo.p2b (gta_p2b_teo.js)
  const P2B = p2b ? makeTeoP2b({ body, torso, cloth, cloth2, skin, S0, sleeves: [sleeveL, sleeveR], cuffs: [cuffL, cuffR], hands: [handL, handR], head, hug: p2b === 'hug' }) : null;
  // ---- GTA special (19/11), OFF unless castOpts teo.gta (nothing below runs otherwise): flail, hips, ticket (+ leg bounce), sign, bag, drive (+ steer), gloat, wheelDrop, slam ----
  // castOpts teo: { gta: true, counterY: 0.95, counterZ: 0.42 (where his hands rest on a counter for pose sign, root frame) }. Poses/fx are listed in ENGINE.md "Added 19/11".
  const GTA = gta, tick = GTA ? makeTicket(body, '112') : null, bagP = GTA ? makeMoneyBag(body) : null;
  const pen = GTA ? (() => { const g = new THREE.Group(); body.add(g); g.visible = false; cyl(0.011, 0.011, 0.16, std('#1a2a6b', { roughness: 0.4 }), [0, 0, 0], g, { cast: false }, 8); cyl(0.0, 0.011, 0.03, std('#f0f0f0'), [0, -0.095, 0], g, { cast: false }, 8); return g; })() : null;
  const PIVL = V(0, 0.33, 0.02), _pa = V(), _pb = V(), _m4 = new THREE.Matrix4();
  const leanAbout = (ang) => { if (Math.abs(ang) < 1e-6) return; _pa.copy(PIVL).applyEuler(body.rotation); body.rotation.x += ang; _pb.copy(PIVL).applyEuler(body.rotation); body.position.add(_pa.sub(_pb)); };
  const toBody = (v) => { rig.updateMatrix(); body.updateMatrix(); _m4.multiplyMatrices(rig.matrix, body.matrix).invert(); return v.applyMatrix4(_m4); };   // a point in the character's root frame -> body frame
  const slamEnv = (k) => { const a = smooth(k / 0.28), pun = smooth((k - 0.28) / 0.12), rec = smooth((k - 0.55) / 0.1), ret = smooth((k - 0.65) / 0.35); return { a, pun, rec, ret }; };
  function gtaPre(p, t) {
    const dr = clamp(p.drive || 0), st = p.steer ?? root.userData.carSteer ?? 0, w = clamp(p.wheelDrop || 0), gl = clamp(p.gloat || 0), hp = clamp(p.hips || 0), fl = clamp(p.flail || 0), sg = clamp(p.sign || 0), tk = clamp(p.ticket || 0), sl = clamp(p.slam || 0), kp = clamp(p.keypad || 0);
    if (kp > 0) { leanAbout(0.16 * kp); head.rotation.x += 0.1 * kp; }
    if (dr > 0) { body.rotation.z += -0.05 * st * dr; body.rotation.y += 0.07 * st * dr; }
    if (gl > 0) { leanAbout(-0.1 * gl); body.rotation.y += 0.42 * gl; head.rotation.x -= 0.22 * gl; }
    if (hp > 0) { leanAbout(-0.09 * hp); head.rotation.x -= 0.1 * hp; torso.scale.z += 0.05 * hp; }
    if (sg > 0) { leanAbout(0.55 * sg); head.rotation.x += 0.3 * sg; }
    if (sl > 0) { const E = slamEnv(sl), pk = E.pun * (1 - E.ret); leanAbout(0.16 * pk - 0.06 * E.a * (1 - E.pun)); head.rotation.x -= 0.14 * pk; body.rotation.y -= 0.12 * pk; }
    if (w > 0) { leanAbout(0.62 * w); head.rotation.x += 0.75 * w; head.rotation.z *= 1 - w; }
    // flail: tilted back, swaying on slow waves, the hem of the hoodie billows, the quiff flies
    hemT.position.y = 0.318 + 0.05 * fl * (0.6 + 0.4 * Math.sin(t * 4.1)); hemT.scale.set(1 + 0.22 * fl, 0.82 + 0.22 * fl, 1);
    if (fl > 0) { leanAbout(-0.28 * fl); body.rotation.z += 0.12 * fl * Math.sin(t * 2.3 + 1); body.rotation.y += 0.18 * fl * Math.sin(t * 1.7); head.rotation.z += 0.12 * fl * Math.sin(t * 2.9); head.rotation.x -= 0.12 * fl;
      const wd = 1.3 * fl; quiff.rotation.set(wd * 0.05 * Math.sin(t * 13.1), 0, wd * (0.07 + 0.05 * Math.sin(t * 17.3))); quiff.position.y = wd * 0.006 * Math.sin(t * 21);
      if (legsS.visible) legS.forEach((L, i) => { const s2 = i ? 1 : -1, hip = V(s2 * 0.075, 0.33 + LIFT, 0.02), th = 0.8 * Math.sin(t * 4.4 + i * Math.PI);
        const A1 = hip.clone().add(V(s2 * 0.16, -Math.cos(th), Math.sin(th) * 0.95).normalize().multiplyScalar(0.58)), C1 = hip.clone().add(V(s2 * 0.16, -Math.cos(th), Math.sin(th) * 0.95).normalize().multiplyScalar(0.3)).add(V(0, 0.03, 0.12));
        const A0 = hip.clone().add(V(s2 * 0.025, -0.61, 0.0)), C0 = hip.clone().add(V(s2 * 0.03, -0.3, 0.03)); L.n.set(hip, C0.lerp(C1, fl), A0.lerp(A1, fl)); L.sh.position.copy(A0); L.sh.rotation.set(-th * 0.5 * fl, 0, 0); }); }
    // seated legs: normally exactly the old ones; the ticket's nervous bounce (or fx legBounce 0..1) lifts a heel and a knee on a ~2.4 Hz wave
    if (!legsS.visible) { const bn = clamp(p.legBounce ?? tk); legs.forEach((L, i) => { const s2 = i ? 1 : -1, lift = bn * 0.045 * (0.5 + 0.5 * Math.sin(t * 15 + i * 1.9)) * (i ? 1 : 0.45);
      L.n.set(V(s2 * 0.075, 0.33, 0.02), V(s2 * 0.1, 0.37 + 0.8 * lift, 0.3), V(s2 * 0.1, 0.08 + 0.3 * lift, 0.27)); L.shoe.position.set(s2 * 0.1, 0.04 + 0.3 * lift, 0.31); L.toe.position.copy(L.shoe.position); }); }
  }
  // hands: runs per arm just before the arm is solved (H = this hand's target in the body frame; i 0 = screen-left, 1 = screen-right)
  function gtaArm(i, s, Hi, p, t) {
    const dr = clamp(p.drive || 0), st = p.steer ?? root.userData.carSteer ?? 0, gl = clamp(p.gloat || 0), hp = clamp(p.hips || 0), fl = clamp(p.flail || 0), sg = clamp(p.sign || 0), tk = clamp(p.ticket || 0), bg = clamp(p.bag || 0), sl = clamp(p.slam || 0);
    const kp = clamp(p.keypad || 0);
    if (kp > 0) { if (i) { const tap = Math.pow(Math.max(0, Math.sin(t * 16.4)), 6); Hi.lerp(toBody(V(keypadAt[0], keypadAt[1] - 0.012 * tap, keypadAt[2] + 0.03 * tap)), kp); } else Hi.lerp(toBody(V(-0.17, counterY, counterZ - 0.04)), kp); }
    if (hp > 0) Hi.lerp(V(s * 0.235, 0.44, -0.01), hp);
    if (fl > 0) { const ph = t * 5.2 + (i ? Math.PI : 0); Hi.lerp(V(s * 0.22 + 0.2 * Math.cos(ph), 0.85 + 0.2 * Math.sin(ph), 0.12 + 0.08 * Math.sin(ph)), fl); }
    if (tk > 0) Hi.lerp(V(s * 0.068, 0.52 + 0.004 * Math.sin(t * 1.3 + i), 0.29), tk);
    if (bg > 0) Hi.lerp(V(s * 0.15, 0.52, 0.255), bg);
    if (sg > 0) { const cx = i ? 0.12 + 0.03 * Math.sin(t * 7) : -0.15, cz = counterZ + (i ? 0.012 * Math.sin(t * 9.3 + 1) : 0); Hi.lerp(toBody(V(cx, counterY + (i ? 0.012 : 0.0), cz)), sg); }
    if (dr > 0) { let a = i ? CAR_FIT.hand.r : CAR_FIT.hand.l; if (gl > 0 && !i) a = lerp(a, 1.57, gl); Hi.lerp(toBody(wheelPoint(a, st)), dr);
      if (gl > 0 && i) Hi.lerp(toBody(carToRider(CAR_FIT.gloat, 'driver')), gl); }
    if (sl > 0 && i === 1) { const E = slamEnv(sl), P0 = Hi.clone(), Pw = toBody(V(0.13, 0.7, 0.1)), Pp = toBody(V(0.3, 0.95, 0.35)), Pr = toBody(V(0.2, 0.8, 0.2)), P = P0.clone();
      P.lerp(Pw, E.a); P.lerp(Pp, E.pun); P.lerp(Pr, E.rec * (1 - E.ret)); P.lerp(P0, E.ret); Hi.copy(P); }
  }
  const penUpd = (H1, p, t) => { const k = clamp(p.sign || 0); pen.visible = k > 0.3; if (pen.visible) { pen.position.copy(H1).add(V(0.0, 0.025, 0.035)); pen.rotation.set(0.9, 0, -0.25 + 0.1 * Math.sin(t * 9)); } };
  const propsUpd = (p, H1) => { const tkk = clamp(p.ticket || 0), bgg = clamp(p.bag || 0); tick.group.visible = tkk > 0.3; if (tick.group.visible) { tick.group.position.set(0, 0.58, 0.29); tick.group.rotation.set(-0.22, 0, 0); tick.group.scale.setScalar(smooth((tkk - 0.3) / 0.4)); }
    bagP.group.visible = bgg > 0.3; if (bagP.group.visible) { bagP.group.position.set(0, 0.52, 0.255); bagP.group.rotation.set(-0.05, 0, 0); bagP.group.scale.setScalar(smooth((bgg - 0.3) / 0.5)); } };
  const api = {
    name: 'teo', root, body, head, R, headY: 0.955, eyeUp: R * 0.07, faces: TEO_FACE, poses: TEO_POSE, color: '#ffc531',
    reach: (p) => { const k = clamp(p.stand ?? standDef); return { pivotY: 0.33 + k * LIFT, shoulderY: 0.675 + k * LIFT, sx: 0.128 }; },   // 22/11: shoulders (core/touch.js)
    // pose: { face, talk, yaw, pitch, roll, lean, twist, bob, l, r, shrug, phone, cup }
    apply(p, t) {
      const id = idle(t, seed), br = id.breathe;
      const dr = clamp(p.droop || 0), wind = clamp((p.wind || 0) + (p.aura || 0) * 0.5, 0, 1.5);
      body.rotation.set((p.lean || 0) + dr * 0.4, p.twist || 0, id.sway * 0.6); body.position.y = (p.bob || 0); body.position.z = 0; body.position.x = (p.tremble || 0) * 0.0022 * Math.sin(t * 38) * (0.55 + 0.45 * Math.sin(t * 5.1));
      // ---- Zombie special: standing, gaits, crouch, carry, fall, slump (all off by default: nothing below runs for a seated episode) ----
      const stK = clamp(p.stand ?? standDef), legsOn = stK > 1e-4 || usesLegs(p), slump = clamp(p.slump || 0), fall = clamp(p.fall || 0), carry = clamp(p.carry || 0);
      let LR = null, rbt = null; const trip = clamp(p.trip || 0), kk = clamp(p.kneesKnock || 0), rec = clamp(p.recoil || 0), shv = clamp(p.shiver || 0), pan = clamp(p.panic || 0);
      if (legsOn) {
        const PG = piggyState(p), pl = trip > 0 || kk > 0 || PG.pg > 0 ? { ...p, lunge: Math.max(p.lunge || 0, 0.8 * smooth(trip / 0.15)), crouch: Math.max(p.crouch || 0, 0.28 * kk, PG.crouch) } : p;
        LR = legRig(pl, { hx: 0.075, hipY: 0.33 + LIFT, ankle: 0.08 }); rbt = LR.rb > 0 ? robotBeat(p.gph || 0) : null; if (P2B) P2B.legs(LR, p, t);
        if (kk > 0) for (let i = 0; i < 2; i++) { const s2 = i ? 1 : -1; LR.C[i].x -= s2 * kk * (0.07 + 0.03 * Math.sin(t * 31 + i * Math.PI)); }   // knees knocking
        legsS.visible = true; for (const L of legs) L.n.mesh.visible = L.shoe.visible = L.toe.visible = false;
        const SEAT = [[V(-0.075, 0.33, 0.02), V(-0.1, 0.37, 0.3), V(-0.1, 0.08, 0.27)], [V(0.075, 0.33, 0.02), V(0.1, 0.37, 0.3), V(0.1, 0.08, 0.27)]];
        legS.forEach((L, i) => { const H = SEAT[i][0].clone().lerp(LR.H[i], stK), C = SEAT[i][1].clone().lerp(LR.C[i], stK), A = SEAT[i][2].clone().lerp(LR.A[i], stK); H.x += LR.sway * stK; const sp = clamp(p.splay || 0), s2 = i ? 1 : -1; if (sp > 0) { A.x += s2 * 0.075 * sp; C.x += s2 * 0.045 * sp; } L.n.set(H, C, A); L.sh.position.copy(A); L.sh.rotation.set(-LR.tilt[i], s2 * 0.62 * sp, 0); });   // fx splay 0..1 (GTA shop 20/11): the "chữ bát" stance, feet wide and toes out
        blobS.visible = stK > 0.5; blobS.material.opacity = 0.5 * (1 - 0.6 * clamp((LR.A[0].y + LR.A[1].y) * 3 - 0.48));
        const lift = stK * (LIFT + LR.dy), q = new THREE.Euler((p.lean || 0) + dr * 0.4 + LR.lean * stK * (1 - 0.8 * carry) + carry * -0.1 - 0.3 * rec + PG.lean, (p.twist || 0) + (rbt ? rbt.jerk * 0.05 * LR.rb : 0), id.sway * 0.6 + LR.roll), PIV = V(0, 0.33, 0);
        body.rotation.copy(q); body.position.copy(PIV).sub(PIV.clone().applyEuler(q)); body.position.y += lift + (p.bob || 0); body.position.x += LR.sway * stK + PG.effort * 0.004 * Math.sin(t * 41); body.position.z -= 0.06 * rec;
      } else if (legsS.visible) { legsS.visible = false; for (const L of legs) L.n.mesh.visible = L.shoe.visible = L.toe.visible = true; }
      if (slump > 0) { const q = new THREE.Euler(body.rotation.x + slump * 0.78, body.rotation.y, body.rotation.z), PIV = V(0, 0.3, 0.05); body.rotation.copy(q); body.position.copy(PIV).sub(PIV.clone().applyEuler(q)).add(V(0, (p.bob || 0), 0)); }
      if (trip > 0) { const X = tripXf(trip, Math.max(carry, clamp(p.piggy || 0))); pivotRot(rig, new THREE.Euler(X.ang + fall * 1.45 * (1 - trip), 0, 0), X.pivot); rig.position.z += X.slide; rig.position.y += X.bounce + X.lift; }
      else if (fall > 0 || rig.rotation.x !== 0) pivotRot(rig, new THREE.Euler(fall * 1.45, 0, 0), V(0, 0, 0.17));
      if (!legsOn && rec > 0) { body.rotation.x -= 0.3 * rec; }
      if (shv > 0) { body.position.x += shv * 0.0045 * Math.sin(t * 44) * (0.6 + 0.4 * Math.sin(t * 5.3)); body.position.y += shv * 0.002 * Math.sin(t * 37); }
      api.headY = 0.955 + (LR ? stK * (LIFT + LR.dy) : 0);
      const sq = LR ? (LR.squash || 0) * stK : 0;
      torso.scale.set(1 + br * 0.008 + 0.05 * sq, 1 + br * 0.012 - 0.07 * sq, 0.82 + br * 0.012 + 0.04 * sq);
      if (P2B) P2B.torso(p, t);
      head.position.y = 0.955 + br * 0.004 + (p.shrug || 0) * -0.012 - 0.018 * sq;
      if (HOOD) { const hd = smooth(clamp(p.hoodDrop || 0)); HOOD.position.set(0, -0.07 * hd, -0.05 * hd); HOOD.rotation.set(-0.7 * hd, 0, 0.04 * hd * Math.sin(t * 2.1)); const showHair = hd > 0.3; for (const m of hoodHair) m.visible = showHair; quiff.visible = showHair; }   // fx hoodDrop 0..1: the hood slides BACK off his head onto his shoulders (his face stays clear; his hair shows)
      glassesG.position.set(0, -0.022 * clamp(p.glasses || 0), 0.004 * clamp(p.glasses || 0)); glassesG.rotation.x = 0.08 * clamp(p.glasses || 0);
      head.rotation.set(-(p.pitch || 0) * (1 - dr) - id.headPitch - (p.talkSlow ?? p.talk ?? 0) * 0.03 + dr * 0.62, ((p.yaw || 0) + id.headYaw) * (1 - dr * 0.8), (p.roll || 0) + id.headRoll);
      if (slump > 0) { head.rotation.x = lerp(head.rotation.x, 0.42, slump); head.rotation.y *= 1 - slump; head.rotation.z = lerp(head.rotation.z, 0.55, slump); }
      if (rbt) { head.rotation.y += rbt.jerk * 0.32 * LR.rb; head.rotation.z += rbt.jerk * 0.06 * LR.rb; }
      if (LR && LR.rk > 0) head.rotation.y = lerp(head.rotation.y, id.headYaw, 0.8 * LR.rk);   // a runner faces the way he runs (panic adds the looks back below)
      if (LR && LR.amt > 0) head.rotation.x -= LR.lean * 0.6 * stK * (1 - 0.7 * carry);   // keep looking ahead while leaning into a run
      if (p.piggy > 0) { const PG2 = piggyState(p); head.rotation.x -= 0.45 * PG2.lean; head.rotation.z += PG2.effort * 0.03 * Math.sin(t * 37); }   // keeps his eyes up under the load
      if (pan > 0) { const lb = smooth(clamp(1.8 * Math.sin(t * 1.55 + seed) - 0.75)); head.rotation.y += pan * lb * 1.45 * (seed % 2 ? 1 : -1); head.rotation.x += pan * lb * 0.12; }   // looks back over his shoulder, again and again
      if (rec > 0) head.rotation.x -= 0.22 * rec;
      if (shv > 0) head.rotation.z += shv * 0.025 * Math.sin(t * 39);
      if (trip > 0) head.rotation.x -= 0.5 * smooth((trip - 0.3) / 0.3);   // the head comes up as he hits the ground
      quiff.rotation.set(wind * 0.05 * Math.sin(t * 13.1), 0, wind * (0.07 + 0.05 * Math.sin(t * 17.3))); quiff.position.y = wind * 0.006 * Math.sin(t * 21);
      const sh = (p.shrug || 0) * 0.035;
      if (GTA) gtaPre(p, t);
      // ---- thank-you special: the counter phone in his right hand; the left hand swipes / scrubs / slaps it (all off unless castOpts teo.counter) ----
      const pC = fph ? clamp(p.phoneC || 0) : 0, PS = fph ? fph.S : 1, Pc = V(); let swp = 0;
      if (pC > 0) { Pc.set(p.r[0] - 0.015, p.r[1] + br * 0.003 + 0.045 * PS + 0.02, p.r[2] + 0.01); swp = Math.max(0, p.swipe || 0); }   // swipe may count up past 1 (1 -> 2 = the next swipe): the gesture is a function of the fraction, so no reset ever snaps
      [[sleeveL, handL, cuffL, p.l, -1, 0], [sleeveR, handR, cuffR, p.r, 1, 1]].forEach(([sl, hd, cf, tg, s, i]) => { const S = S0[i].clone(); S.y += sh; H[i].set(tg[0], tg[1] + br * 0.003, tg[2]);
        if (tg[3]) { const wv = Math.max(0, 1 - Math.abs(tg[3] - 1)); H[i].x += Math.sin(t * 9.5) * 0.05 * wv; H[i].y += Math.sin(t * 9.5 + 1.2) * 0.012 * wv; }
        if (LR && LR.amt > 0) { const runK = LR.rk, kA = LR.amt * (1 - carry) * (1 - LR.rb), f = (i ? 1 : -1) * LR.pump / Math.max(1e-3, LR.amt);   // f + = this arm forward (opposite to the leg)
          const tgt = V(s * (0.2 - 0.05 * runK * Math.max(0, f)), 0.44 + 0.08 * runK + (0.15 * runK + 0.03) * Math.max(0, f) - 0.02 * Math.max(0, -f), 0.05 + 0.03 * runK + (0.11 + 0.11 * runK) * f);
          H[i].lerp(tgt, kA); if (LR.bk > 0) H[i].lerp(V(s * 0.14, 0.78, 0.26), LR.bk);
          if (rbt) { const up = i ? rbt.k : 1 - rbt.k; H[i].lerp(V(s * 0.31, lerp(0.5, 0.88, up), 0.06), LR.rb); } }
        if (pan > 0) H[i].add(V(noise1(t * 2.3 + i * 5, seed) * 0.13 * pan, (0.2 + 0.1 * noise1(t * 2.9 + i * 3, seed + 4)) * pan * (1 - carry), noise1(t * 2.6 + i * 7, seed + 9) * 0.08 * pan));   // flailing
        if (rec > 0) H[i].lerp(V(s * 0.13, 0.85, 0.27), rec);
        if (trip > 0) H[i].lerp(V(s * 0.32, 0.86, 0.36), smooth((trip - 0.05) / 0.2) * (1 - carry));   // arms out to break the fall (a piggy rider is thrown off)
        if (carry > 0) H[i].lerp(i ? V(0.21, 0.5, 0.33) : V(-0.19, 0.47, 0.34), carry);
        if (p.piggy > 0) { const PG3 = piggyState(p), loaded = 1 - smooth((trip - 0.05) / 0.15); H[i].lerp(V(s * 0.13, 0.86, -0.04), PG3.grab * loaded); H[i].lerp(V(s * 0.23, 0.38, -0.11), PG3.hook * loaded); }
        if (shv > 0) { H[i].x += shv * 0.006 * Math.sin(t * 47 + i * 2); H[i].y += shv * 0.005 * Math.sin(t * 41 + i); }
        if (i === 0 && pC > 0) {
          const sc = clamp(p.scroll || 0), sp = clamp(p.slap || 0);
          if (sc > 0) { H[0].y += sc * 0.04 * PS * Math.sin(t * 8.2); H[0].x += sc * 0.025 * PS * Math.cos(t * 8.2); }   // a slow round scrub                                  // scrubs the screen up and down
          if (sp > 0) H[0].x += sp * 0.06 * Math.pow(Math.max(0, Math.sin(t * 7.5)), 2);   // soft eased pats                                                        // slaps the side of the phone
          if (swp > 0.001) { const Sp = V(Pc.x, Pc.y + 0.05 * PS, Pc.z + 0.07), Ep = V(Pc.x, Pc.y - 0.03 * PS, Pc.z + 0.07), base = H[0].clone(), ph = swp - (Math.ceil(swp - 1e-6) - 1), e = smooth(ph) * 3, k = Math.min(2, Math.floor(e)), f = e - k;   // pull-to-refresh: ONE eased gesture through base -> top of the screen -> pull down -> base (Catmull-Rom, no stop between the parts)
            const Q = [base, base, Sp, Ep, base, base], cr = (a, b, c, d, u) => V(0.5 * (2 * b.x + (-a.x + c.x) * u + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * u * u + (-a.x + 3 * b.x - 3 * c.x + d.x) * u * u * u), 0.5 * (2 * b.y + (-a.y + c.y) * u + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * u * u + (-a.y + 3 * b.y - 3 * c.y + d.y) * u * u * u), 0.5 * (2 * b.z + (-a.z + c.z) * u + (2 * a.z - 5 * b.z + 4 * c.z - d.z) * u * u + (-a.z + 3 * b.z - 3 * c.z + d.z) * u * u * u));
            H[0].copy(cr(Q[k], Q[k + 1], Q[k + 2], Q[k + 3], f)); H[0].z += 0.04 * Math.sin(Math.PI * clamp((e / 3 - 0.62) / 0.38)); }
        }
        if (GTA) gtaArm(i, s, H[i], p, t);
        if (P2B) P2B.arm(i, s, S, H[i], sl, cf, p, t);
        if (p.touch) touchArm(p.touch, i, H[i], body, S);   // 22/11: hand contact (ep.touch)
        armCtrl(S, H[i], i === 0 && pC > 0.3 ? Math.max(0.37, S.distanceTo(H[0]) * 1.12) : 0.37, s, C); sl.set(S, C, H[i]); hd.position.copy(H[i]); const dir = H[i].clone().sub(C).normalize(); cf.position.copy(H[i]).addScaledVector(dir, -0.04); cf.quaternion.setFromUnitVectors(V(0, 0, 1), dir); });
      phone.visible = (p.phone || 0) > 0.5 || (p.phoneEar || 0) > 0.5; if (phone.visible) { if ((p.phoneEar || 0) > 0.5) { phone.position.copy(H[1]).add(V(0.0, 0.06, -0.02)); phone.rotation.set(0, Math.PI / 2, 0.12); } else { phone.position.copy(H[1]).add(V(-0.02, 0.07, 0.03)); phone.rotation.set(-0.35, 0.25, 0.08); } }   // phoneEar: held against his ear, screen towards the head
      cup.visible = (p.cup || 0) > 0.5; if (cup.visible) { cup.position.copy(H[1]).add(V(-0.03, 0.03, 0.04)); cup.rotation.set(-0.5 * (p.cup || 0), 0, 0.1); }
      if (fph) { const k = smooth((pC - 0.15) / 0.7); fph.group.visible = k > 0.01; if (fph.group.visible) { const shk = clamp(p.slap || 0) + 0.6 * clamp(p.shake || 0);   // the phone scales up out of the hand with the pose, shakes when slapped
        fph.group.scale.setScalar(k); fph.group.position.copy(Pc); fph.group.position.y += 0.008 * shk * Math.sin(t * 7.1); fph.group.rotation.set(-0.06 + 0.035 * shk * Math.sin(t * 6.7), Math.PI - root.rotation.y + 0.1 + 0.035 * shk * Math.sin(t * 6.1), 0.08 * shk * Math.sin(t * 7.3));
        fph.update(t, clamp(p.names || 0), 0.6 * k); } }
      if (slipP) { const sk = smooth(clamp(p.slipHold || 0)); slipP.mesh.visible = sk > 0.01; if (slipP.mesh.visible) { const Lh = slipT.len * sk, Ht = H[1].clone().add(V(0.0, 0.05, 0.03));
        for (let j = 0; j <= 16; j++) { const a = j / 16 * Lh, d = Lh - a; slipPts[j].set(Ht.x + 0.006 * Math.sin(t * 1.7 + d * 9) * d / slipT.len, Ht.y - d * 0.97, Ht.z + 0.05 * Math.sin(d / slipT.len * Math.PI) + 0.004 * d); }   // j = 0 the tip (bottom), j = 16 the top held in his hand
        slipP.set(slipPts, slipT.w * sk, null, (u) => 0.04 * Math.sin(t * 1.3 + u * 5), 0, 1, V(1, 0, 0)); } }
      if (GTA) { penUpd(H[1], p, t); propsUpd(p, H[1]); }
      if (P2B) P2B.update(p, t, H[1], H[0]);
      paperOn?.update(t, clamp(p.paper || 0), clamp(p.paperFace || 0), clamp(p.paperBrush || 0));
      const fl2 = flk(p, t);
      drawFace(p.face, P2B ? P2B.talk(p, t) : (p.talk || 0), t, clamp(Math.max(p.face.glow || 0, p.glow || 0)) * fl2, p.print || 0, p.faceX || null); drawAura(p, t);
    },
    headWorld(out = V()) { return head.getWorldPosition(out); },
    // where a carried character (ep.rides = { bip: 'teo' }, fx ride) lies, in Tèo's root frame: across his chest, on his forearms, bobbing with his steps
    carryAt(f, t, rider = null) { const st = clamp(f.stand ?? standDef), L = st > 0 || usesLegs(f) ? legRig(f, { hx: 0.075, hipY: 0.33 + LIFT, ankle: 0.08 }) : null, dy = L ? st * (LIFT + L.dy) : 0;
      // Bíp lies across the forearms, lagging a hair behind each bounce (squash), tilted with Tèo's lean; with a trip he goes down with him
      const sq = L ? (L.squash || 0) : 0, pos = V(-0.5, 0.6 + dy - 0.02 * sq, 0.36), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(L ? -0.06 * clamp(f.carry || 0) : 0, 0, -Math.PI / 2 + 0.1 + (L ? L.roll * 0.6 : 0), 'YXZ'));
      const tr = clamp(f.trip || 0); if (tr > 0) { const X = tripXf(tr, clamp(f.carry || 0)), R = new THREE.Quaternion().setFromEuler(new THREE.Euler(X.ang, 0, 0)); pos.sub(X.pivot).applyQuaternion(R).add(X.pivot); pos.z += X.slide; pos.y += X.bounce + X.lift; q.premultiply(R); }
      // piggyback: Bíp on Tèo's back, belly to his back, head lolling beside his; rotates with Tèo's lean about the hips; bounces a beat late; rider fx hide lowers his head behind Tèo's back
      const PG = piggyState(f); if (PG.pg > 0) { const fp = { ...f, crouch: Math.max(f.crouch || 0, PG.crouch) }, Lp = legRig(fp, { hx: 0.075, hipY: 0.33 + LIFT, ankle: 0.08 }), Lg = legRig({ ...fp, gph: (f.gph || 0) - 0.07 }, { hx: 0.075, hipY: 0.33 + LIFT, ankle: 0.08 }), hide = clamp(rider?.hide || 0);
        const liftP = st * (LIFT + Lg.dy) - 0.02 * (Lg.squash || 0), R = new THREE.Euler(Lp.lean * st + PG.lean, 0, Lp.roll), Rq = new THREE.Quaternion().setFromEuler(R);
        const rel = V(-0.02, -0.78, -0.45).lerp(V(-0.05, -0.53 - 0.14 * hide, -0.4 - 0.03 * hide), PG.up), P2 = rel.applyQuaternion(Rq).add(V(0, 0.33 + liftP, 0)), q2 = Rq.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(lerp(0.38, 0.16 + 0.5 * hide, PG.up), 0, 0.08, 'YXZ')));
        if (tr > 0) { const a = smooth((tr - 0.06) / 0.5), end = V(0.05, 0.19, 0.5); P2.lerp(end, a); P2.y += 0.45 * 4 * a * (1 - a); q2.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(1.5, 0, 0.25, 'YXZ')), a); }   // thrown forward off his back, lands face down in front; Tèo lands half over him
        pos.lerp(P2, PG.pg); q.slerp(q2, PG.pg); }
      return { pos, q }; },
  };
  root.userData.api = api; return api;
}

// =====================================================================================================================
// BÍP: glossy blue robot, dark visor with glowing eyes, antenna, white chest plate with the coral Claude spark
// =====================================================================================================================
// Zombie special (13/11), all OFF by default (a seated Bíp is unchanged): stand (legs), the gaits (walk, run), kneel, lie (on his side), ride (carried, limp),
// batt (battery bar under the spark), off (eyes dark, spark dim), sputter (eyes flicker on a slow wave), hearts (pink hearts around the head), plug (cable, see Chíp).
// look: the colours and the chest mark, so Chíp (packs/trada/chip.js) is the same build in white with the ChatGPT mark.
const BIP_LOOK = { body: '#3f8cf0', body2: '#2a63c4', plate: '#f6f4ee', eye: '#5ff2ff', mark: 'claude', lash: false, name: 'bip', color: '#5ff2ff' };
function gptMarkTex(col = '#ffffff') { return canvasTex(256, 256, (c) => { c.translate(128, 128); c.scale(2.3, 2.3); c.strokeStyle = col; c.lineWidth = 7; c.lineJoin = 'round'; for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * Math.PI / 3); c.translate(0, -23); c.rotate(Math.PI / 6); c.beginPath(); c.roundRect(-18, -8, 36, 16, 8); c.stroke(); c.restore(); } }); }
const heartPath = (c, s) => { c.beginPath(); c.moveTo(0, 32 * s); c.bezierCurveTo(-60 * s, -10 * s, -26 * s, -52 * s, 0, -18 * s); c.bezierCurveTo(26 * s, -52 * s, 60 * s, -10 * s, 0, 32 * s); };
export function makeBip({ seed = 2, plate: plateOut = true, stand: standDef = 0, batt: battDef = null, battLift = 0.06, look = null, screen = null, slip = null, flood: floodOpt = null, tearEye = -1, slipAt = null, glass: glassOpt = false, belt: beltOpt = false } = {}) {
  // thank-you special (13/11), all off by default: slip = ['34.700', 'LƯỢT XEM', '2 NGÀY'] (or '34.700 LƯỢT XEM · 2 NGÀY') = the receipt slip his chest printer prints, he tears off and lays on the table (fx slip 0 -> 1, see the timeline in the ENGINE.md block);
  // slipAt = [x, z, yaw] world spot of the slip on the table (default [0.155, 0.4, 0.1]); flood: true | { n, pieces } = paper pouring out of his chest without stopping (fx flood 0..1, floodStop 0 -> 1 lets it stop, slipGone 1 hides the table slip);
  // fx tear 0..1 = a bright tear on one eye bar (tearEye -1 screen-left, 1 screen-right); pose wipe / wipeR = wipes it
  // battLift: a SEATED Bíp with the battery shown sits this much higher, because the table top (y 0.4775) hides anything under his plate
  // plate (default ON since 13/11, the owner "Bật luôn nhé"): the chest plate sits 6 cm higher and 2.5 cm further out, so the Claude spark shows above the table instead of
  // sinking into the egg; with it the spark is larger, lit from within and breathes slowly ("Logo làm nổi bật lên nhé"). plate: false = the old look of the first Ngày 12 cut.
  const LK = { ...BIP_LOOK, ...(look || {}) }, GPT = LK.mark === 'gpt';
  const root = new THREE.Group(); root.name = LK.name; const rig = new THREE.Group(); root.add(rig); const body = new THREE.Group(); rig.add(body);
  const blue = new THREE.MeshPhysicalMaterial({ color: LK.body, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.2 }), blue2 = new THREE.MeshPhysicalMaterial({ color: LK.body2, roughness: 0.4, clearcoat: 0.6 }), white = new THREE.MeshPhysicalMaterial({ color: LK.plate, roughness: 0.35, clearcoat: 0.7 });
  const CY = LK.eye, handM = LK.hand ? new THREE.MeshPhysicalMaterial({ color: LK.hand, roughness: 0.35, clearcoat: 0.7 }) : white, legM = LK.leg ? new THREE.MeshPhysicalMaterial({ color: LK.leg, roughness: 0.4, clearcoat: 0.6 }) : blue2;
  // body: an egg, with a belly band and the chest plate
  const torso = lathe([[0.001, 0.27], [0.1, 0.275], [0.15, 0.32], [0.168, 0.4], [0.16, 0.5], [0.13, 0.58], [0.09, 0.625], [0.045, 0.645], [0.001, 0.648]], blue, [0, 0, 0], body);
  mesh(new THREE.TorusGeometry(0.161, 0.012, 10, 40), blue2, [0, 0.335, 0], body, { rot: [Math.PI / 2, 0, 0] });
  const plate = mesh(new RoundedBoxGeometry(0.17, 0.13, 0.05, 4, 0.03), white, plateOut ? [0, 0.53, 0.157] : [0, 0.468, 0.132], body, { rot: [-0.12, 0, 0] });
  mesh(new RoundedBoxGeometry(0.1, 0.022, 0.03, 2, 0.008), std(GPT ? '#9aa3ad' : '#c9ccd4', { roughness: 0.5 }), [0, 0.072, 0.006], plate);
  const sparkT = GPT ? gptMarkTex() : canvasTex(256, 256, (c) => { c.translate(128, 128); c.fillStyle = '#d9673f'; const rays = 12; c.beginPath(); for (let i = 0; i < rays * 2; i++) { const a = (i / (rays * 2)) * Math.PI * 2 + 0.13, r = i % 2 ? 22 : 92 + ((i * 37) % 5) * 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); });
  const MARK = GPT ? '#8ff5dc' : '#d9673f';
  const SP = plateOut ? 0.122 : 0.095, spark = mesh(new THREE.PlaneGeometry(SP, SP), new THREE.MeshStandardMaterial({ map: sparkT, transparent: true, roughness: 0.5, emissive: plateOut ? (GPT ? '#b8fff0' : '#ffffff') : MARK, emissiveMap: sparkT, emissiveIntensity: 0.25, ...(GPT ? { color: '#dffff7' } : {}) }), [0, plateOut ? -0.004 : 0, 0.0262], plate, { cast: false }); spark.renderOrder = 2;
  // the spark's inner light: the mark emits its own coral (never shaded dark) over a soft coral halo on the plate, breathing about once every 3.6 s
  const sparkGlowT = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  const markGlow = GPT && plateOut ? mesh(new THREE.PlaneGeometry(SP, SP), new THREE.MeshBasicMaterial({ map: sparkT, color: new THREE.Color(1.6, 2.1, 1.95), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), [0, -0.004, 0.0272], plate, { cast: false, recv: false }) : null; if (markGlow) markGlow.renderOrder = 4;
  const sparkGlow = plateOut ? mesh(new THREE.PlaneGeometry(SP * 1.6, SP * 1.6), new THREE.MeshBasicMaterial({ map: sparkGlowT, color: GPT ? '#7dffe0' : '#ff6a36', transparent: true, opacity: 0, depthWrite: false, ...(GPT ? { blending: THREE.AdditiveBlending } : {}) }), [0, -0.004, 0.0268], plate, { cast: false, recv: false }) : null; if (sparkGlow) sparkGlow.renderOrder = 3;
  cyl(0.04, 0.05, 0.05, blue2, [0, 0.655, 0], body, {}, 20);
  // battery bar (Zombie special): a small dark gauge just under the plate, never over the mark; hidden unless batt is given (castOpts batt or fx batt)
  const battG = new THREE.Group(); battG.position.set(0, -0.083, 0.004); plate.add(battG); battG.visible = false;
  mesh(new RoundedBoxGeometry(0.1, 0.038, 0.016, 2, 0.008), std('#1a1d26', { roughness: 0.4 }), [0, 0, 0], battG, { cast: false });
  mesh(new RoundedBoxGeometry(0.009, 0.016, 0.01, 1, 0.003), std('#1a1d26', { roughness: 0.4 }), [0.054, 0, 0], battG, { cast: false });
  const battTrack = mesh(new THREE.PlaneGeometry(0.088, 0.027), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.06, 0.05), toneMapped: false }), [0, 0, 0.0083], battG, { cast: false, recv: false }); battTrack.renderOrder = 3;
  const battFill = mesh(new THREE.PlaneGeometry(0.088, 0.027), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.25, 0.2), toneMapped: false }), [0, 0, 0.0088], battG, { cast: false, recv: false }); battFill.renderOrder = 3;
  // head
  const head = new THREE.Group(); head.position.set(0, 0.84, 0); head.rotation.order = 'YXZ'; body.add(head);
  const HW = 0.42, HH = 0.33, HD = 0.31;
  mesh(new RoundedBoxGeometry(HW, HH, HD, 10, 0.152), blue, [0, 0, 0], head);
  // the visor: a dark glossy pillow bulging out of the front of the head (the old face: a big rounded screen, not a rectangle)
  const VW = 0.352, VH = 0.25, VR = 0.118, VZ = 0.024, VY = -0.004;
  const visor = mesh(new RoundedBoxGeometry(VW, VH, HD, 10, VR), new THREE.MeshPhysicalMaterial({ color: '#070b1c', roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }), [0, VY, VZ], head);
  const faceT = canvasTex(512, 352, () => {}, { mip: true });
  // the drawn face is laid ON the curved screen (a grid bent to the pillow), so eyes and cheeks stay stuck to it from any angle
  const fg = new THREE.PlaneGeometry(0.338, 0.2324, 36, 24), fp = fg.attributes.position;
  for (let q = 0; q < fp.count; q++) { const dx = Math.max(0, Math.abs(fp.getX(q)) - (VW / 2 - VR)), dy = Math.max(0, Math.abs(fp.getY(q)) - (VH / 2 - VR)); fp.setZ(q, HD / 2 - VR + Math.sqrt(Math.max(1e-6, VR * VR - dx * dx - dy * dy)) + 0.002); }
  fg.computeVertexNormals();
  const faceM = mesh(fg, new THREE.MeshBasicMaterial({ map: faceT, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), [0, VY, VZ], head, { cast: false, recv: false }); faceM.renderOrder = 3;
  const ant = new THREE.Group(); ant.position.set(0, HH / 2 - 0.01, 0); head.add(ant);
  cyl(0.007, 0.009, 0.1, blue2, [0, 0.05, 0], ant, {}, 10);
  const bulb = ball(0.027, new THREE.MeshStandardMaterial({ color: '#0a3a44', emissive: CY, emissiveIntensity: 2.6 }), [0, 0.115, 0], ant, { cast: false }, 20);
  const glow = new THREE.PointLight(CY, 0.5, 1.4, 2); glow.position.set(0, 0.115, 0.02); ant.add(glow);
  // arms: thin, with white ball hands
  const armL = new Noodle(0.024, blue2, body, { seg: 12 }), armR = new Noodle(0.024, blue2, body, { seg: 12 });
  const handL = ball(0.04, handM, [0, 0, 0], body, {}, 22), handR = ball(0.04, handM, [0, 0, 0], body, {}, 22);
  const phone = phoneProp(), cup = cupProp(); body.add(phone, cup); phone.visible = cup.visible = false;
  // a raised finger (poke, finger), a phone held up to the camera with its own screen (castOpts screen: (ctx, w, h) => {})
  // GTA special (19/11), OFF unless castOpts bip.glass / bip.belt: a full glass of trà đá held upright in the right hand in EVERY pose (fx tea 0..1 = the tea leaves it as one blob and drops back, fx sip 0..1 = a deadpan sip), a seat belt across him that passes under the plate (the spark stays clear)
  const GL = glassOpt ? makeTeaGlass(body) : null, BELT = beltOpt ? makeBelt(body) : null; if (BELT) BELT.visible = true;
  const GH = V(0.2, 0.5, 0.2), SIPH = V(0.07, 0.665, 0.29), _gq = new THREE.Quaternion(), _up = V();
  const finger = new THREE.Group(); body.add(finger); finger.visible = false; cyl(0.011, 0.012, 0.06, handM, [0, 0.04, 0], finger, {}, 10); ball(0.0115, handM, [0, 0.07, 0], finger, {}, 10);
  const phoneUp = phoneProp(); body.add(phoneUp); phoneUp.visible = false; phoneUp.scale.setScalar(1.25);
  const slipT = slip ? makeSlip(slip, root, { w: 0.1, len: 0.26 }) : null, slipPts = Array.from({ length: 17 }, () => V()), floodP = floodOpt ? makeFlood(root, floodOpt === true ? {} : floodOpt) : null;
  if (screen) { const st = canvasTex(256, 512, (c, w, h) => { c.fillStyle = '#f4f6fa'; c.fillRect(0, 0, w, h); screen(c, w, h); }); phoneUp.userData.screen.material = new THREE.MeshBasicMaterial({ map: st, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.15) }); }
  // standing legs (hidden while seated): thin limbs like the arms, white ball knees and oval feet
  const LIFTB = 0.15, legsB = new THREE.Group(); rig.add(legsB); legsB.visible = false;
  const legB = [-1, 1].map(() => { const n = new Noodle(0.03, legM, legsB, { seg: 12 }); n.set(V(0, 0.3, 0), V(0, 0.2, 0.02), V(0, 0.08, 0.02)); const kn = ball(0.034, handM, [0, 0, 0], legsB, {}, 16); const ft = mesh(new THREE.SphereGeometry(0.052, 20, 14), handM, [0, 0, 0], legsB, { scale: [0.85, 0.62, 1.35] }); return { n, kn, ft }; });
  const blobB = contactBlob(0.5, 0.46, legsB, [0, 0.004, 0.02], 0.5);
  // pink hearts around the head (fx hearts): additive sprites on slow orbits
  const heartT = canvasTex(64, 64, (c) => { c.translate(32, 34); c.fillStyle = '#fff'; heartPath(c, 0.5); c.fill(); });
  const hearts = [0, 1, 2, 3, 4].map((i) => { const m = mesh(new THREE.PlaneGeometry(0.075, 0.075), new THREE.MeshBasicMaterial({ map: heartT, color: new THREE.Color(2.2, 0.55, 1.0), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), [0, 0, 0], rig, { cast: false, recv: false }); m.visible = false; m.renderOrder = 6; return m; });
  // charging cable (fx plug, Chíp): from the chest socket to another character's chest (castOpts plugTo, default 'bip'), hidden otherwise
  const cable = new Noodle(0.009, std('#f2f2f2', { roughness: 0.5 }), root, { seg: 16 }); cable.mesh.visible = false; cable.set(V(0, 0.5, 0.1), V(0, 0.4, 0.2), V(0, 0.5, 0.3));
  const plugLight = ball(0.012, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 1.8), toneMapped: false }), [0, 0, 0], root, { cast: false }); plugLight.visible = false; plugLight.userData.noOutline = true;

  // xp: see Teo's drawFace (faces-plus export only; null = unchanged). xp.ss scales the glow blur when the export draws the canvas larger than 512 px
  let _faceKeyB = '';
  function drawFace(f, talk, t, dim = 1, tr = 0, xp = null) {
    if (xp) f = xp.face; const sk = xp ? xp.skw : (f.skew ? 1 : 0), SS = xp ? xp.ss : 1;
    const bl = xp ? xp.blink : blink(t, seed + 5), k = 1 - bl * 0.92;
    const dynamic = !!xp || (f.wave || 0) > 0.5 || !!f.scan;
    if (!dynamic) {
      const fk = `${bl.toFixed(4)}|${dim.toFixed(4)}|${tr.toFixed(4)}|${talk.toFixed(4)}|${(f.h || 0).toFixed(4)}|${(f.arc || 0).toFixed(4)}|${(f.tilt || 0).toFixed(4)}|${(f.w || 1).toFixed(4)}|${(f.round || 0).toFixed(4)}|${(f.smile || 0).toFixed(4)}|${(f.open || 0).toFixed(4)}|${(f.blush || 0).toFixed(4)}|${(f.heart || 0).toFixed(4)}|${(f.px || 0).toFixed(4)}|${(f.py || 0).toFixed(4)}|${sk}|${(f.pucker || 0).toFixed(4)}`;
      if (fk === _faceKeyB) return;
      _faceKeyB = fk;
    } else _faceKeyB = '';
    // the old Bíp, by measurement of the 2-D frames: bars 22 % of the visor wide, 3 : 1, centres 16 % either side of the middle, 40 % down;
    // mouth a short flat dash at 71 %; cheeks far out at 33 %, 74 %. Flat bars close together = the judging stare. Do not make them rounder or wider apart.
    const c = faceT.userData.ctx, W = 512, Hh = 352, cx = W / 2, ey = 141; c.clearRect(0, 0, W, Hh);
    if (dim < 1) c.globalAlpha = clamp(dim);
    c.shadowColor = CY; c.shadowBlur = 16 * SS; c.fillStyle = CY; c.strokeStyle = CY; c.lineCap = 'round';
    for (const s of [-1, 1]) {
      const x = cx + s * 82 + (f.px || 0) * 20, y = ey + (f.py || 0) * 16, w = 113 * (f.w || 1), h = 37 * f.h * k * (xp ? xp.hk[s > 0 ? 1 : 0] : 1);
      c.save(); c.translate(x, y); c.rotate(-s * f.tilt * 0.3 + (s > 0 ? -0.12 * sk : 0) + (xp ? xp.rot : 0));
      if (f.heart > 0.5) { c.fillStyle = '#ff6f9a'; c.shadowColor = '#ff6f9a'; c.beginPath(); c.moveTo(0, 32); c.bezierCurveTo(-60, -10, -26, -52, 0, -18); c.bezierCurveTo(26, -52, 60, -10, 0, 32); c.fill(); c.fillStyle = CY; c.shadowColor = CY; }
      else if (f.wave > 0.5) { c.lineWidth = 15; c.beginPath(); for (let j = 0; j <= 24; j++) { const u = j / 24, xx = (u - 0.5) * w * 0.95, yy = Math.sin(u * Math.PI * 3 + t * 9 + s) * 10; if (j) c.lineTo(xx, yy); else c.moveTo(xx, yy); } c.stroke(); }
      else if (f.arc > 0.5) { c.lineWidth = 21; c.beginPath(); c.arc(0, 26, 44, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
      else if (f.round > 0.5) { c.beginPath(); c.arc(0, 0, 38 * k + 3, 0, 7); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, 0, 15 * k, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; }
      else { const hh = Math.max(8, h * lerp(1, 1.5, f.round || 0)), hw = w * (s < 0 && sk ? (xp ? lerp(1, 0.86, sk) : 0.86) : 1); c.beginPath(); c.roundRect(-hw / 2, -hh / 2, hw, hh, Math.min(hh / 2, 11)); c.fill(); }
      if (LK.lash && f.heart <= 0.5) { c.lineWidth = 7; const top = f.arc > 0.5 ? -16 : -Math.max(8, h) / 2; for (const j of [0, 1]) { c.beginPath(); c.moveTo(s * (w * 0.32 + j * 14), top + 2); c.lineTo(s * (w * 0.32 + j * 14 + 10), top - 16 + j * 4); c.stroke(); } }
      c.restore();
    }
    if (f.scan) { const sx = cx + Math.sin(t * 5) * 170; c.fillRect(sx - 3, ey - 40, 6, 80); }
    if (xp && xp.scanA > 0.01) { c.save(); c.globalAlpha *= clamp(xp.scanA); const sx = cx + xp.scanX * 170; c.fillRect(sx - 2, ey - 32, 4, 64); c.restore(); }   // a quick scan sweep (faces plus: Bip 'reads' what he judges)
    c.shadowBlur = 0; if (f.blush > 0.01) for (const s of [-1, 1]) { c.fillStyle = `rgba(255,120,150,${0.72 * f.blush})`; c.beginPath(); c.ellipse(cx + s * 170, 260, 31, 17, 0, 0, 7); c.fill(); }
    // mouth: a short flat dash; it opens with the voice
    c.shadowColor = CY; c.shadowBlur = 12 * SS; c.fillStyle = CY; c.strokeStyle = CY; const mo = clamp(Math.max(f.open, xp ? xp.mo : talk)), my = 250, mw = (40 + mo * 8) * (xp ? xp.mw : 1), mx = cx + 14 * sk, mh = xp ? xp.mh : 1, dl = xp ? xp.dash : 1;
    if (f.pucker > 0.5 && (xp ? xp.mo : talk) < 0.1) { c.lineWidth = 11; c.beginPath(); c.arc(mx, my, 13, 0, 7); c.stroke(); }
    else if (mo > 0.1) { c.beginPath(); c.roundRect(mx - mw, my - 6 - mo * 15 * mh, mw * 2, 12 + mo * 30 * mh, 10 + mo * 8); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.roundRect(mx - mw + 11, my - 6 - mo * 15 * mh + 11, mw * 2 - 22, Math.max(0, mo * 30 * mh - 10), 8); c.fill(); c.globalCompositeOperation = 'source-over'; }
    else { c.lineWidth = 13; c.beginPath(); c.moveTo(mx - 40 * dl, my - f.smile * 8); c.quadraticCurveTo(mx, my + f.smile * 15, mx + 40 * dl, my - f.smile * 8 - 9 * sk); c.stroke(); }
    // a single bright tear (fx tear 0..1): forms at the lower edge of one eye bar (0-0.22), rolls down the visor (0.22-0.92), pools on the cheek. The face is additive, so it is drawn white-cyan
    if (tr > 0.002) { const sd = tearEye, xe = cx + sd * 82 + sd * 24, ye = ey + 22, form = clamp(tr / 0.22), sf = form * form * (3 - 2 * form), rl = clamp((tr - 0.22) / 0.7), roll = Math.pow(rl * rl * (3 - 2 * rl), 1.25), r = 12 * sf * (1 - 0.22 * roll);
      const yy = ye + r * 0.6 + (252 - ye - r * 0.6) * roll, xx = xe + sd * 18 * roll, st = Math.sin(Math.PI * Math.min(1, roll * 1.15)) * 15;   // st: the drop stretches while it runs
      c.save(); c.globalAlpha = 1; if (roll > 0.01) { const gr = c.createLinearGradient(0, ye, 0, yy); gr.addColorStop(0, 'rgba(160,250,255,0)'); gr.addColorStop(1, 'rgba(160,250,255,0.5)'); c.strokeStyle = gr; c.lineWidth = 5; c.beginPath(); c.moveTo(xe, ye + 4); c.lineTo(xx, yy - r); c.stroke(); }
      c.shadowColor = '#8ff8ff'; c.shadowBlur = 22 * SS; c.fillStyle = '#f4ffff'; c.beginPath(); c.moveTo(xx, yy - r - 9 - st); c.bezierCurveTo(xx + r * 0.25, yy - r * 1.3, xx + r, yy - r * 0.9, xx + r, yy); c.arc(xx, yy, r, 0, Math.PI); c.bezierCurveTo(xx - r, yy - r * 0.9, xx - r * 0.25, yy - r * 1.3, xx, yy - r - 9 - st); c.closePath(); c.fill();
      c.shadowBlur = 0; c.fillStyle = '#fff'; c.beginPath(); c.arc(xx - r * 0.35, yy + r * 0.05, Math.max(0.1, r * 0.28), 0, 7); c.fill(); c.restore(); }
    c.shadowBlur = 0; c.globalAlpha = 1; faceT.needsUpdate = true;
  }
  const S0 = [V(-0.155, 0.555, 0.0), V(0.155, 0.555, 0.0)], H = [V(), V()], C = V(), _q = new THREE.Quaternion(), _dn = V();
  const plateWorld = (out = V()) => plate.localToWorld(out.set(0, -0.004, 0.03));
  // ---- the slip (fx slip 0 -> 1). Timeline: 0-0.36 prints out of the slot above the plate in 9 bursts ("xè xè") and hangs forward-down; 0.34-0.5 the right hand reaches for it; 0.5-0.56 it is torn off (a
  // quick jerk); 0.56-0.84 carried to the table, laid down (0.72-0.84), text up, tail (top of the text) away from the camera; 0.84-0.96 the hand lets go; then it just lies there. fx slipGone 1 hides it. ----
  const slipHand = { p: V(), w: 0 }, SLOT = V(0, 0.607, 0.112), D0 = V(0, 0.45, 0.89).normalize(), _w = V(), _b = new THREE.Matrix4(), SIDE = V(1, 0, 0);
  function slipUpdate(p, t) {
    slipHand.w = 0; if (!slipT) return; const sl = clamp(p.slip || 0), rb = slipT.ribbon; rb.mesh.visible = sl > 0.002 && !((p.slipGone || 0) > 0.5); if (!rb.mesh.visible) return;
    const len = slipT.len, W = slipT.w, at = slipAt || [0.155, 0.4, 0.1]; body.updateMatrix(); _b.copy(body.matrix); const bInv = _b.clone().invert(); root.updateMatrixWorld(true);
    const toR = (v) => v.applyMatrix4(_b), g = 2.4;
    const hang = (L, out) => { const S0 = toR(SLOT.clone()), dir = D0.clone().transformDirection(_b); for (let j = 0; j <= 16; j++) { const sp = L * (1 - j / 16); out[j].copy(S0).addScaledVector(dir, sp); out[j].y -= g * sp * sp; out[j].x += 0.004 * Math.sin(t * 1.3 + sp * 9) * sp / len; } return out; };
    const lay = (out) => { for (let j = 0; j <= 16; j++) { const a = j / 16 * len, d = len / 2 - a; _w.set(at[0] + Math.sin(at[2]) * d, 0.4795 + 0.002 * Math.max(0, Math.sin(j / 16 * Math.PI)) + 0.0015 * (j / 16), at[1] + Math.cos(at[2]) * d); root.worldToLocal(_w); out[j].copy(_w); } return out; };
    const L = len * smooth(clamp(sl / 0.4));   // one continuous eased feed out of the slot
    const Pa = hang(Math.max(0.001, sl < 0.4 ? L : len), slipPts.map((q) => q.clone()));   // the shape still attached at the slot
    const vib = 0;   // (no buzz: nothing visible may vibrate per frame)
    let P = Pa, v1 = sl < 0.4 ? L / len : 1;
    const gp = hang(len, slipPts.map((q) => q.clone()))[2];   // a grab point near the tail end (the hand holds the paper about 3 cm below the slot)
    const grab = hang(len, slipPts.map((q) => q.clone()))[14];
    if (sl >= 0.34) slipHand.w = smooth((sl - 0.34) / 0.14) * (1 - smooth((sl - 0.84) / 0.12));
    if (sl < 0.5) { slipHand.p.copy(grab).applyMatrix4(bInv); slipHand.p.z += 0.045; }   // the hand always pinches from the FRONT of the paper (no depth flip between hand and paper)
    else {
      const tear = smooth((sl - 0.5) / 0.12), carry = smooth((sl - 0.56) / 0.24), layK = smooth((sl - 0.72) / 0.12), pull = V(0, -0.03, 0.07).multiplyScalar(tear);
      const Hh1 = grab.clone().add(pull), spot = V(at[0], 0.4795 + 0.075, at[1] - len / 2 + 0.03); root.worldToLocal(spot);
      const Hh = Hh1.clone().lerp(spot, carry); Hh.y += 0.09 * Math.sin(Math.PI * carry) * (1 - layK);
      const q = smooth((sl - 0.5) / 0.1), hangF = hang(len, slipPts.map((z) => z.clone())), held = slipPts.map((z, j) => { const a = j / 16 * len, d = len - a; return V(Hh.x + 0.004 * Math.sin(t * 1.9 + d * 8) * d / len * (1 - layK), Hh.y - (d - len * 0.08) * 0.97 * (1 - 0.0), Hh.z + 0.012 * Math.sin(d / len * Math.PI)); });
      const lay16 = lay(slipPts.map((z) => z.clone()));
      P = held.map((hv, j) => hangF[j].clone().add(pull).lerp(hv, q).lerp(lay16[j], layK));
      slipHand.p.copy(Hh).applyMatrix4(bInv); slipHand.p.z += 0.045;
    }
    if (vib) P = P.map((q) => q.clone().add(V(0, vib, 0)));
    for (let j = 0; j <= 16; j++) slipPts[j].copy(P[j]);
    rb.set(slipPts, W, null, null, 0, v1, SIDE); void gp;
  }
  const api = {
    name: LK.name, darkFace: true, root, body, head, R: 0.19, headY: 0.84, eyeUp: 0.01, faces: BIP_FACE, poses: BIP_POSE, color: LK.color,
    apply(p, t) {
      const id = idle(t, seed), br = id.breathe, hov = Math.sin(t * 2.1 + 1) * 0.006;
      body.rotation.set(p.lean || 0, p.twist || 0, id.sway * 0.5); body.position.y = (p.bob || 0) + hov;
      // ---- Zombie special (none of it runs for a seated Bíp with no new numbers) ----
      const stK = clamp(p.stand ?? standDef), legsOn = stK > 1e-4 || usesLegs(p), lie = clamp(p.lie || 0), ride = clamp(p.ride || 0);
      let LR = null;
      if (legsOn) {
        LR = legRig(p, { hx: 0.07, hipY: 0.3 + LIFTB, ankle: 0.06 }); legsB.visible = stK > 0.02;
        const ride0 = clamp(p.ride || 0) * (1 - smooth(((p.rideTrip || 0) - 0.3) / 0.25)); if (ride0 > 0) { root.updateMatrixWorld(true); rig.getWorldQuaternion(_q).invert(); _dn.set(0, -1, 0).applyQuaternion(_q); }
        legB.forEach((L, i) => { const s = i ? 1 : -1, tuck = V(s * 0.07, 0.3, 0.02), Hh = tuck.clone().lerp(LR.H[i], stK), Cc = tuck.clone().lerp(LR.C[i], stK), A = tuck.clone().lerp(LR.A[i], stK); Hh.x += LR.sway * stK;
          if (ride0 > 0) { const sw = Math.sin(((p.rideGph || 0) * 2 + i * 0.5) * Math.PI * 2) * 0.07 * (p.rideRun || 0), A2 = Hh.clone().addScaledVector(_dn, 0.36).add(V(0, 0, sw)); A.lerp(A2, ride0); Cc.lerp(Hh.clone().add(A).multiplyScalar(0.5), ride0);
            const rp = ride0 * clamp(p.ridePiggy || 0); if (rp > 0) { const Kp = Hh.clone().add(V(s * 0.11, -0.05, 0.21)), Ap = Kp.clone().addScaledVector(_dn, 0.22).add(V(0, 0, -0.03 + sw * 0.6)); A.lerp(Ap, rp); Cc.lerp(Kp.clone().multiplyScalar(2).sub(Hh.clone().add(Ap).multiplyScalar(0.5)), rp); } }   // piggyback: knees forward round Tèo's hips, shins hanging
          L.n.set(Hh, Cc, A); L.kn.position.copy(Hh).add(A).multiplyScalar(0.5).lerp(LR.K[i], ride0 > 0 ? 1 - ride0 : 1).lerp(tuck, 1 - stK); L.ft.position.copy(A).add(V(0, -0.025, 0.03)); L.ft.rotation.set(-LR.tilt[i], 0, 0); });
        blobB.visible = stK > 0.5 && lie < 0.5 && ride < 0.5;
        const hv = hov * (1 - stK), q = new THREE.Euler((p.lean || 0) + LR.lean * stK, p.twist || 0, id.sway * 0.5 + LR.roll), PIV = V(0, 0.3, 0);
        body.rotation.copy(q); body.position.copy(PIV).sub(PIV.clone().applyEuler(q)); body.position.y += stK * (LIFTB + LR.dy) + (p.bob || 0) + hv; body.position.x += LR.sway * stK;
      } else { if (legsB.visible) legsB.visible = false; const b0 = p.batt ?? battDef; if (b0 !== null && b0 !== undefined) body.position.y += battLift; }
      // lying on his side on the ground (lie), head towards his +x; with the legs he rests on his hip
      if (lie > 0 || rig.rotation.z !== 0) { pivotRot(rig, new THREE.Euler(0, 0, -lie * Math.PI / 2 * 0.96), V(0.165, 0, 0)); rig.position.y += lie * 0.01; }
      const off = clamp(p.off || 0), sput = clamp(p.sputter || 0), eyeK = (1 - off) * (1 - sput * clamp(0.55 + 0.6 * fbm1(t * 6.5, seed + 30)));
      head.position.y = 0.84 + br * 0.003; head.rotation.set(-(p.pitch || 0) - id.headPitch, (p.yaw || 0) + id.headYaw, (p.roll || 0) + id.headRoll);
      const rsw = ride > 0 ? Math.sin((p.rideGph || 0) * Math.PI * 4 - 0.6) * (p.rideRun || 0) : 0;   // swings once per carrier step, a beat late (follow-through)
      if (ride > 0) { head.rotation.set(lerp(head.rotation.x, 0.25 + 0.12 * rsw, ride), head.rotation.y * (1 - ride), lerp(head.rotation.z, -0.35 - 0.1 * rsw, ride)); }
      const rpg = ride * clamp(p.ridePiggy || 0) * (1 - smooth(((p.rideTrip || 0) - 0.06) / 0.35)), hideK = clamp(p.hide || 0);
      if (rpg > 0) { head.rotation.x = lerp(head.rotation.x, 0.22 + 0.1 * rsw + 0.75 * hideK, rpg); head.rotation.z = lerp(head.rotation.z, 0.32 + 0.08 * rsw, rpg); head.rotation.y = lerp(head.rotation.y, 0.3, rpg); }   // head lolling on Tèo's shoulder
      if (LR && LR.rk > 0) head.rotation.y = lerp(head.rotation.y, id.headYaw, 0.8 * LR.rk);
      if (lie > 0) head.rotation.z += lie * 0.25;
      ant.rotation.set(Math.sin(t * 3.1) * 0.06 - (p.pitch || 0) * 0.4 + 0.35 * rsw * ride + 0.7 * rpg, 0, Math.sin(t * 2.3 + 1) * 0.08 - (p.yaw || 0) * 0.25 + (LR ? -0.25 * (LR.squash || 0) : 0));
      const tk = p.talk || 0; bulb.material.emissiveIntensity = (2.2 + tk * 2.4 + Math.sin(t * 3) * 0.2) * (off > 0 ? lerp(1, 0.08, off) : 1); glow.intensity = (0.45 + tk * 0.6) * (off > 0 ? 1 - off : 1);
      if (sparkGlow) { const b = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 3.6) + seed), pl = clamp(p.plug || 0), boost = 1 + 0.8 * pl * Math.max(0, Math.sin(t * 7)) * (1 - pl * 0.5); spark.material.emissiveIntensity = (0.6 + 0.35 * b) * (off > 0 ? lerp(1, 0.25, off) : 1) * boost; sparkGlow.material.opacity = (0.3 + 0.22 * b) * (off > 0 ? 1 - off * 0.85 : 1) * boost;  if (markGlow) markGlow.material.opacity = (0.55 + 0.35 * b) * (off > 0 ? 1 - off * 0.8 : 1) * boost; }   // a slow breath, never a per-frame change
      // battery: castOpts batt (a fixed level) or fx batt; red under 30 % with a slow blink (1.1 s), amber, green when full
      const bt = p.batt ?? battDef; battG.visible = bt !== null && bt !== undefined;
      if (battG.visible) { const b = clamp(bt), lowK = clamp((0.3 - b) / 0.12), wv = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 1.1); battFill.scale.x = Math.max(0.06, b); battFill.position.x = -0.044 + 0.044 * Math.max(0.06, b);
        const col = b < 0.5 ? new THREE.Color(2.4, 0.22, 0.18).lerp(new THREE.Color(2.2, 1.4, 0.2), clamp((b - 0.3) / 0.2)) : new THREE.Color(2.2, 1.4, 0.2).lerp(new THREE.Color(0.35, 2.4, 0.5), clamp((b - 0.5) / 0.3)); battFill.material.color.copy(col).multiplyScalar(1.5 * (1 - 0.45 * lowK * wv)); battTrack.material.color.copy(col).multiplyScalar(0.32 * (1 - 0.4 * lowK * wv)); }
      slipUpdate(p, t);   // BEFORE the arms read slipHand (it used to run after them: the hand lagged by whatever this page had drawn last, which showed as a 10 Hz stutter)
      const tapK = clamp(p.tap || 0), fing = clamp(p.finger || 0);
      [[armL, handL, p.l, -1, 0], [armR, handR, p.r, 1, 1]].forEach(([a, hd, tg, s, i]) => { H[i].set(tg[0], tg[1] + hov * 0.5, tg[2]);
        if (tg[3]) { const wv = Math.max(0, 1 - Math.abs(tg[3] - 1)); H[i].x += Math.sin(t * 9.5) * 0.05 * wv; H[i].y += Math.sin(t * 9.5 + 1.2) * 0.02 * wv; }
        if (i === 1 && tapK > 0) H[i].z += tapK * 0.025 * Math.max(0, Math.sin(t * 9));
        if ((p.wipe || 0) > 0 && i === ((p.wipeR || 0) > 0.5 ? 1 : 0)) { const wk = clamp(p.wipe), cy = Math.sin(t * 6.5); H[i].y += wk * 0.04 * cy; H[i].x += wk * s * 0.012 * cy; H[i].z += wk * 0.01 * Math.sin(t * 6.5 + 1.5); }   // the finger strokes down the cheek and back
        if (i === 1 && slipHand.w > 0) H[1].lerp(slipHand.p, slipHand.w);
        if (LR && LR.amt > 0 && ride < 1) { const runK = LR.rk, f = (i ? 1 : -1) * LR.pump / Math.max(1e-3, LR.amt), k = LR.amt * (1 - ride) * (1 - tapK) * (Math.abs(tg[0]) > 0.3 ? 0.15 : 1);
          H[i].lerp(V(s * 0.21, 0.42 + 0.06 * runK + (0.12 * runK + 0.03) * Math.max(0, f), 0.06 + (0.1 + 0.1 * runK) * f), k * (1 - (tg[3] ? 0.5 : 0))); }
        if (ride > 0) { body.getWorldQuaternion(_q).invert(); _dn.set(0, -1, 0).applyQuaternion(_q); H[i].lerp(S0[i].clone().addScaledVector(_dn, 0.26).add(V(0, 0, 0.04 + 0.06 * rsw * (i ? 1 : -0.7))), ride); }
        if (rpg > 0) H[i].lerp(V(s * 0.17, 0.6 - 0.03 * rsw, 0.43 + 0.03 * rsw).lerp(V(s * 0.21, 0.4, 0.06), hideK), rpg);
        if (GL && i === 1) { const sp = clamp(p.sip || 0), env = smooth(sp / 0.3) * (1 - smooth((sp - 0.7) / 0.3)); H[1].copy(GH).lerp(SIPH, env); }   // arms hanging over Tèo's shoulders (hidden: down his back)
        armCtrl(S0[i], H[i], i === 1 && slipHand.w > 0 ? Math.max(0.3, S0[1].distanceTo(H[1]) * 1.1) : 0.3, s, C); a.set(S0[i], C, H[i]); hd.position.copy(H[i]); });
      finger.visible = fing > 0.5; if (finger.visible) { finger.position.copy(H[1]).add(V(0, 0.015, 0.02)); finger.rotation.set(0.6 * (H[1].z > 0.3 ? 1 : 0.2), 0, -0.2); }
      phone.visible = (p.phone || 0) > 0.5; if (phone.visible) { phone.position.copy(H[1]).add(V(-0.02, 0.07, 0.03)); phone.rotation.set(-0.35, 0.25, 0.08); }
      phoneUp.visible = (p.phoneUp || 0) > 0.5; if (phoneUp.visible) { phoneUp.position.copy(H[1]).add(V(-0.03, 0.09, 0.04)); phoneUp.rotation.set(0.05, Math.PI, -0.04); }
      cup.visible = (p.cup || 0) > 0.5; if (cup.visible) { cup.position.copy(H[1]).add(V(-0.03, 0.03, 0.04)); }
      if (GL) { const sp = clamp(p.sip || 0), tilt = smooth((sp - 0.35) / 0.1) * (1 - smooth((sp - 0.62) / 0.1)); GL.group.visible = true; GL.group.position.copy(H[1]).add(V(0, 0.035, 0)); GL.group.rotation.set(-0.42 * tilt, 0, 0); GL.group.updateWorldMatrix(true, false); GL.group.getWorldQuaternion(_gq).invert(); _up.set(0, 1, 0).applyQuaternion(_gq); GL.update(t, p.tea || 0, _up); }
      const hk = clamp(p.hearts || 0); hearts.forEach((m, i) => { m.visible = hk > 0.01; if (!m.visible) return; const u = ((t * 0.45 + i / 5) % 1), a = i * 1.3 + t * 1.1; m.position.set(Math.cos(a) * 0.32, 0.95 + LIFTB * stK + u * 0.4, Math.sin(a) * 0.2 + 0.1); m.material.opacity = hk * Math.sin(u * Math.PI) * 0.95; m.scale.setScalar(0.8 + 0.5 * Math.sin(u * Math.PI)); });
      const pl = clamp(p.plug || 0); cable.mesh.visible = plugLight.visible = pl > 0.01;
      if (cable.mesh.visible) { root.updateMatrixWorld(true); const a = root.worldToLocal(plateWorld(V())).add(V(0, -0.07, 0.02)), tgt = root.parent?.getObjectByName(p.plugTo || this.plugTo || 'bip')?.userData.api, b = tgt?.chestWorld ? root.worldToLocal(tgt.chestWorld(V()).add(V(0, -0.075, 0.02))) : a.clone().add(V(0.3, 0, 0.2)), e = a.clone().lerp(b, pl), mid = a.clone().add(e).multiplyScalar(0.5).add(V(0, -0.18 * (1 - 0.3 * pl), 0.05)); cable.set(a, mid, e); plugLight.position.copy(e); }
      floodP?.update(t, clamp(p.flood || 0), 1 - clamp(p.floodStop || 0));
      drawFace(p.face, tk, t, eyeK, clamp(p.tear || 0), p.faceX || null);
    },
    headWorld(out = V()) { return head.getWorldPosition(out); },
    chestWorld: plateWorld,
  };
  root.userData.api = api; return api;
}

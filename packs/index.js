// channel packs: each brings its sets and characters; the core (renderer, camera, lights, text, player) is shared
import { buildStall } from './trada/stall.js';
import { buildStreet } from './trada/street.js';
import { buildMarket } from './trada/market.js';
import { buildGate } from './trada/gate.js';
import { buildGtaWorld, GTA_CHARS } from './trada/gta_world.js';   // 19/11: set 'gta' + the bank people
import { SEA_CHARS } from './trada/gta_sea.js';   // 20/11: Linh, Đại ca, two police officers (gta6p3)
import { SHOP_CHARS } from './trada/gta_shop.js';
import { GA_CHARS } from './trada/gta_p2b_people.js';   // 20/11: ga, gas, bongden (gta6p2b)   // 20/11: Chị Lan (cast name `lan`)
import { P3B_CHARS } from './trada/gta_p3b_people.js';   // 21/11: baban, hangxom, den1..3 (gta6p3b)
import { buildZombieWorld } from './trada/world.js';
import { ZOMBIE_CHARS } from './trada/zombie.js';
import { makeChip } from './trada/chip.js';
import { makeTeo, makeBip } from './trada/chars.js';
import { makeBa, makeMe, makeKhach } from './trada/people.js';
import { buildBar } from './goat/bar.js';
import { buildCourt } from './goat/court.js';
import { buildPress } from './goat/press.js';
import { makeRon, makeLeo } from './goat/fans.js';
export const PACKS = {
  trada: { tone: 'agx', outline: { color: '#150f28', t: 0.009 }, defaultSet: 'stall', defaultCast: ['teo', 'bip'], sets: { stall: buildStall, street: buildStreet, market: buildMarket, gate: buildGate, zombie: buildZombieWorld, gta: buildGtaWorld }, chars: { ...ZOMBIE_CHARS, ...GTA_CHARS, ...SHOP_CHARS, ...SEA_CHARS, ...GA_CHARS, ...P3B_CHARS, chip: makeChip, teo: makeTeo, bip: makeBip, ba: makeBa, me: makeMe, khach: makeKhach } },
  goat: { tone: 'agx', outline: { color: '#140e24', t: 0.008 }, defaultSet: 'bar', defaultCast: ['ron', 'leo'], sets: { bar: buildBar, court: buildCourt, press: buildPress }, chars: { ron: makeRon, leo: makeLeo } },
};

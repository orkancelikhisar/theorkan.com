import './walk.css';
import terrainSheetUrl from '../../assets/walk/walk-terrain-v1.png?url';
import materialsSheetUrl from '../../assets/walk/walk-materials-v1.png?url';
import roomsAtlasAUrl from '../../assets/walk/walk-rooms-a-v1.png?url';
import roomsAtlasBUrl from '../../assets/walk/walk-rooms-b-v1.png?url';
import type { Program, ProgramContext } from '../../kernel/program';
import { getRegistry } from '../../kernel/registry';
import { PLACES, vignetteAt } from './walk-places';
import {
  crossoverInReach, decorationInReach, freshState, inspectDecoration, linger, offset, restoreState, step,
  type Direction, type WalkState,
} from './walk-engine';
import {
  BOAT_SPEC, BUILDINGS, LOW_TIDE_TILES, OVERWORLD_GRID, OW_H, OW_W, tileKindOf,
  type TileKind,
} from './walk-map';
import { ROOM_DECORATIONS } from './walk-decorations';
import {
  addCoastalArtifact, coastalSnapshot, markCoastalFlag, mutateCoastalMemory,
  readCoastalMemory, recordCoastalFootprint, recordCoastalFrequency,
  recordCoastalPhrase, subscribeCoastalMemory,
  type CoastalMemory, type CoastalWeather,
} from '../../coast/coastal-memory';

const STORAGE_KEY = 'walk.state.v2';
const TILE = 32;
const MOVE_MS = 128;
const REPEAT_DELAY_MS = 0;

interface Motion {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  startedAt: number;
}

interface TextureSet {
  terrain: HTMLImageElement;
  materials: HTMLImageElement;
  roomsA: HTMLImageElement;
  roomsB: HTMLImageElement;
}

interface Dom {
  overlay: HTMLDivElement;
  shell: HTMLElement;
  canvas: HTMLCanvasElement;
  zone: HTMLDivElement;
  steps: HTMLDivElement;
  prose: HTMLDivElement;
  prompt: HTMLDivElement;
  toast: HTMLDivElement;
  close: HTMLButtonElement;
  live: HTMLDivElement;
  controls: HTMLDivElement;
}

let dom: Dom | null = null;
let graphics: CanvasRenderingContext2D | null = null;
let state: WalkState = freshState();
let storedCtx: ProgramContext | null = null;
let abort: AbortController | null = null;
let resizeObserver: ResizeObserver | null = null;
let raf: number | null = null;
let lastFrameAt = 0;
let nextMoveAt = 0;
let motion: Motion | null = null;
let visualCol = state.pos.col;
let visualRow = state.pos.row;
let cameraCol = visualCol;
let cameraRow = visualRow;
let bumpUntil = 0;
let bumpDirection: Direction = 'down';
let toastUntil = 0;
let reducedMotion = false;
let dpr = 1;
let textures: TextureSet | null = null;
let renderedZone = '';
let renderedSteps = '';
let renderedProse = '';
let renderedPrompt = '';
let renderedToastVisible = false;
let activeObservation: string | null = null;
let coastMemory: CoastalMemory = readCoastalMemory();
let stopCoastalSubscription: (() => void) | null = null;
let currentTide = 0.5;
let currentWeather: CoastalWeather = 'clear';
let currentWindDegrees = 0;
let currentLighthouse = 0;
let impossibleUntil = 0;
let departureStartedAt = 0;
const lowTideKeys = new Set(LOW_TIDE_TILES.map((pos) => `${pos.col},${pos.row}`));
const heldDirections: Direction[] = [];

const COLORS = {
  void: '#090a0b',
  sea: '#10252b',
  seaDeep: '#0a171b',
  foam: '#74898a',
  grass: '#34493f',
  grassDark: '#21332d',
  path: '#746f60',
  pathDark: '#4e4b42',
  shore: '#857c64',
  salt: '#a19c85',
  wood: '#655040',
  woodLight: '#8e745d',
  wall: '#514e49',
  wallTop: '#817d72',
  floor: '#362f2b',
  bone: '#e8e6df',
  dim: '#a09b8e',
  rust: '#875b46',
  glow: '#c1b27d',
  shadow: 'rgba(0,0,0,.42)',
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ease(value: number): number {
  const t = clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
}

function hash(col: number, row: number): number {
  let value = Math.imul(col + 17, 374761393) ^ Math.imul(row + 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function loadImage(url: string): HTMLImageElement {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image;
}

function textureSource(kind: TileKind): { image: HTMLImageElement; quadrant: number } | null {
  if (!textures) return null;
  if (kind === 'water') return { image: textures.terrain, quadrant: 0 };
  if (kind === 'grass' || kind === 'tree') return { image: textures.terrain, quadrant: 1 };
  if (kind === 'path' || kind === 'shore' || kind === 'rock') return { image: textures.terrain, quadrant: 2 };
  if (kind === 'salt') return { image: textures.terrain, quadrant: 3 };
  if (kind === 'wall') return { image: textures.materials, quadrant: 0 };
  if (kind === 'pier' || kind === 'boat' || kind === 'door') return { image: textures.materials, quadrant: 1 };
  if (kind === 'floor') return { image: textures.materials, quadrant: 2 };
  if (kind === 'portal') return { image: textures.materials, quadrant: 3 };
  return null;
}

function drawTexture(g: CanvasRenderingContext2D, kind: TileKind, x: number, y: number): void {
  const source = textureSource(kind);
  if (!source || !source.image.complete || source.image.naturalWidth === 0) return;
  const halfW = source.image.naturalWidth / 2;
  const halfH = source.image.naturalHeight / 2;
  const sourceX = source.quadrant % 2 === 0 ? 0 : halfW;
  const sourceY = source.quadrant < 2 ? 0 : halfH;
  g.save();
  g.globalAlpha = kind === 'water' ? 0.2 : 0.14;
  g.globalCompositeOperation = 'soft-light';
  g.drawImage(source.image, sourceX, sourceY, halfW, halfH, x, y, TILE, TILE);
  g.restore();
}

function drawTile(g: CanvasRenderingContext2D, tile: string, col: number, row: number, x: number, y: number, now: number): void {
  const mappedKind = tileKindOf(tile);
  const kind = tile === 'l' && currentTide > 0.36 ? 'water' : mappedKind;
  if (kind === 'water') {
    g.fillStyle = COLORS.seaDeep;
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = COLORS.sea;
    g.fillRect(x, y + 3, TILE, TILE - 3);
    const phase = (now * 0.018 + col * 9 + row * 13) % 32;
    g.fillStyle = COLORS.foam;
    g.globalAlpha = 0.2 + currentTide * 0.22;
    g.fillRect(x + phase - 8, y + 8 + ((col + row) % 3) * 7, 9, 1);
    g.globalAlpha = 1;
  } else if (kind === 'grass') {
    g.fillStyle = COLORS.grassDark;
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = COLORS.grass;
    g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    const n = hash(col, row);
    g.fillStyle = n > 0.52 ? '#566658' : '#263a31';
    g.fillRect(x + 6 + Math.floor(n * 13), y + 8 + Math.floor(n * 9), 2, 4);
    g.fillRect(x + 18 + Math.floor(n * 5), y + 20, 1, 3);
  } else if (kind === 'path') {
    g.fillStyle = COLORS.pathDark;
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = COLORS.path;
    g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    g.fillStyle = '#8e8877';
    g.fillRect(x + 4, y + 6, 11, 1);
    g.fillRect(x + 18, y + 19, 9, 1);
    g.fillStyle = '#5d594e';
    g.fillRect(x + 13, y + 10, 1, 7);
  } else if (kind === 'shore') {
    g.fillStyle = COLORS.shore;
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#b2a98c';
    g.fillRect(x + 4, y + 8, 2, 1);
    g.fillRect(x + 19, y + 23, 4, 1);
  } else if (kind === 'salt') {
    g.fillStyle = '#777460';
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = COLORS.salt;
    g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    g.fillStyle = '#d4d0b7';
    g.fillRect(x + 7, y + 6, 1, 1);
    g.fillRect(x + 23, y + 18, 2, 1);
  } else if (kind === 'pier' || kind === 'boat') {
    g.fillStyle = '#392d27';
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = kind === 'boat' ? '#765748' : COLORS.wood;
    g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    g.fillStyle = COLORS.woodLight;
    if (kind === 'boat') {
      g.fillRect(x + 8, y, 1, TILE);
      g.fillRect(x + 23, y, 1, TILE);
    } else {
      g.fillRect(x, y + 7, TILE, 1);
      g.fillRect(x, y + 22, TILE, 1);
    }
    g.fillStyle = '#30241f';
    g.fillRect(x + 5, y + 4, 2, 2);
    g.fillRect(x + 25, y + 18, 2, 2);
  } else if (kind === 'floor' || kind === 'decor') {
    g.fillStyle = COLORS.floor;
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#4b413a';
    g.fillRect(x, y + 15, TILE, 1);
    g.fillRect(x + ((row + col) % 2) * 16, y, 1, TILE);
  } else if (kind === 'wall') {
    g.fillStyle = '#292827';
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = COLORS.wall;
    g.fillRect(x + 1, y + 4, TILE - 2, TILE - 5);
    g.fillStyle = COLORS.wallTop;
    g.fillRect(x, y, TILE, 5);
    g.fillStyle = '#343231';
    g.fillRect(x + 15, y + 8, 1, 21);
  } else if (kind === 'door') {
    g.fillStyle = COLORS.pathDark;
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = COLORS.wood;
    g.fillRect(x + 5, y + 1, 22, 30);
    g.fillStyle = COLORS.woodLight;
    g.fillRect(x + 7, y + 3, 18, 3);
    g.fillStyle = COLORS.glow;
    g.fillRect(x + 21, y + 17, 2, 2);
  } else if (kind === 'tree') {
    g.fillStyle = COLORS.grass;
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#3b2d25';
    g.fillRect(x + 14, y + 19, 5, 12);
    g.fillStyle = '#182a24';
    g.fillRect(x + 5, y + 7, 23, 17);
    g.fillStyle = '#496153';
    g.fillRect(x + 9, y + 3, 15, 17);
    g.fillStyle = '#687768';
    g.fillRect(x + 11, y + 5, 7, 3);
  } else if (kind === 'rock') {
    g.fillStyle = COLORS.grass;
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#4b4d49';
    g.fillRect(x + 7, y + 12, 19, 14);
    g.fillStyle = '#777870';
    g.fillRect(x + 10, y + 9, 12, 5);
    g.fillStyle = '#2d302f';
    g.fillRect(x + 20, y + 18, 5, 7);
  } else if (kind === 'portal') {
    g.fillStyle = COLORS.floor;
    g.fillRect(x, y, TILE, TILE);
    const pulse = 0.55 + Math.sin(now * 0.004 + col) * 0.2;
    g.fillStyle = tile === 'd' ? '#8d7778' : tile === 'U' ? '#789ca0' : tile === 'I' ? '#927e9b' : COLORS.glow;
    g.globalAlpha = pulse;
    g.fillRect(x + 8, y + 8, 16, 16);
    g.fillStyle = COLORS.void;
    g.fillRect(x + 11, y + 11, 10, 10);
    g.fillStyle = COLORS.bone;
    g.globalAlpha = 0.85;
    g.font = 'bold 9px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(tile === 'I' ? '↺' : tile === 'H' ? '·' : tile, x + 16, y + 16);
    g.globalAlpha = 1;
  }
  drawTexture(g, kind, x, y);
}

function drawRoomDecorations(g: CanvasRenderingContext2D, cameraX: number, cameraY: number, now: number): void {
  if (!textures) return;
  const reachable = decorationInReach(state);
  for (const decoration of ROOM_DECORATIONS) {
    const image = decoration.atlas === 'rooms-a' ? textures.roomsA : textures.roomsB;
    if (!image.complete || image.naturalWidth === 0) continue;
    const x = Math.round((decoration.x - cameraX) * TILE);
    const y = Math.round((decoration.y - cameraY) * TILE);
    const width = decoration.w * TILE;
    const height = decoration.h * TILE;
    if (x + width < 0 || y + height < 0 || x > (dom?.canvas.clientWidth ?? 0) || y > (dom?.canvas.clientHeight ?? 0)) continue;
    const sourceWidth = image.naturalWidth / 2;
    const sourceHeight = image.naturalHeight / 2;
    const sourceX = decoration.quadrant % 2 === 0 ? 0 : sourceWidth;
    const sourceY = decoration.quadrant < 2 ? 0 : sourceHeight;
    g.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
    const isReachable = reachable?.id === decoration.id;
    g.strokeStyle = isReachable ? COLORS.glow : 'rgba(193,178,125,.22)';
    g.globalAlpha = isReachable ? 0.55 + Math.sin(now * 0.006) * 0.2 : 1;
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.globalAlpha = 1;
  }
}

function drawVisitorResidue(g: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
  const footprints = coastMemory.footprints.slice(-42);
  g.fillStyle = '#c4bda9';
  for (let index = 0; index < footprints.length; index++) {
    const footprint = footprints[index];
    const x = (footprint.col - cameraX) * TILE + 12 + (index % 2) * 6;
    const y = (footprint.row - cameraY) * TILE + 15;
    g.globalAlpha = 0.025 + (index / Math.max(1, footprints.length)) * 0.12;
    g.fillRect(Math.round(x), Math.round(y), 2, 4);
    g.fillRect(Math.round(x + 4), Math.round(y + 5), 2, 3);
  }
  g.globalAlpha = 1;

  const phrases = coastMemory.phrases.slice(-4);
  const shoreSpots = [
    { col: 9, row: 20 }, { col: 8, row: 26 },
    { col: 10, row: 32 }, { col: 11, row: 39 },
  ];
  g.font = '6px monospace';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = '#c8c4b4';
  for (let index = 0; index < phrases.length; index++) {
    const spot = shoreSpots[(index + coastMemory.sessionCount) % shoreSpots.length];
    const x = (spot.col - cameraX) * TILE;
    const y = (spot.row - cameraY) * TILE;
    g.globalAlpha = phrases[index].rescued ? 0.5 : 0.27;
    g.fillText(phrases[index].text.slice(0, 22), Math.round(x), Math.round(y));
  }
  g.globalAlpha = 1;
}

function drawLighthouse(g: CanvasRenderingContext2D, cameraX: number, cameraY: number, now: number): void {
  const x = (2.5 - cameraX) * TILE;
  const y = (16.95 - cameraY) * TILE;
  g.fillStyle = 'rgba(0,0,0,.42)';
  g.fillRect(x - 10, y + 15, 22, 5);
  g.fillStyle = '#4b4945';
  g.fillRect(x - 7, y - 24, 14, 40);
  g.fillStyle = '#8a8170';
  g.fillRect(x - 5, y - 21, 10, 3);
  g.fillRect(x - 5, y - 4, 10, 3);
  g.fillStyle = '#202425';
  g.fillRect(x - 9, y - 30, 18, 7);
  g.fillStyle = '#d8cfa8';
  g.globalAlpha = 0.55 + Math.sin(now * .008) * .15;
  g.fillRect(x - 4, y - 28, 8, 3);
  if (currentLighthouse > 0.02) {
    const beam = 180 + currentWindDegrees * 0.08;
    const gradient = g.createLinearGradient(x, y - 27, x + beam, y - 44);
    gradient.addColorStop(0, `rgba(216,207,168,${currentLighthouse * .22})`);
    gradient.addColorStop(1, 'rgba(216,207,168,0)');
    g.fillStyle = gradient;
    g.beginPath();
    g.moveTo(x, y - 30);
    g.lineTo(x + beam, y - 55);
    g.lineTo(x + beam, y - 29);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
}

function drawWalkWeather(g: CanvasRenderingContext2D, width: number, height: number, now: number): void {
  if (currentWeather === 'clear') return;
  if (currentWeather === 'mist' || currentWeather === 'rain' || currentWeather === 'storm') {
    const fog = g.createLinearGradient(0, 0, width, height);
    fog.addColorStop(0, 'rgba(137,151,146,.02)');
    fog.addColorStop(.6, currentWeather === 'mist' ? 'rgba(137,151,146,.1)' : 'rgba(137,151,146,.045)');
    fog.addColorStop(1, 'rgba(137,151,146,.015)');
    g.fillStyle = fog;
    g.fillRect(0, 0, width, height);
  }
  if (currentWeather === 'rain' || currentWeather === 'storm') {
    const count = currentWeather === 'storm' ? 74 : 38;
    g.strokeStyle = currentWeather === 'storm' ? 'rgba(180,194,190,.24)' : 'rgba(180,194,190,.14)';
    g.lineWidth = 1;
    g.beginPath();
    for (let index = 0; index < count; index++) {
      const x = (index * 73 + now * (currentWeather === 'storm' ? .35 : .2)) % (width + 60) - 30;
      const y = (index * 47 + now * .26) % (height + 40) - 20;
      const slant = 3 + Math.sin(currentWindDegrees * Math.PI / 180) * 8;
      g.moveTo(x, y);
      g.lineTo(x + slant, y + (currentWeather === 'storm' ? 15 : 10));
    }
    g.stroke();
  }
}

function drawDeparture(g: CanvasRenderingContext2D, width: number, height: number, now: number): void {
  if (departureStartedAt <= 0) return;
  const progress = clamp((now - departureStartedAt) / 11_500, 0, 1);
  g.fillStyle = `rgba(5,8,10,${Math.max(0, progress - .18) * .92})`;
  g.fillRect(0, 0, width, height);
  g.fillStyle = `rgba(232,230,223,${Math.sin(progress * Math.PI) * .7})`;
  g.font = '10px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const line = progress < .36 ? 'the bowline gives.'
    : progress < .7 ? 'the harbor becomes small enough to mistake for memory.'
      : 'you had everything you needed. none of it was for you.';
  g.fillText(line, width / 2, height / 2);
}

function drawBoat(g: CanvasRenderingContext2D, cameraX: number, cameraY: number, now: number): void {
  const left = (BOAT_SPEC.left - cameraX) * TILE;
  const right = (BOAT_SPEC.right + 1 - cameraX) * TILE;
  const top = (BOAT_SPEC.top - cameraY) * TILE;
  const shoulder = (BOAT_SPEC.top + 2 - cameraY) * TILE;
  const bottom = (BOAT_SPEC.bottom + 1 - cameraY) * TILE;
  const center = ((BOAT_SPEC.left + BOAT_SPEC.right + 1) / 2 - cameraX) * TILE;
  const width = dom?.canvas.clientWidth ?? 0;
  const height = dom?.canvas.clientHeight ?? 0;
  if (right + 14 < 0 || left - 14 > width || bottom + 14 < 0 || top - 14 > height) return;

  // Moving wake and the heavy water-shadow make the deck read as a vessel,
  // not as another rectangular patch of pier.
  const wake = Math.sin(now * 0.003) * 3;
  g.save();
  g.lineJoin = 'miter';
  g.lineCap = 'square';
  g.strokeStyle = 'rgba(116,137,138,.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(left - 10 - wake, shoulder + 5);
  g.lineTo(left - 16 + wake, bottom + 11);
  g.moveTo(right + 10 + wake, shoulder + 5);
  g.lineTo(right + 16 - wake, bottom + 11);
  g.stroke();

  const hullPath = () => {
    g.beginPath();
    g.moveTo(center, top - 10);
    g.lineTo(right + 5, shoulder);
    g.lineTo(right + 3, bottom + 5);
    g.lineTo(left - 3, bottom + 5);
    g.lineTo(left - 5, shoulder);
    g.closePath();
  };
  hullPath();
  g.strokeStyle = '#17191a';
  g.lineWidth = 9;
  g.stroke();
  hullPath();
  g.strokeStyle = '#a48367';
  g.lineWidth = 4;
  g.stroke();
  hullPath();
  g.strokeStyle = '#50372d';
  g.lineWidth = 2;
  g.stroke();

  // Keel, hatch, mast, furled sail and rigging are deliberately oversized
  // enough to remain legible at the scene's native 32px tile scale.
  g.strokeStyle = 'rgba(28,20,17,.62)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(center, top + 11);
  g.lineTo(center, bottom - 7);
  g.stroke();

  const hatchX = (BOAT_SPEC.left + 1 - cameraX) * TILE + 7;
  const hatchY = (4.7 - cameraY) * TILE;
  g.fillStyle = '#241c19';
  g.fillRect(hatchX, hatchY, 20, 17);
  g.fillStyle = '#98775e';
  g.fillRect(hatchX + 2, hatchY + 2, 16, 2);
  g.fillRect(hatchX + 2, hatchY + 13, 16, 2);
  g.fillStyle = '#c1b27d';
  g.fillRect(hatchX + 15, hatchY + 7, 2, 2);

  const mastX = (BOAT_SPEC.mastCol - cameraX) * TILE;
  const mastY = (BOAT_SPEC.mastRow - cameraY) * TILE;
  g.strokeStyle = 'rgba(12,13,14,.55)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(mastX + 3, mastY + 3);
  g.lineTo(mastX + 43, mastY + 10);
  g.stroke();
  g.strokeStyle = '#b08b69';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(mastX, mastY);
  g.lineTo(mastX + 40, mastY + 5);
  g.stroke();
  g.strokeStyle = '#514238';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(mastX + 5, mastY - 3);
  g.lineTo(mastX + 36, mastY + 1);
  g.stroke();
  g.fillStyle = '#d1c19d';
  g.fillRect(mastX - 3, mastY - 3, 7, 7);

  g.strokeStyle = 'rgba(201,188,153,.5)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(mastX, mastY);
  g.lineTo(center, top - 5);
  g.moveTo(mastX, mastY);
  g.lineTo(left + 5, bottom);
  g.moveTo(mastX, mastY);
  g.lineTo(right - 5, bottom);
  g.stroke();
  g.restore();
}

function drawBuildingAccents(g: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
  for (const building of BUILDINGS) {
    const x = (building.x - cameraX) * TILE;
    const y = (building.y - cameraY) * TILE;
    const width = building.w * TILE;
    if (x + width < 0 || x > (dom?.canvas.clientWidth ?? 0)) continue;
    const accent = building.accent === 'rust' ? COLORS.rust
      : building.accent === 'cool' ? '#55717a'
        : building.accent === 'void' ? '#514354' : '#8b7656';
    g.fillStyle = accent;
    g.globalAlpha = 0.7;
    g.fillRect(x + 4, y + 5, width - 8, 3);
    g.globalAlpha = 1;
    g.fillStyle = COLORS.bone;
    g.font = 'bold 8px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(PLACES[building.id]?.title.replace(/^the /, '') ?? building.id, x + width / 2, y + 9);
  }
}

function drawPlayer(g: CanvasRenderingContext2D, x: number, y: number, now: number): void {
  const moving = Boolean(motion) || heldDirections.length > 0;
  const stepFrame = moving ? Math.floor(now / 115) % 2 : 0;
  const bob = moving && !reducedMotion ? Math.sin(now * 0.018) * 1.1 : 0;
  const bumpProgress = now < bumpUntil ? Math.sin(((bumpUntil - now) / 150) * Math.PI) * 3 : 0;
  const bumpX = bumpDirection === 'left' ? -bumpProgress : bumpDirection === 'right' ? bumpProgress : 0;
  const bumpY = bumpDirection === 'up' ? -bumpProgress : bumpDirection === 'down' ? bumpProgress : 0;
  const px = Math.round(x + TILE / 2 + bumpX);
  const py = Math.round(y + TILE / 2 + bumpY + bob);

  g.fillStyle = COLORS.shadow;
  g.fillRect(px - 7, py + 8, 14, 4);
  g.fillStyle = '#24211f';
  g.fillRect(px - 5, py - 10, 10, 7);
  g.fillStyle = '#b9a58a';
  g.fillRect(px - 4, py - 8, 8, 7);
  g.fillStyle = '#283942';
  g.fillRect(px - 6, py - 2, 12, 11);
  g.fillStyle = '#718390';
  if (state.facing === 'up') g.fillRect(px - 3, py, 6, 6);
  if (state.facing === 'down') g.fillRect(px - 1, py, 2, 5);
  if (state.facing === 'left') g.fillRect(px - 5, py, 2, 5);
  if (state.facing === 'right') g.fillRect(px + 3, py, 2, 5);
  g.fillStyle = '#18191b';
  g.fillRect(px - 5, py + 8, 4, stepFrame ? 4 : 3);
  g.fillRect(px + 1, py + 8, 4, stepFrame ? 3 : 4);
}

function canvasSize(): { width: number; height: number } {
  if (!dom) return { width: 1, height: 1 };
  return { width: Math.max(1, dom.canvas.clientWidth), height: Math.max(1, dom.canvas.clientHeight) };
}

function resizeCanvas(): void {
  if (!dom || !graphics) return;
  const { width, height } = canvasSize();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (dom.canvas.width !== pixelWidth || dom.canvas.height !== pixelHeight) {
    dom.canvas.width = pixelWidth;
    dom.canvas.height = pixelHeight;
  }
  graphics.setTransform(dpr, 0, 0, dpr, 0, 0);
  graphics.imageSmoothingEnabled = false;
}

function updateMotion(now: number): void {
  if (!motion) {
    visualCol = state.pos.col;
    visualRow = state.pos.row;
    return;
  }
  const t = reducedMotion ? 1 : ease((now - motion.startedAt) / MOVE_MS);
  visualCol = motion.fromCol + (motion.toCol - motion.fromCol) * t;
  visualRow = motion.fromRow + (motion.toRow - motion.fromRow) * t;
  if (t >= 1) {
    visualCol = motion.toCol;
    visualRow = motion.toRow;
    motion = null;
  }
}

function saveState(): void {
  try { storedCtx?.storage.set(STORAGE_KEY, state); } catch { /* persistence is tender */ }
}

function tileInReach(tile: string): boolean {
  if (OVERWORLD_GRID[state.pos.row]?.[state.pos.col] === tile) return true;
  const ahead = offset(state.pos, state.facing);
  return OVERWORLD_GRID[ahead.row]?.[ahead.col] === tile;
}

function latestWashedPhrase(): string | null {
  return coastMemory.phrases[coastMemory.phrases.length - 1]?.text ?? null;
}

function renderText(now: number): void {
  if (!dom) return;
  const place = state.currentZone ? PLACES[state.currentZone] : null;
  const zone = place?.title ?? 'between places';
  const steps = `${String(state.totalSteps).padStart(4, '0')} steps`;
  if (zone !== renderedZone) {
    dom.zone.textContent = zone;
    renderedZone = zone;
  }
  if (steps !== renderedSteps) {
    dom.steps.textContent = steps;
    renderedSteps = steps;
  }
  if (place) {
    const visits = state.visits[place.id] ?? 1;
    const prose = activeObservation ?? vignetteAt(place.id, visits);
    if (prose !== renderedProse) {
      dom.prose.textContent = prose;
      renderedProse = prose;
    }
  }
  const crossover = crossoverInReach(state);
  const decoration = crossover ? null : decorationInReach(state);
  const coast = coastalSnapshot(coastMemory);
  let prompt = 'A  observe';
  if (crossover) {
    const currentPlace = state.currentZone ? PLACES[state.currentZone] : null;
    const hint = currentPlace?.crossover?.hint ?? `enter ${crossover.command}`;
    prompt = `A  ${hint}`;
  } else if (decoration) {
    prompt = `A  ${decoration.prompt}`;
  } else if (tileInReach('I')) {
    prompt = 'A  open the room that cannot fit';
  } else if (tileInReach('H')) {
    prompt = 'A  listen through the lighthouse';
  } else if (state.currentZone === 'boat') {
    prompt = coast.departureReady ? 'A  untie the boat' : 'A  inspect the mooring';
  } else if (state.currentZone === 'shore' && latestWashedPhrase()) {
    prompt = 'A  read what washed ashore';
  }
  if (prompt !== renderedPrompt) {
    dom.prompt.textContent = prompt;
    dom.prompt.classList.toggle('is-visible', Boolean(
      crossover || decoration || tileInReach('I') || tileInReach('H') || state.currentZone === 'boat'
      || (state.currentZone === 'shore' && latestWashedPhrase()),
    ));
    renderedPrompt = prompt;
  }
  const toastVisible = now < toastUntil;
  if (toastVisible !== renderedToastVisible) {
    dom.toast.classList.toggle('is-visible', toastVisible);
    renderedToastVisible = toastVisible;
  }
}

function render(now: number): void {
  if (!dom || !graphics) return;
  resizeCanvas();
  const g = graphics;
  const { width, height } = canvasSize();
  g.clearRect(0, 0, width, height);
  g.fillStyle = COLORS.void;
  g.fillRect(0, 0, width, height);

  const coast = coastalSnapshot(coastMemory, Date.now());
  currentTide = coast.tide;
  currentWeather = coast.weather;
  currentWindDegrees = coast.windDegrees;
  currentLighthouse = coast.lighthouse;

  const cameraX = cameraCol - width / TILE / 2;
  const departureProgress = departureStartedAt > 0 ? clamp((now - departureStartedAt) / 11_500, 0, 1) : 0;
  const cameraY = cameraRow - height / TILE / 2 - departureProgress * 9;
  const startCol = Math.max(0, Math.floor(cameraX) - 1);
  const endCol = Math.min(OW_W, Math.ceil(cameraX + width / TILE) + 1);
  const startRow = Math.max(0, Math.floor(cameraY) - 1);
  const endRow = Math.min(OW_H, Math.ceil(cameraY + height / TILE) + 1);

  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const x = Math.round((col - cameraX) * TILE);
      const y = Math.round((row - cameraY) * TILE);
      drawTile(g, OVERWORLD_GRID[row][col], col, row, x, y, now);
    }
  }
  drawVisitorResidue(g, cameraX, cameraY);
  drawLighthouse(g, cameraX, cameraY, now);
  drawRoomDecorations(g, cameraX, cameraY, now);
  drawBoat(g, cameraX, cameraY, now);
  drawBuildingAccents(g, cameraX, cameraY);
  const playerX = (visualCol - cameraX) * TILE;
  const playerY = (visualRow - cameraY) * TILE;
  drawPlayer(g, playerX, playerY, now);

  // Sparse airborne salt and sea spray tie the camera to the coast.
  g.fillStyle = COLORS.bone;
  for (let i = 0; i < 14; i++) {
    const x = (i * 83 + now * (0.006 + i * 0.0003)) % (width + 40) - 20;
    const y = (i * 47 + Math.sin(now * 0.0008 + i) * 19) % Math.max(1, height);
    g.globalAlpha = 0.07 + (i % 3) * 0.025;
    g.fillRect(Math.round(x), Math.round(y), i % 4 === 0 ? 2 : 1, 1);
  }
  g.globalAlpha = 1;
  if (now < impossibleUntil) {
    g.fillStyle = `rgba(120,94,130,${0.035 + Math.sin(now * .012) * .018})`;
    for (let x = 0; x < width; x += 48) g.fillRect(x, 0, 1, height);
  }
  drawWalkWeather(g, width, height, now);
  drawDeparture(g, width, height, now);
  renderText(now);
}

function performStep(direction: Direction, now: number): void {
  if (motion || departureStartedAt > 0) return;
  const before = { ...state.pos };
  const attempted = offset(state.pos, direction);
  const tide = coastalSnapshot(coastMemory).tide;
  const result = step(state, direction, (pos) => lowTideKeys.has(`${pos.col},${pos.row}`) && tide > 0.36);
  state = result.state;
  if (result.bumped) {
    bumpUntil = now + 150;
    bumpDirection = direction;
    storedCtx?.audio.play('shell.error');
    if (lowTideKeys.has(`${attempted.col},${attempted.row}`) && tide > 0.36 && dom) {
      dom.toast.textContent = 'the causeway is below the tide';
      toastUntil = now + 1_700;
    }
  } else {
    activeObservation = null;
    if (state.totalSteps % 2 === 0) {
      coastMemory = recordCoastalFootprint(state.pos.col, state.pos.row);
    }
    const steppedKind = tileKindOf(OVERWORLD_GRID[state.pos.row][state.pos.col]);
    const footstep = steppedKind === 'pier' || steppedKind === 'boat' || steppedKind === 'floor' ? 'walk.wood'
      : steppedKind === 'salt' ? 'walk.salt'
        : steppedKind === 'grass' ? 'walk.grass' : 'walk.stone';
    storedCtx?.audio.play(footstep);
    motion = {
      fromCol: before.col,
      fromRow: before.row,
      toCol: state.pos.col,
      toRow: state.pos.row,
      startedAt: now,
    };
    if (result.enteredZone) {
      toastUntil = now + 1_500;
      if (dom) dom.toast.textContent = PLACES[result.enteredZone]?.title ?? result.enteredZone;
    }
    saveState();
  }
  nextMoveAt = now + MOVE_MS + REPEAT_DELAY_MS;
}

function tick(now: number): void {
  if (!dom) return;
  if (departureStartedAt > 0 && now - departureStartedAt >= 11_500) {
    const ctx = storedCtx;
    departureStartedAt = -1;
    close();
    ctx?.println('the harbor is behind you. the prompt remains, very far away.');
    return;
  }
  const dt = Math.min(0.05, Math.max(0, (now - lastFrameAt) / 1000));
  lastFrameAt = now;
  updateMotion(now);
  if (!motion && heldDirections.length && now >= nextMoveAt) {
    performStep(heldDirections[heldDirections.length - 1], now);
  }
  const cameraEase = reducedMotion ? 1 : 1 - Math.exp(-dt * 8.5);
  cameraCol += (visualCol - cameraCol) * cameraEase;
  cameraRow += (visualRow - cameraRow) * cameraEase;
  const { width, height } = canvasSize();
  const halfCols = width / TILE / 2;
  const halfRows = height / TILE / 2;
  cameraCol = clamp(cameraCol, Math.min(halfCols, OW_W / 2), Math.max(OW_W - halfCols, OW_W / 2));
  cameraRow = clamp(cameraRow, Math.min(halfRows, OW_H / 2), Math.max(OW_H - halfRows, OW_H / 2));
  render(now);
  raf = requestAnimationFrame(tick);
}

function keyToDirection(key: string): Direction | null {
  if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === 'k') return 'up';
  if (key === 'ArrowDown' || key === 's' || key === 'S' || key === 'j') return 'down';
  if (key === 'ArrowLeft' || key === 'a' || key === 'A' || key === 'h') return 'left';
  if (key === 'ArrowRight' || key === 'd' || key === 'D' || key === 'l') return 'right';
  return null;
}

function hold(direction: Direction): void {
  if (departureStartedAt > 0) return;
  const index = heldDirections.indexOf(direction);
  if (index >= 0) heldDirections.splice(index, 1);
  heldDirections.push(direction);
  if (!motion) performStep(direction, performance.now());
}

function release(direction: Direction): void {
  const index = heldDirections.indexOf(direction);
  if (index >= 0) heldDirections.splice(index, 1);
}

function dispatchCrossover(crossover: NonNullable<ReturnType<typeof crossoverInReach>>): void {
  const ctx = storedCtx;
  if (!ctx) return;
  if (crossover.command === 'music') {
    coastMemory = recordCoastalFrequency('90.7 MHz / harbor carrier');
  }
  close();
  const program = getRegistry().get(crossover.command);
  if (!program) return;
  ctx.events.emit('shell:program-launched', { name: program.name });
  const argv = [crossover.command, ...(crossover.argv ?? [])];
  try {
    if (program.onCommand) {
      const output = program.onCommand(ctx, argv);
      if (typeof output === 'string') ctx.println(output);
    } else if (program.init) void program.init(ctx);
  } catch (error) {
    ctx.println(`walk: could not enter — ${(error as Error).message}`);
  }
}

function beginDeparture(): void {
  if (!dom || departureStartedAt > 0) return;
  departureStartedAt = performance.now();
  heldDirections.length = 0;
  activeObservation = 'the knot is wet, but it remembers your hands.';
  dom.toast.textContent = 'the boat is leaving';
  toastUntil = departureStartedAt + 2_400;
  coastMemory = mutateCoastalMemory((memory) => { memory.departedAt = Date.now(); });
}

function interact(): void {
  if (departureStartedAt > 0) return;
  const crossover = crossoverInReach(state);
  if (crossover) {
    dispatchCrossover(crossover);
    return;
  }
  const decoration = decorationInReach(state);
  if (decoration) {
    const inspected = inspectDecoration(state, decoration);
    state = inspected.state;
    activeObservation = inspected.text;
    saveState();
    if (dom) {
      dom.toast.textContent = decoration.name;
      toastUntil = performance.now() + 1_500;
      const inventory = decoration.id === 'empty-evidence'
        ? `\n\ninside the drawer: ${coastMemory.artifacts.length ? coastMemory.artifacts.join(' / ') : 'only dust'}.\nthe word CABINET is scratched under the handle.`
        : '';
      activeObservation += inventory;
      dom.live.textContent = `${inspected.text}${inventory}`;
    }
    return;
  }
  if (tileInReach('I')) {
    impossibleUntil = performance.now() + 7_500;
    activeObservation = 'the room continues behind the wall that contains it.\nthrough its window: this room, and you, still outside.';
    coastMemory = mutateCoastalMemory((memory) => { memory.impossibleRoomSeen = true; });
    coastMemory = addCoastalArtifact('impossible-room');
    if (dom) {
      dom.toast.textContent = 'dimensions disagree';
      toastUntil = performance.now() + 1_800;
      dom.live.textContent = activeObservation;
    }
    return;
  }
  if (tileInReach('H')) {
    const phrase = latestWashedPhrase() ?? 'the beam crosses an empty frequency';
    activeObservation = `inside the lens, the light is speaking in intervals:\n${phrase}\n\nthe last interval is exactly long enough to mean RETURN.`;
    coastMemory = addCoastalArtifact('lighthouse-code');
    markCoastalFlag('lighthousePasses');
    if (dom) {
      dom.toast.textContent = 'transmission received';
      toastUntil = performance.now() + 2_000;
      dom.live.textContent = activeObservation;
    }
    return;
  }
  if (state.currentZone === 'boat') {
    const coast = coastalSnapshot(coastMemory);
    if (coast.departureReady) {
      beginDeparture();
    } else {
      const names: Record<string, string> = {
        'rescued-line': 'a line caught by dilenci',
        'radio-frequency': 'a harbor frequency',
        'undertow-line': 'something given to the water',
        'studio-image': 'an unfinished image',
        'stowaway-name': 'the name of who boarded with you',
      };
      activeObservation = `the bowline holds.\nstill missing: ${coast.missingDepartureArtifacts.map((id) => names[id] ?? id).join('; ')}.`;
      if (dom) dom.live.textContent = activeObservation;
    }
    return;
  }
  const washed = state.currentZone === 'shore' ? latestWashedPhrase() : null;
  if (washed) {
    activeObservation = `between weed and salt:\n“${washed}”\n\nthe water has changed one thing you cannot locate.`;
    coastMemory = recordCoastalPhrase(washed, 'shore');
    if (dom) dom.live.textContent = activeObservation;
    return;
  }
  state = linger(state);
  activeObservation = null;
  saveState();
  if (dom && state.currentZone) {
    dom.live.textContent = vignetteAt(state.currentZone, state.visits[state.currentZone] ?? 1);
  }
}

function attachInput(): void {
  if (!dom || !abort) return;
  const signal = abort.signal;
  document.addEventListener('keydown', (event) => {
    if (!dom) return;
    const direction = keyToDirection(event.key);
    if (direction) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) hold(direction);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) interact();
      return;
    }
    if (event.key === 'Escape' || event.key === 'q' || event.key === 'Q') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }, { capture: true, signal });
  document.addEventListener('keyup', (event) => {
    const direction = keyToDirection(event.key);
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    release(direction);
  }, { capture: true, signal });
  window.addEventListener('blur', () => { heldDirections.length = 0; }, { signal });

  dom.controls.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach((button) => {
    const direction = button.dataset.direction as Direction;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      hold(direction);
    }, { signal });
    const stop = () => release(direction);
    button.addEventListener('pointerup', stop, { signal });
    button.addEventListener('pointercancel', stop, { signal });
  });
  dom.controls.querySelector<HTMLButtonElement>('[data-action]')?.addEventListener('click', interact, { signal });
}

function makeDom(): Dom {
  const overlay = document.createElement('div');
  overlay.className = 'walk-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'walk-zone');

  const shell = document.createElement('section');
  shell.className = 'walk-shell';
  const header = document.createElement('header');
  header.className = 'walk-header';
  const brand = document.createElement('div');
  brand.className = 'walk-header__brand';
  brand.textContent = 'ORKAN / COASTAL MEMORY';
  const zone = document.createElement('div');
  zone.id = 'walk-zone';
  zone.className = 'walk-header__zone';
  const steps = document.createElement('div');
  steps.className = 'walk-header__steps';
  const closeButton = document.createElement('button');
  closeButton.className = 'walk-header__close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'leave walk');
  closeButton.textContent = '×';
  header.append(brand, zone, steps, closeButton);

  const body = document.createElement('div');
  body.className = 'walk-body';
  const viewport = document.createElement('div');
  viewport.className = 'walk-viewport';
  const canvas = document.createElement('canvas');
  canvas.className = 'walk-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A top-down pixel-art harbor village. Use arrow keys or WASD to walk.');
  const toast = document.createElement('div');
  toast.className = 'walk-toast';
  const prompt = document.createElement('div');
  prompt.className = 'walk-prompt';
  viewport.append(canvas, toast, prompt);

  const story = document.createElement('aside');
  story.className = 'walk-story';
  const storyMark = document.createElement('div');
  storyMark.className = 'walk-story__mark';
  storyMark.textContent = 'FIELD NOTE';
  const prose = document.createElement('div');
  prose.className = 'walk-story__prose';
  story.append(storyMark, prose);
  body.append(viewport, story);

  const controls = document.createElement('div');
  controls.className = 'walk-controls';
  controls.innerHTML = `
    <div class="walk-dpad" aria-label="movement controls">
      <button type="button" data-direction="up" aria-label="walk up">↑</button>
      <button type="button" data-direction="left" aria-label="walk left">←</button>
      <button type="button" data-direction="down" aria-label="walk down">↓</button>
      <button type="button" data-direction="right" aria-label="walk right">→</button>
    </div>
    <button class="walk-action" type="button" data-action aria-label="interact">A</button>`;

  const footer = document.createElement('footer');
  footer.className = 'walk-footer';
  footer.innerHTML = '<span>MOVE&nbsp; arrows / wasd</span><span>INTERACT&nbsp; space / enter</span><span>LEAVE&nbsp; esc / q</span>';
  const live = document.createElement('div');
  live.className = 'walk-sr';
  live.setAttribute('aria-live', 'polite');
  shell.append(header, body, controls, footer, live);
  overlay.append(shell);
  return { overlay, shell, canvas, zone, steps, prose, prompt, toast, close: closeButton, live, controls };
}

function close(): void {
  if (!dom) return;
  saveState();
  abort?.abort();
  abort = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  stopCoastalSubscription?.();
  stopCoastalSubscription = null;
  if (raf != null) cancelAnimationFrame(raf);
  raf = null;
  heldDirections.length = 0;
  dom.overlay.remove();
  dom = null;
  graphics = null;
  storedCtx?.events.emit('shell:modal-ended', { name: 'walk' });
  storedCtx = null;
  const input = document.querySelector('.terminal__input');
  if (input instanceof HTMLElement) input.focus();
}

const program: Program = {
  name: 'walk',
  aliases: ['wander'],
  manpage:
    'walk — explore a remembered harbor as a top-down adventure.\n' +
    '  arrows / wasd / hjkl move; turns are buffered and animated.\n' +
    '  space or enter interacts with the tile you face.\n' +
    '  rooms, shorelines, and devices contain other programs.\n' +
    '  q or escape leaves. position and visits persist.',
  category: 'info',
  mode: 'modal',
  overlaySelector: '.walk-overlay',
  init: (ctx) => {
    if (dom) return;
    storedCtx = ctx;
    coastMemory = readCoastalMemory();
    stopCoastalSubscription = subscribeCoastalMemory((memory) => { coastMemory = memory; });
    try { state = restoreState(ctx.storage.get(STORAGE_KEY)); } catch { state = freshState(); }
    visualCol = state.pos.col;
    visualRow = state.pos.row;
    cameraCol = visualCol;
    cameraRow = visualRow;
    motion = null;
    departureStartedAt = 0;
    impossibleUntil = 0;
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    textures = {
      terrain: loadImage(terrainSheetUrl),
      materials: loadImage(materialsSheetUrl),
      roomsA: loadImage(roomsAtlasAUrl),
      roomsB: loadImage(roomsAtlasBUrl),
    };
    abort = new AbortController();
    dom = makeDom();
    renderedZone = '';
    renderedSteps = '';
    renderedProse = '';
    renderedPrompt = '';
    renderedToastVisible = false;
    activeObservation = null;
    graphics = dom.canvas.getContext('2d');
    if (!graphics) {
      ctx.println('walk: this browser cannot remember the coast.');
      close();
      return;
    }
    document.body.appendChild(dom.overlay);
    dom.close.addEventListener('click', close, { signal: abort.signal });
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(dom.canvas);
    attachInput();
    const place = state.currentZone ? PLACES[state.currentZone] : null;
    dom.toast.textContent = place?.title ?? 'the coast';
    toastUntil = performance.now() + 1_500;
    renderText(performance.now());
    lastFrameAt = performance.now();
    nextMoveAt = lastFrameAt;
    raf = requestAnimationFrame(tick);
  },
  onKey: () => {},
  render: () => {},
  cleanup: () => close(),
};

export default program;

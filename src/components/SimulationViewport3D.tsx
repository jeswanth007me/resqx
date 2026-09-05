import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TelemetryData, TelemetryVehicle } from '../types/telemetry';

interface SimulationViewport3DProps {
  telemetry: TelemetryData | null;
  followAmbulance: boolean;
  strobeState: boolean;
}

interface VehicleTargetState {
  targetPos: THREE.Vector3;
  targetRotY: number;
  currentRotY: number;
  speedKmh: number;
  prevSpeedKmh: number;
  color: string;
}

interface HudLabelItem {
  id: string;
  label: string;
  x: number;
  y: number;
  category?: 'ambulance' | 'junction' | 'hospital' | 'traffic';
  status?: string;
  isAmb?: boolean;
  isBraking?: boolean;
}

interface Signal3DRefs {
  redBulb: THREE.MeshStandardMaterial;
  yellowBulb: THREE.MeshStandardMaterial;
  greenBulb: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  priorityPlane: THREE.Mesh;
}

const SIGNAL_CONFIGS = [
  { id: 'SIG-01', name: 'North Gate', sumoY: 230, worldZ: -64 },
  { id: 'SIG-02', name: 'Central Avenue', sumoY: 170, worldZ: -16 },
  { id: 'SIG-03', name: 'Hospital Approach', sumoY: 110, worldZ: 32 },
  { id: 'SIG-04', name: 'South Corridor', sumoY: 50, worldZ: 80 },
] as const;

/**
 * Parses color strings from SUMO (Hex "#0066cc", comma-separated RGB "0,102,204", or named color)
 */
function parseVehicleColor(rawColor?: string, fallback = '#38bdf8'): string {
  if (!rawColor) return fallback;
  const trimmed = rawColor.trim();
  if (trimmed.startsWith('#')) return trimmed;
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((p) => parseInt(p.trim(), 10));
    if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
      return `#${parts
        .slice(0, 3)
        .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
        .join('')}`;
    }
  }
  return trimmed;
}

export function SimulationViewport3D({
  telemetry,
  followAmbulance,
  strobeState,
}: SimulationViewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Dynamic 3D Object Refs
  const ambGroupRef = useRef<THREE.Group | null>(null);
  const proceduralAmbMeshRef = useRef<THREE.Group | null>(null);
  const ambTargetPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, -120));
  const ambTargetRotYRef = useRef<number>(0);
  const ambCurrentRotYRef = useRef<number>(0);

  const ambStrobeRedRef = useRef<THREE.PointLight | null>(null);
  const ambStrobeBlueRef = useRef<THREE.PointLight | null>(null);
  const ambStrobeRedMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const ambStrobeBlueMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  const vehiclesGroupRef = useRef<THREE.Group | null>(null);
  const vehicleMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const vehicleTargetsRef = useRef<Map<string, VehicleTargetState>>(new Map());
  const vehicleTaillightMatsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

  // 4 Signal Gantry References (SIG-01, SIG-02, SIG-03, SIG-04)
  const signalsMapRef = useRef<Map<string, Signal3DRefs>>(new Map());

  // Emergency Corridor Ribbon Objects
  const corridorActiveRibbonRef = useRef<THREE.Mesh | null>(null);
  const corridorFutureRibbonRef = useRef<THREE.Mesh | null>(null);

  // HTML overlay positioning for HUD labels
  const [hudLabels, setHudLabels] = useState<HudLabelItem[]>([]);

  // Convert SUMO (sumoX, sumoY, sumoAngle) to 3D World space (X, Y, Z, rotationY)
  // SUMO corridor geometry: N_START (100, 300) -> SIG-01 (100, 230) -> SIG-02 (100, 170) -> SIG-03 (100, 110) -> SIG-04 (100, 50) -> HOSPITAL (100, 0)
  // Cross streets span East-West across X ≈ 0 to 200 (centered at X=100)
  // In 3D World (isotropic scale 0.8):
  // worldX = (sumoX - 100) * 0.8
  // worldZ = (150 - sumoY) * 0.8
  const mapSumoTo3D = (sumoX: number, sumoY: number, sumoAngle: number = 180) => {
    const validX = Number.isFinite(sumoX) ? sumoX : 100;
    const validY = Number.isFinite(sumoY) ? sumoY : 150;
    const validAngle = Number.isFinite(sumoAngle) ? sumoAngle : 180;

    const worldZ = (150 - validY) * 0.8;
    const worldX = (validX - 100) * 0.8;

    // Convert SUMO heading angle (180° = South, 0° = North, 90° = East, 270° = West)
    const normAngle = ((validAngle % 360) + 360) % 360;
    const rotY = ((180 - normAngle) * Math.PI) / 180;

    return { x: worldX, y: 0, z: worldZ, rotY, normAngle };
  };

  // Setup Three.js Scene, Camera, Lighting & Geometry
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene (Daylight EOC Digital Twin Environment)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e2e8f0');
    scene.fog = new THREE.FogExp2('#e2e8f0', 0.001);
    sceneRef.current = scene;

    // 2. Camera (Elevated 3/4 Command-Center View: ~40° downward angle showing full corridor)
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 1000);
    camera.position.set(48, 62, -70);
    camera.lookAt(0, 0, 10);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // 4. OrbitControls (Tuned for EOC command viewpoint)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0, 10);
    controls.maxPolarAngle = Math.PI / 2.3;
    controls.minDistance = 25;
    controls.maxDistance = 240;
    controlsRef.current = controls;

    // 5. Lighting (Crisp Morning/Daylight Architectural Sun Lighting)
    const ambientLight = new THREE.AmbientLight('#ffffff', 2.0);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight('#bae6fd', '#cbd5e1', 1.0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#fffbeb', 2.4);
    dirLight.position.set(60, 110, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 360;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.top = 160;
    dirLight.shadow.camera.bottom = -160;
    scene.add(dirLight);

    // ─── GROUND PLANE & ENVIRONMENT ──────────────────────────────────────────
    const groundGeo = new THREE.PlaneGeometry(450, 520);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#f1f5f9',
      roughness: 0.9,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // ─── EXPANDED MAIN EMERGENCY BOULEVARD (WIDTH = 26, LENGTH = 330) ────────
    const boulevardGeo = new THREE.PlaneGeometry(26, 330);
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.8,
      metalness: 0.1,
    });
    const boulevard = new THREE.Mesh(boulevardGeo, asphaltMat);
    boulevard.rotation.x = -Math.PI / 2;
    boulevard.position.set(0, 0, 5);
    boulevard.receiveShadow = true;
    scene.add(boulevard);

    // Sidewalk Curbs along Boulevard
    const curbGeo = new THREE.BoxGeometry(1.4, 0.2, 330);
    const curbMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.6 });

    const curbLeft = new THREE.Mesh(curbGeo, curbMat);
    curbLeft.position.set(-13.7, 0.1, 5);
    scene.add(curbLeft);

    const curbRight = new THREE.Mesh(curbGeo, curbMat);
    curbRight.position.set(13.7, 0.1, 5);
    scene.add(curbRight);

    // Center Double Yellow Lines
    const yellowLineGeo = new THREE.PlaneGeometry(0.35, 330);
    const yellowLineMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' });

    const yellowLine1 = new THREE.Mesh(yellowLineGeo, yellowLineMat);
    yellowLine1.rotation.x = -Math.PI / 2;
    yellowLine1.position.set(-0.35, 0.02, 5);
    scene.add(yellowLine1);

    const yellowLine2 = new THREE.Mesh(yellowLineGeo, yellowLineMat);
    yellowLine2.rotation.x = -Math.PI / 2;
    yellowLine2.position.set(0.35, 0.02, 5);
    scene.add(yellowLine2);

    // White Dashed Lane Dividers (skipping all 4 intersection zones)
    const dashedGeo = new THREE.PlaneGeometry(0.25, 3.5);
    const dashedMat = new THREE.MeshBasicMaterial({ color: '#ffffff', opacity: 0.9, transparent: true });

    const isNearIntersection = (z: number) => {
      return SIGNAL_CONFIGS.some((sig) => Math.abs(z - sig.worldZ) <= 12);
    };

    for (let z = -150; z <= 150; z += 8) {
      if (isNearIntersection(z)) continue;

      const dashLeft = new THREE.Mesh(dashedGeo, dashedMat);
      dashLeft.rotation.x = -Math.PI / 2;
      dashLeft.position.set(-6.5, 0.02, z);
      scene.add(dashLeft);

      const dashRight = new THREE.Mesh(dashedGeo, dashedMat);
      dashRight.rotation.x = -Math.PI / 2;
      dashRight.position.set(6.5, 0.02, z);
      scene.add(dashRight);
    }

    // ─── 4 CROSS STREETS (SIG-01, SIG-02, SIG-03, SIG-04) ────────────────────
    SIGNAL_CONFIGS.forEach((sig) => {
      const crossGeo = new THREE.PlaneGeometry(160, 20);
      const cross = new THREE.Mesh(crossGeo, asphaltMat);
      cross.rotation.x = -Math.PI / 2;
      cross.position.set(0, 0.01, sig.worldZ);
      cross.receiveShadow = true;
      scene.add(cross);

      // Stop Lines (North & South of intersection)
      const stopLineGeo = new THREE.PlaneGeometry(24, 1.0);
      const stopLineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

      const stopNorth = new THREE.Mesh(stopLineGeo, stopLineMat);
      stopNorth.rotation.x = -Math.PI / 2;
      stopNorth.position.set(0, 0.03, sig.worldZ - 11);
      scene.add(stopNorth);

      const stopSouth = new THREE.Mesh(stopLineGeo, stopLineMat);
      stopSouth.rotation.x = -Math.PI / 2;
      stopSouth.position.set(0, 0.03, sig.worldZ + 11);
      scene.add(stopSouth);

      // Zebra Crosswalk Stripes
      const stripeGeo = new THREE.PlaneGeometry(1.4, 0.5);
      const stripeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', opacity: 0.95, transparent: true });

      [-9.5, 9.5].forEach((zOffset) => {
        for (let x = -11; x <= 11; x += 2.2) {
          const stripe = new THREE.Mesh(stripeGeo, stripeMat);
          stripe.rotation.x = -Math.PI / 2;
          stripe.position.set(x, 0.025, sig.worldZ + zOffset);
          scene.add(stripe);
        }
      });
    });

    // ─── STREET LIGHT POLES ALONG SIDEWALKS ──────────────────────────────────
    const createStreetLamp = (x: number, z: number, isRight: boolean) => {
      const lampGroup = new THREE.Group();
      lampGroup.position.set(x, 0, z);

      const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 8, 12);
      const poleMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.7, roughness: 0.3 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 4.0;
      pole.castShadow = true;
      lampGroup.add(pole);

      const armGeo = new THREE.BoxGeometry(2.8, 0.12, 0.12);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(isRight ? -1.4 : 1.4, 7.9, 0);
      lampGroup.add(arm);

      const fixtureGeo = new THREE.BoxGeometry(0.8, 0.2, 0.4);
      const fixtureMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4 });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(isRight ? -2.6 : 2.6, 7.8, 0);
      lampGroup.add(fixture);

      const lensGeo = new THREE.PlaneGeometry(0.7, 0.35);
      const lensMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(isRight ? -2.6 : 2.6, 7.69, 0);
      lampGroup.add(lens);

      scene.add(lampGroup);
    };

    [-140, -100, -40, 8, 56, 104, 140].forEach((z) => {
      createStreetLamp(-14.5, z, false);
      createStreetLamp(14.5, z, true);
    });

    // ─── LOW-POLY URBAN GREENERY / TREES ALONG BOULEVARD VERGES ───────────────
    const createUrbanTree = (x: number, z: number, scale = 1.0) => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      tree.scale.set(scale, scale, scale);

      // Planter Box
      const planterGeo = new THREE.BoxGeometry(2.4, 0.35, 2.4);
      const planterMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.7 });
      const planter = new THREE.Mesh(planterGeo, planterMat);
      planter.position.y = 0.17;
      planter.receiveShadow = true;
      tree.add(planter);

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.4;
      trunk.castShadow = true;
      tree.add(trunk);

      // Foliage Layers
      const foliageMat = new THREE.MeshStandardMaterial({
        color: '#15803d',
        roughness: 0.8,
        flatShading: true,
      });

      const cone1 = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.2, 7), foliageMat);
      cone1.position.y = 2.8;
      cone1.castShadow = true;
      tree.add(cone1);

      const cone2 = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.8, 7), foliageMat);
      cone2.position.y = 3.9;
      cone2.castShadow = true;
      tree.add(cone2);

      const cone3 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 7), foliageMat);
      cone3.position.y = 4.8;
      cone3.castShadow = true;
      tree.add(cone3);

      scene.add(tree);
    };

    [-125, -85, -50, -28, -5, 18, 42, 68, 92, 130].forEach((z) => {
      createUrbanTree(-16.8, z, 0.9 + Math.sin(z) * 0.1);
      createUrbanTree(16.8, z, 0.9 + Math.cos(z) * 0.1);
    });

    // ─── LOW-POLY PEDESTRIANS WAITING AT CROSSINGS & HOSPITAL ────────────────
    const createPedestrian = (x: number, z: number, rotY: number, shirtColor: string, pantsColor: string) => {
      const ped = new THREE.Group();
      ped.position.set(x, 0, z);
      ped.rotation.y = rotY;

      // Legs
      const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 });
      const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);

      const legL = new THREE.Mesh(legGeo, pantsMat);
      legL.position.set(-0.12, 0.35, 0);
      legL.castShadow = true;
      ped.add(legL);

      const legR = new THREE.Mesh(legGeo, pantsMat);
      legR.position.set(0.12, 0.35, 0);
      legR.castShadow = true;
      ped.add(legR);

      // Torso / Shirt
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 });
      const torsoGeo = new THREE.BoxGeometry(0.48, 0.65, 0.3);
      const torso = new THREE.Mesh(torsoGeo, shirtMat);
      torso.position.y = 1.02;
      torso.castShadow = true;
      ped.add(torso);

      // Head
      const headGeo = new THREE.SphereGeometry(0.16, 8, 8);
      const skinMat = new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.5 });
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.y = 1.5;
      head.castShadow = true;
      ped.add(head);

      scene.add(ped);
    };

    // Pedestrians placed safely at sidewalk waiting areas near all 4 intersections
    SIGNAL_CONFIGS.forEach((sig, idx) => {
      const colors = [
        { shirt: '#0284c7', pants: '#334155' },
        { shirt: '#dc2626', pants: '#1e293b' },
        { shirt: '#16a34a', pants: '#475569' },
        { shirt: '#d97706', pants: '#0f172a' },
      ];
      const c1 = colors[idx % colors.length];
      const c2 = colors[(idx + 1) % colors.length];

      // Sidewalk corners
      createPedestrian(-15.2, sig.worldZ - 8.5, Math.PI / 2, c1.shirt, c1.pants);
      createPedestrian(-15.6, sig.worldZ + 8.5, Math.PI / 2, c2.shirt, c2.pants);
      createPedestrian(15.2, sig.worldZ - 8.5, -Math.PI / 2, c2.shirt, c2.pants);
      createPedestrian(15.5, sig.worldZ + 8.5, -Math.PI / 2, c1.shirt, c1.pants);
    });

    // Pedestrians near Hospital Entrance Plaza
    createPedestrian(30.0, 116.0, Math.PI / 4, '#0284c7', '#334155');
    createPedestrian(31.5, 118.0, 0, '#ffffff', '#1e293b'); // Paramedic in white
    createPedestrian(28.5, 122.0, -Math.PI / 3, '#16a34a', '#475569');

    // ─── ROAD ARROWS (DIRECTIONAL ROAD PAVEMENT MARKINGS) ─────────────────────
    const createRoadArrow = (x: number, z: number, isNorthbound: boolean) => {
      const arrowGroup = new THREE.Group();
      arrowGroup.position.set(x, 0.025, z);
      if (isNorthbound) arrowGroup.rotation.y = Math.PI;

      const arrowMat = new THREE.MeshBasicMaterial({ color: '#ffffff', opacity: 0.9, transparent: true });

      // Stem
      const stem = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2.2), arrowMat);
      stem.rotation.x = -Math.PI / 2;
      arrowGroup.add(stem);

      // Head
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.1, 3), arrowMat);
      head.rotation.x = -Math.PI / 2;
      head.rotation.z = Math.PI;
      head.position.set(0, 0, 1.4);
      arrowGroup.add(head);

      scene.add(arrowGroup);
    };

    SIGNAL_CONFIGS.forEach((sig) => {
      // Southbound lanes approaching intersection
      createRoadArrow(-6.5, sig.worldZ - 18, false);
      createRoadArrow(-2.2, sig.worldZ - 18, false);

      // Northbound lanes approaching intersection
      createRoadArrow(6.5, sig.worldZ + 18, true);
      createRoadArrow(2.2, sig.worldZ + 18, true);
    });

    // ─── BACKGROUND BUILDINGS FLANKING CORRIDOR ──────────────────────────────
    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);

    const createBuildingBlock = (
      x: number,
      z: number,
      width: number,
      depth: number,
      height: number,
      color: string,
      windowColor: string,
      title: string
    ) => {
      const block = new THREE.Group();
      block.name = title;
      block.position.set(x, 0, z);

      const bodyGeo = new THREE.BoxGeometry(width, height, depth);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.5,
        metalness: 0.2,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = height / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      block.add(body);

      // Window Grid
      const windowMat = new THREE.MeshBasicMaterial({ color: windowColor });
      const winGeo = new THREE.BoxGeometry(0.2, 1.0, 1.5);

      const rows = Math.floor(height / 3.5);
      const cols = Math.floor(depth / 6);

      for (let r = 1; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const win = new THREE.Mesh(winGeo, windowMat);
          const zOffset = -depth / 2 + 3 + c * 6;
          const yOffset = r * 3.2;
          win.position.set(x < 0 ? width / 2 + 0.1 : -width / 2 - 0.1, yOffset, zOffset);
          block.add(win);
        }
      }

      buildingGroup.add(block);
    };

    createBuildingBlock(-65, -105, 26, 50, 12, '#ffffff', '#64748b', 'NORTH CIVIC CENTER');
    createBuildingBlock(65, -105, 26, 50, 14, '#f8fafc', '#475569', 'COMMERCIAL TOWER');
    createBuildingBlock(-65, -40, 26, 40, 11, '#ffffff', '#64748b', 'MUNICIPAL COMPLEX');
    createBuildingBlock(65, -40, 26, 40, 13, '#f1f5f9', '#475569', 'TECH DISTRICT');
    createBuildingBlock(-65, 10, 26, 40, 12, '#ffffff', '#64748b', 'METRO PLAZA');
    createBuildingBlock(65, 10, 26, 40, 15, '#f8fafc', '#475569', 'LOGISTICS HUB');
    createBuildingBlock(-65, 60, 26, 40, 10, '#ffffff', '#16a34a', 'SOUTHERN PRECINCT');

    // ─── DESTINATION HOSPITAL (CITY GENERAL HOSPITAL AT X = 48, Z = 120) ────
    const hospitalGroup = new THREE.Group();
    hospitalGroup.position.set(48, 0, 120);

    const hospBodyGeo = new THREE.BoxGeometry(32, 18, 42);
    const hospBodyMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.3,
      metalness: 0.2,
    });
    const hospBody = new THREE.Mesh(hospBodyGeo, hospBodyMat);
    hospBody.position.y = 9;
    hospBody.castShadow = true;
    hospBody.receiveShadow = true;
    hospitalGroup.add(hospBody);

    const hospTrimGeo = new THREE.BoxGeometry(33, 0.5, 43);
    const hospTrimMat = new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.3 });
    const hospTrim = new THREE.Mesh(hospTrimGeo, hospTrimMat);
    hospTrim.position.y = 18.2;
    hospitalGroup.add(hospTrim);

    // Hospital Medical Cross
    const crossVGeo = new THREE.BoxGeometry(0.2, 5.0, 1.5);
    const crossHGeo = new THREE.BoxGeometry(0.2, 1.5, 5.0);
    const crossMat = new THREE.MeshBasicMaterial({ color: '#dc2626' });

    const crossV = new THREE.Mesh(crossVGeo, crossMat);
    crossV.position.set(-16.1, 10.0, 0);
    hospitalGroup.add(crossV);

    const crossH = new THREE.Mesh(crossHGeo, crossMat);
    crossH.position.set(-16.1, 10.0, 0);
    hospitalGroup.add(crossH);

    // Emergency Room (ER) Ambulance Bay Canopy
    const erCanopyGeo = new THREE.BoxGeometry(10, 0.4, 16);
    const erCanopyMat = new THREE.MeshStandardMaterial({ color: '#0284c7', metalness: 0.4, roughness: 0.3 });
    const erCanopy = new THREE.Mesh(erCanopyGeo, erCanopyMat);
    erCanopy.position.set(-20, 4.5, 0);
    erCanopy.castShadow = true;
    hospitalGroup.add(erCanopy);

    // ER Canopy Support Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.18, 0.18, 4.5, 12);
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8 });
    const p1 = new THREE.Mesh(pillarGeo, pillarMat);
    p1.position.set(-24.5, 2.25, 7.5);
    p1.castShadow = true;
    hospitalGroup.add(p1);

    const p2 = new THREE.Mesh(pillarGeo, pillarMat);
    p2.position.set(-24.5, 2.25, -7.5);
    p2.castShadow = true;
    hospitalGroup.add(p2);

    // ER "EMERGENCY" Sign Plate
    const erSignPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.0, 8.0),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.3 })
    );
    erSignPlate.position.set(-20.1, 4.9, 0);
    hospitalGroup.add(erSignPlate);

    // Rooftop Helipad
    const helipadPad = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 0.2, 32),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 })
    );
    helipadPad.position.set(0, 18.3, 0);
    helipadPad.receiveShadow = true;
    hospitalGroup.add(helipadPad);

    const helipadRing = new THREE.Mesh(
      new THREE.RingGeometry(6.8, 7.4, 32),
      new THREE.MeshBasicMaterial({ color: '#f59e0b', side: THREE.DoubleSide })
    );
    helipadRing.rotation.x = -Math.PI / 2;
    helipadRing.position.set(0, 18.42, 0);
    hospitalGroup.add(helipadRing);

    // Helipad 'H'
    const hBarMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const hV1 = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4.2), hBarMat);
    hV1.rotation.x = -Math.PI / 2;
    hV1.position.set(-1.6, 18.43, 0);
    hospitalGroup.add(hV1);

    const hV2 = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4.2), hBarMat);
    hV2.rotation.x = -Math.PI / 2;
    hV2.position.set(1.6, 18.43, 0);
    hospitalGroup.add(hV2);

    const hCross = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.8), hBarMat);
    hCross.rotation.x = -Math.PI / 2;
    hCross.position.set(0, 18.43, 0);
    hospitalGroup.add(hCross);

    const bayGlow = new THREE.PointLight('#0284c7', 2.0, 25);
    bayGlow.position.set(-20, 3.8, 0);
    hospitalGroup.add(bayGlow);

    scene.add(hospitalGroup);

    // ─── 4 TRAFFIC SIGNAL GANTRIES (SIG-01, SIG-02, SIG-03, SIG-04) ─────────
    signalsMapRef.current.clear();

    const createSignalGantry = (z: number, id: string) => {
      const gantry = new THREE.Group();
      gantry.name = id;
      gantry.position.set(0, 0, z);

      const postGeo = new THREE.CylinderGeometry(0.3, 0.3, 15, 16);
      const postMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8, roughness: 0.4 });

      const postLeft = new THREE.Mesh(postGeo, postMat);
      postLeft.position.set(-14.0, 7.5, 0);
      gantry.add(postLeft);

      const postRight = new THREE.Mesh(postGeo, postMat);
      postRight.position.set(14.0, 7.5, 0);
      gantry.add(postRight);

      const barGeo = new THREE.BoxGeometry(28.4, 0.4, 0.4);
      const bar = new THREE.Mesh(barGeo, postMat);
      bar.position.set(0, 14.5, 0);
      gantry.add(bar);

      // Overhead Highway / Street Sign Board (Green with white border)
      const signBoardGeo = new THREE.BoxGeometry(8.0, 1.6, 0.15);
      const signBoardMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.4 });
      const signBoard = new THREE.Mesh(signBoardGeo, signBoardMat);
      signBoard.position.set(0, 14.5, 0.3);
      gantry.add(signBoard);

      const signBorderGeo = new THREE.BoxGeometry(8.15, 1.75, 0.08);
      const signBorderMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      const signBorder = new THREE.Mesh(signBorderGeo, signBorderMat);
      signBorder.position.set(0, 14.5, 0.26);
      gantry.add(signBorder);

      // Signal Head Housing
      const headHousingGeo = new THREE.BoxGeometry(1.8, 5.2, 1.2);
      const headHousingMat = new THREE.MeshStandardMaterial({
        color: '#0f172a',
        metalness: 0.9,
        roughness: 0.2,
      });

      const head1 = new THREE.Mesh(headHousingGeo, headHousingMat);
      head1.position.set(-6.5, 13.5, 0);
      gantry.add(head1);

      const head2 = new THREE.Mesh(headHousingGeo, headHousingMat);
      head2.position.set(6.5, 13.5, 0);
      gantry.add(head2);

      // Bulbs & Visors
      const bulbGeo = new THREE.SphereGeometry(0.55, 16, 16);
      const visorGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.4, 16, 1, true, 0, Math.PI);
      const visorMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.3 });

      const redMat = new THREE.MeshStandardMaterial({ color: '#ff4444', emissive: '#ff4444', emissiveIntensity: 1.0, roughness: 0.2 });
      const yellowMat = new THREE.MeshStandardMaterial({ color: '#332200', emissive: '#000000', emissiveIntensity: 0, roughness: 0.3 });
      const greenMat = new THREE.MeshStandardMaterial({ color: '#003311', emissive: '#000000', emissiveIntensity: 0, roughness: 0.3 });

      const addAspectsToHead = (headX: number) => {
        // Red (Top)
        const redBulb = new THREE.Mesh(bulbGeo, redMat);
        redBulb.position.set(headX, 15.0, 0.5);
        gantry.add(redBulb);
        const visorRed = new THREE.Mesh(visorGeo, visorMat);
        visorRed.rotation.x = Math.PI / 2;
        visorRed.position.set(headX, 15.3, 0.5);
        gantry.add(visorRed);

        // Amber (Middle)
        const yellowBulb = new THREE.Mesh(bulbGeo, yellowMat);
        yellowBulb.position.set(headX, 13.5, 0.5);
        gantry.add(yellowBulb);
        const visorYellow = new THREE.Mesh(visorGeo, visorMat);
        visorYellow.rotation.x = Math.PI / 2;
        visorYellow.position.set(headX, 13.8, 0.5);
        gantry.add(visorYellow);

        // Green (Bottom)
        const greenBulb = new THREE.Mesh(bulbGeo, greenMat);
        greenBulb.position.set(headX, 12.0, 0.5);
        gantry.add(greenBulb);
        const visorGreen = new THREE.Mesh(visorGeo, visorMat);
        visorGreen.rotation.x = Math.PI / 2;
        visorGreen.position.set(headX, 12.3, 0.5);
        gantry.add(visorGreen);
      };

      addAspectsToHead(-6.5);
      addAspectsToHead(6.5);

      const sigLight = new THREE.PointLight('#34d399', 0, 30);
      sigLight.position.set(0, 13, 0);
      gantry.add(sigLight);

      const priorityFrameGeo = new THREE.PlaneGeometry(26, 18);
      const priorityFrameMat = new THREE.MeshBasicMaterial({
        color: '#34d399',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const priorityFrame = new THREE.Mesh(priorityFrameGeo, priorityFrameMat);
      priorityFrame.rotation.x = -Math.PI / 2;
      priorityFrame.position.set(0, 0.03, 0);
      gantry.add(priorityFrame);

      scene.add(gantry);

      signalsMapRef.current.set(id, {
        redBulb: redMat,
        yellowBulb: yellowMat,
        greenBulb: greenMat,
        light: sigLight,
        priorityPlane: priorityFrame,
      });
    };

    SIGNAL_CONFIGS.forEach((sig) => createSignalGantry(sig.worldZ, sig.id));

    // ─── EMERGENCY CORRIDOR ROAD HIGHLIGHT RIBBONS ───────────────────────────
    const activeRibbonGeo = new THREE.PlaneGeometry(12, 1);
    const activeRibbonMat = new THREE.MeshBasicMaterial({
      color: '#16a34a',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const activeRibbon = new THREE.Mesh(activeRibbonGeo, activeRibbonMat);
    activeRibbon.rotation.x = -Math.PI / 2;
    activeRibbon.position.set(0, 0.035, 0);
    scene.add(activeRibbon);
    corridorActiveRibbonRef.current = activeRibbon;

    const futureRibbonGeo = new THREE.PlaneGeometry(6, 1);
    const futureRibbonMat = new THREE.MeshBasicMaterial({
      color: '#0284c7',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const futureRibbon = new THREE.Mesh(futureRibbonGeo, futureRibbonMat);
    futureRibbon.rotation.x = -Math.PI / 2;
    futureRibbon.position.set(0, 0.03, 0);
    scene.add(futureRibbon);
    corridorFutureRibbonRef.current = futureRibbon;

    // ─── AMBULANCE (AMB-01) 3D MESH & GLTF LOADER ────────────────────────────
    const ambGroup = new THREE.Group();
    scene.add(ambGroup);
    ambGroupRef.current = ambGroup;

    // High-Detail Procedural Emergency Ambulance Group
    const proceduralAmbGroup = new THREE.Group();

    // 1. Lower Chassis (White Medical Grade)
    const ambChassisGeo = new THREE.BoxGeometry(3.2, 1.8, 7.2);
    const ambChassisMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.25,
      metalness: 0.1,
    });
    const ambChassis = new THREE.Mesh(ambChassisGeo, ambChassisMat);
    ambChassis.position.y = 1.2;
    ambChassis.castShadow = true;
    ambChassis.receiveShadow = true;
    proceduralAmbGroup.add(ambChassis);

    // 2. High-Top Medical Patient Box (Rear Section)
    const ambBoxGeo = new THREE.BoxGeometry(3.3, 1.4, 4.6);
    const ambBoxMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 });
    const ambBox = new THREE.Mesh(ambBoxGeo, ambBoxMat);
    ambBox.position.set(0, 2.5, -1.0);
    ambBox.castShadow = true;
    proceduralAmbGroup.add(ambBox);

    // 3. Fluorescent Red/Orange Battenburg Emergency Side Stripes
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4 });
    const stripeSideL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 7.22), stripeMat);
    stripeSideL.position.set(-1.62, 1.2, 0);
    proceduralAmbGroup.add(stripeSideL);

    const stripeSideR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 7.22), stripeMat);
    stripeSideR.position.set(1.62, 1.2, 0);
    proceduralAmbGroup.add(stripeSideR);

    // 4. Rear Chevron Striping (Red & Yellow Reflective Bands)
    const chevronYellowMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.4 });
    const chevronBar1 = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.35, 0.1), stripeMat);
    chevronBar1.position.set(0, 1.0, -3.62);
    proceduralAmbGroup.add(chevronBar1);

    const chevronBar2 = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.35, 0.1), chevronYellowMat);
    chevronBar2.position.set(0, 1.4, -3.62);
    proceduralAmbGroup.add(chevronBar2);

    // 5. Medical Cross Decals (Sides & Roof)
    const crossRedMat = new THREE.MeshBasicMaterial({ color: '#dc2626' });

    // Roof Cross
    const roofCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 2.4), crossRedMat);
    roofCrossV.position.set(0, 3.22, -1.0);
    proceduralAmbGroup.add(roofCrossV);

    const roofCrossH = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.8), crossRedMat);
    roofCrossH.position.set(0, 3.22, -1.0);
    proceduralAmbGroup.add(roofCrossH);

    // Side Crosses
    const sideCrossLV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.4), crossRedMat);
    sideCrossLV.position.set(-1.67, 2.5, -1.0);
    proceduralAmbGroup.add(sideCrossLV);
    const sideCrossLH = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 1.2), crossRedMat);
    sideCrossLH.position.set(-1.67, 2.5, -1.0);
    proceduralAmbGroup.add(sideCrossLH);

    const sideCrossRV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.4), crossRedMat);
    sideCrossRV.position.set(1.67, 2.5, -1.0);
    proceduralAmbGroup.add(sideCrossRV);
    const sideCrossRH = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 1.2), crossRedMat);
    sideCrossRH.position.set(1.67, 2.5, -1.0);
    proceduralAmbGroup.add(sideCrossRH);

    // 6. Windshield & Cab Windows
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.1,
      metalness: 0.9,
    });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.85, 1.4), glassMat);
    windshield.position.set(0, 2.0, 2.3);
    proceduralAmbGroup.add(windshield);

    // 7. Wheels & Chrome Hubcaps
    const wheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.55, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
    const hubcapMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.2 });

    const createAmbulanceWheel = (x: number, z: number) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, 0.62, z);

      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.58, 12), hubcapMat);
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);

      proceduralAmbGroup.add(wheelGroup);
    };

    createAmbulanceWheel(-1.62, 2.2);
    createAmbulanceWheel(1.62, 2.2);
    createAmbulanceWheel(-1.62, -2.2);
    createAmbulanceWheel(1.62, -2.2);

    // 8. Front Headlights & Grille
    const frontHeadlightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const ambHl1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.1), frontHeadlightMat);
    ambHl1.position.set(-1.1, 1.1, 3.62);
    proceduralAmbGroup.add(ambHl1);

    const ambHl2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.1), frontHeadlightMat);
    ambHl2.position.set(1.1, 1.1, 3.62);
    proceduralAmbGroup.add(ambHl2);

    // Front Chrome Grille
    const ambGrille = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.1), hubcapMat);
    ambGrille.position.set(0, 1.1, 3.62);
    proceduralAmbGroup.add(ambGrille);

    ambGroup.add(proceduralAmbGroup);
    proceduralAmbMeshRef.current = proceduralAmbGroup;

    // Dual Roof Emergency Strobe Lightbar Base
    const lightbarBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.2, 0.6),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9 })
    );
    lightbarBase.position.set(0, 3.28, 1.6);
    ambGroup.add(lightbarBase);

    // Dual Emergency Strobe Beacons
    const strobeLightGeo = new THREE.BoxGeometry(0.7, 0.35, 0.5);

    const strobeRedMat = new THREE.MeshBasicMaterial({ color: '#ff0000' });
    const strobeRedMesh = new THREE.Mesh(strobeLightGeo, strobeRedMat);
    strobeRedMesh.position.set(-0.85, 3.5, 1.6);
    ambGroup.add(strobeRedMesh);
    ambStrobeRedMatRef.current = strobeRedMat;

    const strobeBlueMat = new THREE.MeshBasicMaterial({ color: '#0066ff' });
    const strobeBlueMesh = new THREE.Mesh(strobeLightGeo, strobeBlueMat);
    strobeBlueMesh.position.set(0.85, 3.5, 1.6);
    ambGroup.add(strobeBlueMesh);
    ambStrobeBlueMatRef.current = strobeBlueMat;

    const strobeRedLight = new THREE.PointLight('#ff0000', 8, 25);
    strobeRedLight.position.set(-0.9, 2.8, 2.0);
    ambGroup.add(strobeRedLight);
    ambStrobeRedRef.current = strobeRedLight;

    const strobeBlueLight = new THREE.PointLight('#0066ff', 8, 25);
    strobeBlueLight.position.set(0.9, 2.8, 2.0);
    ambGroup.add(strobeBlueLight);
    ambStrobeBlueRef.current = strobeBlueLight;

    // Forward Headlight Beams
    const headlightBeamGeo = new THREE.ConeGeometry(4, 16, 16);
    const headlightBeamMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const headlightBeam = new THREE.Mesh(headlightBeamGeo, headlightBeamMat);
    headlightBeam.rotation.x = Math.PI / 2;
    headlightBeam.position.set(0, 0.8, 10.0);
    ambGroup.add(headlightBeam);

    // Asynchronously Load External ambulance.glb Model
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      '/models/vehicles/ambulance.glb',
      (gltf) => {
        const gltfModel = gltf.scene;

        gltfModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        const bbox = new THREE.Box3().setFromObject(gltfModel);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 7.0 / (maxDim || 1);
        gltfModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

        const centerBbox = new THREE.Box3().setFromObject(gltfModel);
        gltfModel.position.y = -centerBbox.min.y;
        gltfModel.rotation.y = Math.PI;

        if (proceduralAmbMeshRef.current) {
          ambGroup.remove(proceduralAmbMeshRef.current);
          proceduralAmbMeshRef.current = null;
        }

        ambGroup.add(gltfModel);
      },
      undefined,
      (error) => {
        console.warn('[ResQX 3D] ambulance.glb load failed, procedural fallback active:', error);
      }
    );

    // ─── TRAFFIC VEHICLES GROUP ─────────────────────────────────────────────
    const vehiclesGroup = new THREE.Group();
    scene.add(vehiclesGroup);
    vehiclesGroupRef.current = vehiclesGroup;

    // ─── ANIMATION LERP RENDER LOOP ─────────────────────────────────────────
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth Lerp for AMB-01 Ambulance Position & Rotation
      if (ambGroupRef.current) {
        ambGroupRef.current.position.lerp(ambTargetPosRef.current, 0.12);

        let deltaRot = ambTargetRotYRef.current - ambCurrentRotYRef.current;
        while (deltaRot < -Math.PI) deltaRot += Math.PI * 2;
        while (deltaRot > Math.PI) deltaRot -= Math.PI * 2;

        ambCurrentRotYRef.current += deltaRot * 0.12;
        ambGroupRef.current.rotation.y = ambCurrentRotYRef.current;

        // Presentation Follow Camera Lerp
        if (followAmbulance && cameraRef.current && controlsRef.current) {
          const ambP = ambGroupRef.current.position;
          controlsRef.current.target.lerp(new THREE.Vector3(ambP.x, 1.2, ambP.z + 18), 0.12);
          cameraRef.current.position.lerp(new THREE.Vector3(ambP.x + 18, 20, ambP.z - 28), 0.12);
        }
      }

      // Smooth Lerp for Real SUMO Traffic Vehicles
      vehicleMeshesRef.current.forEach((mesh, id) => {
        const targetState = vehicleTargetsRef.current.get(id);
        if (!targetState) return;

        mesh.position.lerp(targetState.targetPos, 0.12);

        let deltaRot = targetState.targetRotY - targetState.currentRotY;
        while (deltaRot < -Math.PI) deltaRot += Math.PI * 2;
        while (deltaRot > Math.PI) deltaRot -= Math.PI * 2;

        targetState.currentRotY += deltaRot * 0.12;
        mesh.rotation.y = targetState.currentRotY;

        // Dynamic Brake Light Glow using Real SUMO Speed
        const taillightMat = vehicleTaillightMatsRef.current.get(id);
        if (taillightMat) {
          const isBraking =
            targetState.speedKmh < 3.0 ||
            (targetState.prevSpeedKmh > 8.0 && targetState.speedKmh < targetState.prevSpeedKmh - 2.5);

          if (isBraking) {
            taillightMat.color.setHex(0xff0000);
            taillightMat.emissive.setHex(0xff0000);
            taillightMat.emissiveIntensity = 1.4;
          } else {
            taillightMat.color.setHex(0xff5451);
            taillightMat.emissive.setHex(0x660000);
            taillightMat.emissiveIntensity = 0.3;
          }
        }
      });

      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update Dynamic 3D Targets & Signal States on Telemetry Change
  useEffect(() => {
    const amb = telemetry?.ambulance;
    const isRunning = telemetry?.simulation.running ?? false;
    const vehicles: TelemetryVehicle[] = telemetry?.traffic.vehicles ?? [];

    if (amb && Number.isFinite(amb.x) && Number.isFinite(amb.y)) {
      const p = mapSumoTo3D(amb.x, amb.y, amb.angle ?? 180);
      ambTargetPosRef.current.set(p.x, 0, p.z);
      ambTargetRotYRef.current = p.rotY;
    }

    if (ambStrobeRedRef.current && ambStrobeBlueRef.current && ambStrobeRedMatRef.current && ambStrobeBlueMatRef.current) {
      const flashRed = isRunning && strobeState;
      const flashBlue = isRunning && !strobeState;

      ambStrobeRedRef.current.intensity = flashRed ? 8 : 0;
      ambStrobeBlueRef.current.intensity = flashBlue ? 8 : 0;
      ambStrobeRedMatRef.current.color.setHex(flashRed ? 0xff0000 : 0x330000);
      ambStrobeBlueMatRef.current.color.setHex(flashBlue ? 0x0066ff : 0x001133);
    }

    // Update Visual State for All 4 Traffic Signals (SIG-01, SIG-02, SIG-03, SIG-04)
    SIGNAL_CONFIGS.forEach((sigCfg) => {
      const refs = signalsMapRef.current.get(sigCfg.id);
      if (!refs) return;

      const sig = telemetry?.signals.find((s) => s.id === sigCfg.id);
      const state = sig?.emergencyState ?? 'NORMAL';

      if (state === 'EMERGENCY PRIORITY' || (state as string) === 'PRIORITY') {
        refs.redBulb.color.setHex(0x330000);
        refs.redBulb.emissive.setHex(0x000000);
        refs.redBulb.emissiveIntensity = 0;

        refs.yellowBulb.color.setHex(0x332200);
        refs.yellowBulb.emissive.setHex(0x000000);
        refs.yellowBulb.emissiveIntensity = 0;

        refs.greenBulb.color.setHex(0x4edea3);
        refs.greenBulb.emissive.setHex(0x4edea3);
        refs.greenBulb.emissiveIntensity = 2.0;

        refs.light.color.setHex(0x4edea3);
        refs.light.intensity = 8;

        refs.priorityPlane.visible = true;
        (refs.priorityPlane.material as THREE.MeshBasicMaterial).opacity = 0.35;
      } else if (state === 'PREPARING') {
        refs.redBulb.color.setHex(0x330000);
        refs.redBulb.emissive.setHex(0x000000);
        refs.redBulb.emissiveIntensity = 0;

        refs.yellowBulb.color.setHex(0xffb95f);
        refs.yellowBulb.emissive.setHex(0xffb95f);
        refs.yellowBulb.emissiveIntensity = 1.8;

        refs.greenBulb.color.setHex(0x003311);
        refs.greenBulb.emissive.setHex(0x000000);
        refs.greenBulb.emissiveIntensity = 0;

        refs.light.color.setHex(0xffb95f);
        refs.light.intensity = 5;

        refs.priorityPlane.visible = true;
        (refs.priorityPlane.material as THREE.MeshBasicMaterial).opacity = 0.18;
      } else if (state === 'RESTORED' || (state as string) === 'RESTORING') {
        refs.redBulb.color.setHex(0x330000);
        refs.redBulb.emissive.setHex(0x000000);
        refs.redBulb.emissiveIntensity = 0;

        refs.yellowBulb.color.setHex(0x38bdf8);
        refs.yellowBulb.emissive.setHex(0x38bdf8);
        refs.yellowBulb.emissiveIntensity = 1.2;

        refs.greenBulb.color.setHex(0x003311);
        refs.greenBulb.emissive.setHex(0x000000);
        refs.greenBulb.emissiveIntensity = 0;

        refs.light.color.setHex(0x38bdf8);
        refs.light.intensity = 3;

        refs.priorityPlane.visible = false;
      } else {
        refs.redBulb.color.setHex(0xff5451);
        refs.redBulb.emissive.setHex(0xff5451);
        refs.redBulb.emissiveIntensity = 0.9;

        refs.yellowBulb.color.setHex(0x332200);
        refs.yellowBulb.emissive.setHex(0x000000);
        refs.yellowBulb.emissiveIntensity = 0;

        refs.greenBulb.color.setHex(0x003311);
        refs.greenBulb.emissive.setHex(0x000000);
        refs.greenBulb.emissiveIntensity = 0;

        refs.light.intensity = 0;
        refs.priorityPlane.visible = false;
      }
    });

    // Single Restrained Emergency Corridor Ribbon (Clear Green Wave Path from AMB to Destination)
    if (corridorActiveRibbonRef.current && corridorFutureRibbonRef.current) {
      const isActiveMission = isRunning && amb?.status !== 'STAGED' && amb?.status !== 'ARRIVED';

      if (isActiveMission && amb) {
        const ambP = mapSumoTo3D(amb.x, amb.y);
        const destinationZ = 120; // Hospital approach

        const corridorLen = Math.max(2, destinationZ - ambP.z);
        const corridorCenterZ = ambP.z + corridorLen / 2;

        corridorActiveRibbonRef.current.visible = true;
        corridorActiveRibbonRef.current.scale.set(1, corridorLen, 1);
        corridorActiveRibbonRef.current.position.set(0, 0.035, corridorCenterZ);
        (corridorActiveRibbonRef.current.material as THREE.MeshBasicMaterial).opacity = 0.22;

        corridorFutureRibbonRef.current.visible = false;
      } else {
        corridorActiveRibbonRef.current.visible = false;
        corridorFutureRibbonRef.current.visible = false;
      }
    }

    // Render Real SUMO Traffic Vehicles (Clean, supportive context)
    if (vehiclesGroupRef.current) {
      const currentIds = new Set<string>();

      vehicles
        .filter((v) => v.id !== 'AMB-01' && v.type !== 'emergency')
        .forEach((v) => {
          if (!v.id || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return;

          currentIds.add(v.id);
          const p = mapSumoTo3D(v.x, v.y, v.angle ?? 180);
          const carColor = parseVehicleColor(v.color, '#0066cc');

          let carGroup = vehicleMeshesRef.current.get(v.id);
          let targetState = vehicleTargetsRef.current.get(v.id);

          if (!carGroup) {
            const newCarGroup = new THREE.Group();
            newCarGroup.name = `vehicle-${v.id}`;

            // Hash vehicle ID to pick consistent body type and realistic automotive paint
            const idHash = v.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
            const bodyType = idHash % 3; // 0 = Sedan, 1 = SUV, 2 = Compact

            const AUTO_PALETTE = ['#1e293b', '#334155', '#475569', '#0284c7', '#15803d', '#b91c1c', '#f8fafc', '#d97706'];
            const resolvedColor = v.color && v.color !== '#0066cc' && v.color !== '0,102,204'
              ? carColor
              : AUTO_PALETTE[idHash % AUTO_PALETTE.length];

            const paintMat = new THREE.MeshStandardMaterial({
              color: resolvedColor,
              roughness: 0.35,
              metalness: 0.5,
            });

            const darkTrimMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });
            const glassMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.1, metalness: 0.9 });
            const chromeMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.2 });

            if (bodyType === 1) {
              // SUV / Crossover Profile
              const chassisGeo = new THREE.BoxGeometry(2.8, 0.9, 5.6);
              const chassis = new THREE.Mesh(chassisGeo, paintMat);
              chassis.position.y = 0.75;
              chassis.castShadow = true;
              chassis.receiveShadow = true;
              newCarGroup.add(chassis);

              const cabinGeo = new THREE.BoxGeometry(2.5, 0.85, 3.4);
              const cabin = new THREE.Mesh(cabinGeo, paintMat);
              cabin.position.set(0, 1.55, -0.2);
              cabin.castShadow = true;
              newCarGroup.add(cabin);

              const glassGeo = new THREE.BoxGeometry(2.52, 0.65, 3.1);
              const glass = new THREE.Mesh(glassGeo, glassMat);
              glass.position.set(0, 1.55, -0.2);
              newCarGroup.add(glass);
            } else if (bodyType === 2) {
              // Compact / Hatchback Profile
              const chassisGeo = new THREE.BoxGeometry(2.5, 0.75, 4.6);
              const chassis = new THREE.Mesh(chassisGeo, paintMat);
              chassis.position.y = 0.65;
              chassis.castShadow = true;
              chassis.receiveShadow = true;
              newCarGroup.add(chassis);

              const cabinGeo = new THREE.BoxGeometry(2.3, 0.8, 2.7);
              const cabin = new THREE.Mesh(cabinGeo, paintMat);
              cabin.position.set(0, 1.4, -0.3);
              cabin.castShadow = true;
              newCarGroup.add(cabin);

              const glassGeo = new THREE.BoxGeometry(2.32, 0.6, 2.4);
              const glass = new THREE.Mesh(glassGeo, glassMat);
              glass.position.set(0, 1.4, -0.3);
              newCarGroup.add(glass);
            } else {
              // Executive Sedan Profile
              const chassisGeo = new THREE.BoxGeometry(2.7, 0.7, 5.4);
              const chassis = new THREE.Mesh(chassisGeo, paintMat);
              chassis.position.y = 0.65;
              chassis.castShadow = true;
              chassis.receiveShadow = true;
              newCarGroup.add(chassis);

              const cabinGeo = new THREE.BoxGeometry(2.4, 0.75, 2.6);
              const cabin = new THREE.Mesh(cabinGeo, paintMat);
              cabin.position.set(0, 1.35, -0.2);
              cabin.castShadow = true;
              newCarGroup.add(cabin);

              const glassGeo = new THREE.BoxGeometry(2.42, 0.55, 2.3);
              const glass = new THREE.Mesh(glassGeo, glassMat);
              glass.position.set(0, 1.35, -0.2);
              newCarGroup.add(glass);
            }

            // 4 Wheels
            const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.4, 12);
            const createCarWheel = (x: number, z: number) => {
              const wheel = new THREE.Mesh(wheelGeo, darkTrimMat);
              wheel.rotation.z = Math.PI / 2;
              wheel.position.set(x, 0.48, z);
              wheel.castShadow = true;
              newCarGroup.add(wheel);
            };
            createCarWheel(-1.35, 1.7);
            createCarWheel(1.35, 1.7);
            createCarWheel(-1.35, -1.7);
            createCarWheel(1.35, -1.7);

            // Front Headlights
            const headlightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
            const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.08), headlightMat);
            hl1.position.set(-0.95, 0.75, 2.75);
            newCarGroup.add(hl1);

            const hl2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.08), headlightMat);
            hl2.position.set(0.95, 0.75, 2.75);
            newCarGroup.add(hl2);

            // Front Grille
            const grille = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.08), chromeMat);
            grille.position.set(0, 0.75, 2.75);
            newCarGroup.add(grille);

            // Dynamic Tail Lights
            const taillightMat = new THREE.MeshStandardMaterial({
              color: '#ff5451',
              emissive: '#660000',
              emissiveIntensity: 0.3,
              roughness: 0.3,
            });
            const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.08), taillightMat);
            tl1.position.set(-0.95, 0.75, -2.75);
            newCarGroup.add(tl1);

            const tl2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.08), taillightMat);
            tl2.position.set(0.95, 0.75, -2.75);
            newCarGroup.add(tl2);

            vehicleTaillightMatsRef.current.set(v.id, taillightMat);

            newCarGroup.position.set(p.x, 0, p.z);
            newCarGroup.rotation.y = p.rotY;

            vehiclesGroupRef.current?.add(newCarGroup);
            vehicleMeshesRef.current.set(v.id, newCarGroup);

            targetState = {
              targetPos: new THREE.Vector3(p.x, 0, p.z),
              targetRotY: p.rotY,
              currentRotY: p.rotY,
              speedKmh: v.speedKmh ?? 0,
              prevSpeedKmh: v.speedKmh ?? 0,
              color: resolvedColor,
            };
            vehicleTargetsRef.current.set(v.id, targetState);
          } else if (targetState) {
            targetState.prevSpeedKmh = targetState.speedKmh;
            targetState.speedKmh = v.speedKmh ?? 0;
            targetState.targetPos.set(p.x, 0, p.z);
            targetState.targetRotY = p.rotY;
          }
        });

      // Safely remove vehicle meshes that left the simulation
      vehicleMeshesRef.current.forEach((mesh, id) => {
        if (!currentIds.has(id)) {
          vehiclesGroupRef.current?.remove(mesh);
          vehicleMeshesRef.current.delete(id);
          vehicleTargetsRef.current.delete(id);
          vehicleTaillightMatsRef.current.delete(id);
        }
      });
    }

    // Update Clean, Restrained HUD Overlay Badges (AMB-01, 4 Junctions, Hospital)
    if (cameraRef.current && containerRef.current) {
      const labels: Array<{
        id: string;
        label: string;
        x: number;
        y: number;
        category?: 'ambulance' | 'junction' | 'hospital';
        status?: string;
      }> = [];
      const tempVec = new THREE.Vector3();
      const rect = containerRef.current.getBoundingClientRect();

      // 1. Ambulance Badge (Crisp, High-Priority Focal Indicator)
      if (ambGroupRef.current && amb) {
        tempVec.setFromMatrixPosition(ambGroupRef.current.matrixWorld);
        tempVec.y += 4.5;
        tempVec.project(cameraRef.current);

        const x = ((tempVec.x + 1) * rect.width) / 2;
        const y = ((-tempVec.y + 1) * rect.height) / 2;

        if (Number.isFinite(x) && Number.isFinite(y)) {
          labels.push({
            id: 'AMB-01',
            label: `🚑 AMB-01 • ${amb.speedKmh} km/h`,
            x,
            y,
            category: 'ambulance',
          });
        }
      }

      // 2. All 4 Junctions (SIG-01, SIG-02, SIG-03, SIG-04)
      SIGNAL_CONFIGS.forEach((sigCfg) => {
        const sig = telemetry?.signals.find((s) => s.id === sigCfg.id);
        const sigState = sig?.emergencyState ?? 'NORMAL';

        tempVec.set(-14.0, 16.5, sigCfg.worldZ);
        tempVec.project(cameraRef.current!);

        const x = ((tempVec.x + 1) * rect.width) / 2;
        const y = ((-tempVec.y + 1) * rect.height) / 2;

        if (Number.isFinite(x) && Number.isFinite(y)) {
          labels.push({
            id: `${sigCfg.id}-HUD`,
            label: `${sigCfg.id} • ${sigCfg.name} [${sigState}]`,
            x,
            y,
            category: 'junction',
            status: sigState,
          });
        }
      });

      // 3. Destination Hospital Landmark Badge
      tempVec.set(48, 20.0, 120);
      tempVec.project(cameraRef.current);
      const hospX = ((tempVec.x + 1) * rect.width) / 2;
      const hospY = ((-tempVec.y + 1) * rect.height) / 2;
      if (Number.isFinite(hospX) && Number.isFinite(hospY)) {
        labels.push({
          id: 'HOSPITAL-HUD',
          label: `🏥 City General Hospital • Trauma Center`,
          x: hospX,
          y: hospY,
          category: 'hospital',
        });
      }

      setHudLabels(labels);
    }
  }, [telemetry, followAmbulance, strobeState]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Three.js WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating 3D HUD Badges Overlay (Daylight EOC High-Contrast Badges) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {hudLabels.map((item) => {
          if (item.x < -100 || item.x > 1600 || item.y < -50 || item.y > 1000) return null;

          let badgeStyle = 'bg-white/95 text-slate-800 border-slate-300 shadow-sm';
          if (item.category === 'ambulance') {
            badgeStyle = 'bg-red-50/95 text-red-700 border-red-500 shadow-md font-bold ring-2 ring-red-400';
          } else if (item.category === 'hospital') {
            badgeStyle = 'bg-emerald-50/95 text-emerald-800 border-emerald-500 shadow-md font-bold';
          } else if (item.category === 'junction') {
            if (item.status === 'EMERGENCY PRIORITY' || item.status === 'PRIORITY') {
              badgeStyle = 'bg-emerald-50/95 text-emerald-800 border-emerald-600 shadow-md font-bold ring-2 ring-emerald-400';
            } else if (item.status === 'PREPARING') {
              badgeStyle = 'bg-amber-50/95 text-amber-800 border-amber-500 shadow-md font-bold ring-1 ring-amber-300';
            } else if (item.status === 'RESTORED') {
              badgeStyle = 'bg-sky-50/95 text-sky-800 border-sky-400 shadow-sm';
            } else {
              badgeStyle = 'bg-white/95 text-slate-700 border-slate-300 shadow-sm';
            }
          }

          return (
            <div
              key={item.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md text-[11px] font-data font-semibold shadow-md border backdrop-blur-md transition-all duration-75 ${badgeStyle}`}
              style={{ left: `${item.x}px`, top: `${item.y}px` }}
            >
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

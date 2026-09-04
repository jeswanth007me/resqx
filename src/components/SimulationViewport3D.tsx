import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TelemetryData } from '../types/telemetry';

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
  // In 3D World (scale 0.8):
  // Z = -120 at N_START (y=300), Z = -64 at SIG-01 (y=230), Z = -16 at SIG-02 (y=170), Z = 32 at SIG-03 (y=110), Z = 80 at SIG-04 (y=50), Z = 120 at HOSPITAL (y=0)
  // X = 0 at sumoX=100
  const mapSumoTo3D = (sumoX: number, sumoY: number, sumoAngle: number = 180) => {
    const worldZ = (150 - sumoY) * 0.8;
    const worldX = (sumoX - 100) * 0.70;

    // Convert SUMO heading angle (180° = South, 0° = North, 90° = East, 270° = West)
    const normAngle = ((sumoAngle % 360) + 360) % 360;
    const rotY = ((180 - normAngle) * Math.PI) / 180;

    return { x: worldX, y: 0, z: worldZ, rotY, normAngle };
  };

  // Setup Three.js Scene, Camera, Lighting & Geometry
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#060e20');
    scene.fog = new THREE.FogExp2('#060e20', 0.0022);
    sceneRef.current = scene;

    // 2. Camera (Elevated Command View capturing the entire 4-signal corridor)
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(52, 65, -80);
    camera.lookAt(0, 2, 10);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 2, 10);
    controls.maxPolarAngle = Math.PI / 2 - 0.08;
    controls.minDistance = 15;
    controls.maxDistance = 320;
    controlsRef.current = controls;

    // 5. Lighting (Clean ITS Digital Twin Lighting)
    const ambientLight = new THREE.AmbientLight('#1e293b', 2.2);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight('#38bdf8', '#0f172a', 1.0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#f8fafc', 2.2);
    dirLight.position.set(70, 120, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 380;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -180;
    scene.add(dirLight);

    // ─── GROUND PLANE & ENVIRONMENT ──────────────────────────────────────────
    const groundGeo = new THREE.PlaneGeometry(450, 520);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#060e20',
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // ─── EXPANDED MAIN EMERGENCY BOULEVARD (WIDTH = 26, LENGTH = 330) ────────
    const boulevardGeo = new THREE.PlaneGeometry(26, 330);
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: '#121a2b',
      roughness: 0.7,
      metalness: 0.2,
    });
    const boulevard = new THREE.Mesh(boulevardGeo, asphaltMat);
    boulevard.rotation.x = -Math.PI / 2;
    boulevard.position.set(0, 0, 5);
    boulevard.receiveShadow = true;
    scene.add(boulevard);

    // Sidewalk Curbs along Boulevard
    const curbGeo = new THREE.BoxGeometry(1.4, 0.2, 330);
    const curbMat = new THREE.MeshStandardMaterial({ color: '#2a364f', roughness: 0.5 });

    const curbLeft = new THREE.Mesh(curbGeo, curbMat);
    curbLeft.position.set(-13.7, 0.1, 5);
    scene.add(curbLeft);

    const curbRight = new THREE.Mesh(curbGeo, curbMat);
    curbRight.position.set(13.7, 0.1, 5);
    scene.add(curbRight);

    // Center Double Yellow Lines
    const yellowLineGeo = new THREE.PlaneGeometry(0.35, 330);
    const yellowLineMat = new THREE.MeshBasicMaterial({ color: '#ffb95f' });

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
    const dashedMat = new THREE.MeshBasicMaterial({ color: '#dae2fd', opacity: 0.6, transparent: true });

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
      const stripeMat = new THREE.MeshBasicMaterial({ color: '#e2e8f0', opacity: 0.9, transparent: true });

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

      const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 8, 12);
      const poleMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 4.0;
      lampGroup.add(pole);

      const armGeo = new THREE.BoxGeometry(3.0, 0.15, 0.15);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(isRight ? -1.5 : 1.5, 7.9, 0);
      lampGroup.add(arm);

      const fixtureGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const fixtureMat = new THREE.MeshBasicMaterial({ color: '#94a3b8' });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(isRight ? -2.8 : 2.8, 7.7, 0);
      lampGroup.add(fixture);

      const lampLight = new THREE.PointLight('#cbd5e1', 0.8, 20);
      lampLight.position.set(isRight ? -2.8 : 2.8, 7.5, 0);
      lampGroup.add(lampLight);

      scene.add(lampGroup);
    };

    [-140, -100, -40, 8, 56, 104, 140].forEach((z) => {
      createStreetLamp(-14.5, z, false);
      createStreetLamp(14.5, z, true);
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
        roughness: 0.6,
        metalness: 0.4,
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

    createBuildingBlock(-65, -105, 26, 50, 12, '#111b2e', '#38bdf8', 'NORTH CIVIC CENTER');
    createBuildingBlock(65, -105, 26, 50, 14, '#172238', '#ffb95f', 'COMMERCIAL TOWER');
    createBuildingBlock(-65, -40, 26, 40, 11, '#111b2e', '#818cf8', 'MUNICIPAL COMPLEX');
    createBuildingBlock(65, -40, 26, 40, 13, '#19253e', '#38bdf8', 'TECH DISTRICT');
    createBuildingBlock(-65, 10, 26, 40, 12, '#121d30', '#38bdf8', 'METRO PLAZA');
    createBuildingBlock(65, 10, 26, 40, 15, '#172238', '#ffb95f', 'LOGISTICS HUB');
    createBuildingBlock(-65, 60, 26, 40, 10, '#111b2e', '#4edea3', 'SOUTHERN PRECINCT');

    // ─── DESTINATION HOSPITAL (CITY GENERAL HOSPITAL AT X = 48, Z = 120) ────
    const hospitalGroup = new THREE.Group();
    hospitalGroup.position.set(48, 0, 120);

    const hospBodyGeo = new THREE.BoxGeometry(32, 18, 42);
    const hospBodyMat = new THREE.MeshStandardMaterial({
      color: '#162234',
      roughness: 0.4,
      metalness: 0.6,
    });
    const hospBody = new THREE.Mesh(hospBodyGeo, hospBodyMat);
    hospBody.position.y = 9;
    hospBody.castShadow = true;
    hospBody.receiveShadow = true;
    hospitalGroup.add(hospBody);

    const hospTrimGeo = new THREE.BoxGeometry(33, 0.5, 43);
    const hospTrimMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.3 });
    const hospTrim = new THREE.Mesh(hospTrimGeo, hospTrimMat);
    hospTrim.position.y = 18.2;
    hospitalGroup.add(hospTrim);

    const crossVGeo = new THREE.BoxGeometry(0.2, 5.0, 1.5);
    const crossHGeo = new THREE.BoxGeometry(0.2, 1.5, 5.0);
    const crossMat = new THREE.MeshBasicMaterial({ color: '#ff4444' });

    const crossV = new THREE.Mesh(crossVGeo, crossMat);
    crossV.position.set(-16.1, 10.0, 0);
    hospitalGroup.add(crossV);

    const crossH = new THREE.Mesh(crossHGeo, crossMat);
    crossH.position.set(-16.1, 10.0, 0);
    hospitalGroup.add(crossH);

    const bayGlow = new THREE.PointLight('#38bdf8', 2.5, 30);
    bayGlow.position.set(-17, 3.5, 0);
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
      color: '#34d399',
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
      color: '#38bdf8',
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

    // Procedural Fallback Mesh Group
    const proceduralAmbGroup = new THREE.Group();

    const ambChassisGeo = new THREE.BoxGeometry(3.2, 2.4, 7.0);
    const ambChassisMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.3,
      metalness: 0.2,
    });
    const ambChassis = new THREE.Mesh(ambChassisGeo, ambChassisMat);
    ambChassis.position.y = 1.4;
    ambChassis.castShadow = true;
    ambChassis.receiveShadow = true;
    proceduralAmbGroup.add(ambChassis);

    const stripeGeo = new THREE.BoxGeometry(3.25, 0.5, 7.05);
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#ff5451', roughness: 0.4 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 1.3;
    proceduralAmbGroup.add(stripe);

    const roofCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 2.4), stripeMat);
    roofCrossV.position.set(0, 2.65, 0);
    proceduralAmbGroup.add(roofCrossV);

    const roofCrossH = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.8), stripeMat);
    roofCrossH.position.set(0, 2.65, 0);
    proceduralAmbGroup.add(roofCrossH);

    const glassGeo = new THREE.BoxGeometry(3.0, 0.9, 1.4);
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#060e20',
      roughness: 0.1,
      metalness: 0.9,
    });
    const windshield = new THREE.Mesh(glassGeo, glassMat);
    windshield.position.set(0, 1.8, 2.4);
    proceduralAmbGroup.add(windshield);

    const wheelGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#091122', roughness: 0.9 });

    const w1 = new THREE.Mesh(wheelGeo, wheelMat);
    w1.rotation.z = Math.PI / 2;
    w1.position.set(-1.6, 0.6, 2.2);
    proceduralAmbGroup.add(w1);

    const w2 = new THREE.Mesh(wheelGeo, wheelMat);
    w2.rotation.z = Math.PI / 2;
    w2.position.set(1.6, 0.6, 2.2);
    proceduralAmbGroup.add(w2);

    const w3 = new THREE.Mesh(wheelGeo, wheelMat);
    w3.rotation.z = Math.PI / 2;
    w3.position.set(-1.6, 0.6, -2.2);
    proceduralAmbGroup.add(w3);

    const w4 = new THREE.Mesh(wheelGeo, wheelMat);
    w4.rotation.z = Math.PI / 2;
    w4.position.set(1.6, 0.6, -2.2);
    proceduralAmbGroup.add(w4);

    ambGroup.add(proceduralAmbGroup);
    proceduralAmbMeshRef.current = proceduralAmbGroup;

    // Dual Roof Emergency Strobe Lights
    const strobeLightGeo = new THREE.SphereGeometry(0.35, 12, 12);

    const strobeRedMat = new THREE.MeshBasicMaterial({ color: '#ff0000' });
    const strobeRedMesh = new THREE.Mesh(strobeLightGeo, strobeRedMat);
    strobeRedMesh.position.set(-0.9, 2.7, 2.0);
    ambGroup.add(strobeRedMesh);
    ambStrobeRedMatRef.current = strobeRedMat;

    const strobeBlueMat = new THREE.MeshBasicMaterial({ color: '#0066ff' });
    const strobeBlueMesh = new THREE.Mesh(strobeLightGeo, strobeBlueMat);
    strobeBlueMesh.position.set(0.9, 2.7, 2.0);
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

      // Smooth Lerp for Traffic Vehicles
      vehicleMeshesRef.current.forEach((mesh, id) => {
        const targetState = vehicleTargetsRef.current.get(id);
        if (!targetState) return;

        mesh.position.lerp(targetState.targetPos, 0.12);

        let deltaRot = targetState.targetRotY - targetState.currentRotY;
        while (deltaRot < -Math.PI) deltaRot += Math.PI * 2;
        while (deltaRot > Math.PI) deltaRot -= Math.PI * 2;

        targetState.currentRotY += deltaRot * 0.12;
        mesh.rotation.y = targetState.currentRotY;

        // Dynamic Brake Light Glow
        const taillightMat = vehicleTaillightMatsRef.current.get(id);
        if (taillightMat) {
          const isBraking = targetState.speedKmh < 5 || targetState.speedKmh < targetState.prevSpeedKmh - 3;
          if (isBraking) {
            taillightMat.color.setHex(0xff0000);
            taillightMat.emissive.setHex(0xff0000);
            taillightMat.emissiveIntensity = 1.2;
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
    const vehicles = telemetry?.traffic.vehicles ?? [];

    if (amb) {
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

    // Dynamic Emergency Corridor Ribbons (Stretches across active sequence)
    if (corridorActiveRibbonRef.current && corridorFutureRibbonRef.current) {
      const isActiveMission = isRunning && amb?.status !== 'STAGED' && amb?.status !== 'ARRIVED';

      if (isActiveMission && amb) {
        const ambP = mapSumoTo3D(amb.x, amb.y);
        const nextSigId = amb.nextSignal ?? 'SIG-01';

        let targetZ = -64;
        if (nextSigId === 'SIG-02') targetZ = -16;
        else if (nextSigId === 'SIG-03') targetZ = 32;
        else if (nextSigId === 'SIG-04') targetZ = 80;
        else if (nextSigId === 'HOSPITAL' || ambP.z > 70) targetZ = 120;

        const activeLen = Math.max(1, targetZ - ambP.z);
        const activeCenterZ = ambP.z + activeLen / 2;

        corridorActiveRibbonRef.current.visible = true;
        corridorActiveRibbonRef.current.scale.set(1, activeLen, 1);
        corridorActiveRibbonRef.current.position.set(0, 0.04, activeCenterZ);
        (corridorActiveRibbonRef.current.material as THREE.MeshBasicMaterial).opacity = 0.28;

        if (targetZ < 120) {
          const futureLen = 120 - targetZ;
          const futureCenterZ = targetZ + futureLen / 2;

          corridorFutureRibbonRef.current.visible = true;
          corridorFutureRibbonRef.current.scale.set(1, futureLen, 1);
          corridorFutureRibbonRef.current.position.set(0, 0.035, futureCenterZ);
          (corridorFutureRibbonRef.current.material as THREE.MeshBasicMaterial).opacity = 0.10;
        } else {
          corridorFutureRibbonRef.current.visible = false;
        }
      } else {
        corridorActiveRibbonRef.current.visible = false;
        corridorFutureRibbonRef.current.visible = false;
      }
    }

    // Render Normal Traffic Vehicles (CAR-01 to CAR-04)
    if (vehiclesGroupRef.current) {
      const currentIds = new Set<string>();

      vehicles
        .filter((v) => v.id !== 'AMB-01')
        .forEach((v) => {
          currentIds.add(v.id);
          const p = mapSumoTo3D(v.x, v.y, v.angle);

          let carGroup = vehicleMeshesRef.current.get(v.id);
          let targetState = vehicleTargetsRef.current.get(v.id);

          if (!carGroup) {
            carGroup = new THREE.Group();

            const bodyGeo = new THREE.BoxGeometry(2.8, 1.6, 6.0);
            const carColor = v.color || '#4edea3';
            const bodyMat = new THREE.MeshStandardMaterial({
              color: carColor,
              roughness: 0.4,
              metalness: 0.5,
            });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.9;
            body.castShadow = true;
            body.receiveShadow = true;
            carGroup.add(body);

            const glassGeo = new THREE.BoxGeometry(2.5, 0.7, 1.2);
            const glassMat = new THREE.MeshStandardMaterial({ color: '#060e20', metalness: 0.8 });
            const glass = new THREE.Mesh(glassGeo, glassMat);
            glass.position.set(0, 1.3, 1.0);
            carGroup.add(glass);

            const headlightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
            const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), headlightMat);
            hl1.position.set(-1.0, 0.9, 3.05);
            carGroup.add(hl1);

            const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), headlightMat);
            hl2.position.set(1.0, 0.9, 3.05);
            carGroup.add(hl2);

            const taillightMat = new THREE.MeshStandardMaterial({ color: '#ff5451', roughness: 0.3 });
            const tl1 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), taillightMat);
            tl1.position.set(-1.0, 0.9, -3.05);
            carGroup.add(tl1);

            const tl2 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), taillightMat);
            tl2.position.set(1.0, 0.9, -3.05);
            carGroup.add(tl2);

            vehicleTaillightMatsRef.current.set(v.id, taillightMat);

            carGroup.position.set(p.x, 0, p.z);
            carGroup.rotation.y = p.rotY;

            vehiclesGroupRef.current?.add(carGroup);
            vehicleMeshesRef.current.set(v.id, carGroup);

            targetState = {
              targetPos: new THREE.Vector3(p.x, 0, p.z),
              targetRotY: p.rotY,
              currentRotY: p.rotY,
              speedKmh: v.speedKmh,
              prevSpeedKmh: v.speedKmh,
              color: carColor,
            };
            vehicleTargetsRef.current.set(v.id, targetState);
          } else if (targetState) {
            targetState.prevSpeedKmh = targetState.speedKmh;
            targetState.speedKmh = v.speedKmh;
            targetState.targetPos.set(p.x, 0, p.z);
            targetState.targetRotY = p.rotY;
          }
        });

      vehicleMeshesRef.current.forEach((mesh, id) => {
        if (!currentIds.has(id)) {
          vehiclesGroupRef.current?.remove(mesh);
          vehicleMeshesRef.current.delete(id);
          vehicleTargetsRef.current.delete(id);
          vehicleTaillightMatsRef.current.delete(id);
        }
      });
    }

    // Update Floating HUD Overlay Badges (Ambulance, 4 Junctions, Hospital, Traffic)
    if (cameraRef.current && containerRef.current) {
      const labels: Array<{
        id: string;
        label: string;
        x: number;
        y: number;
        category?: 'ambulance' | 'junction' | 'hospital' | 'traffic';
        status?: string;
      }> = [];
      const tempVec = new THREE.Vector3();
      const rect = containerRef.current.getBoundingClientRect();

      // 1. Ambulance Badge
      if (ambGroupRef.current && amb) {
        tempVec.setFromMatrixPosition(ambGroupRef.current.matrixWorld);
        tempVec.y += 3.8;
        tempVec.project(cameraRef.current);

        const x = ((tempVec.x + 1) * rect.width) / 2;
        const y = ((-tempVec.y + 1) * rect.height) / 2;

        labels.push({
          id: 'AMB-01',
          label: `🚑 AMB-01 • ${amb.speedKmh} km/h`,
          x,
          y,
          category: 'ambulance',
        });
      }

      // 2. All 4 Junctions (SIG-01, SIG-02, SIG-03, SIG-04)
      SIGNAL_CONFIGS.forEach((sigCfg) => {
        const sig = telemetry?.signals.find((s) => s.id === sigCfg.id);
        const sigState = sig?.emergencyState ?? 'NORMAL';

        tempVec.set(-14.0, 16.5, sigCfg.worldZ);
        tempVec.project(cameraRef.current!);

        labels.push({
          id: `${sigCfg.id}-HUD`,
          label: `${sigCfg.id} • ${sigCfg.name} [${sigState}]`,
          x: ((tempVec.x + 1) * rect.width) / 2,
          y: ((-tempVec.y + 1) * rect.height) / 2,
          category: 'junction',
          status: sigState,
        });
      });

      // 3. Destination Hospital Landmark Badge
      tempVec.set(48, 20.0, 120);
      tempVec.project(cameraRef.current);
      labels.push({
        id: 'HOSPITAL-HUD',
        label: `🏥 City General Hospital • Trauma Center`,
        x: ((tempVec.x + 1) * rect.width) / 2,
        y: ((-tempVec.y + 1) * rect.height) / 2,
        category: 'hospital',
      });

      // 4. Normal Traffic Vehicle Badges
      vehicleMeshesRef.current.forEach((group, id) => {
        const targetState = vehicleTargetsRef.current.get(id);
        const isBraking = targetState ? targetState.speedKmh < 5 : false;

        tempVec.setFromMatrixPosition(group.matrixWorld);
        tempVec.y += 2.8;
        tempVec.project(cameraRef.current!);

        const x = ((tempVec.x + 1) * rect.width) / 2;
        const y = ((-tempVec.y + 1) * rect.height) / 2;

        labels.push({
          id,
          label: isBraking ? `${id} • HOLDING (RED)` : `${id} • ${targetState?.speedKmh ?? 30} km/h`,
          x,
          y,
          category: 'traffic',
          status: isBraking ? 'HOLDING' : 'MOVING',
        });
      });

      setHudLabels(labels);
    }
  }, [telemetry, followAmbulance, strobeState]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Three.js WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating 3D HUD Badges Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {hudLabels.map((item) => {
          if (item.x < -100 || item.x > 1600 || item.y < -50 || item.y > 1000) return null;

          let badgeStyle = 'bg-[#060e20]/85 text-[#dae2fd] border-[#334155]';
          if (item.category === 'ambulance') {
            badgeStyle = 'bg-[#060e20]/95 text-[#ffb3ad] border-[#ff5451] shadow-[0_0_12px_rgba(255,84,81,0.4)]';
          } else if (item.category === 'hospital') {
            badgeStyle = 'bg-[#060e20]/95 text-[#4edea3] border-[#4edea3] shadow-[0_0_12px_rgba(78,222,163,0.3)]';
          } else if (item.category === 'junction') {
            if (item.status === 'EMERGENCY PRIORITY' || item.status === 'PRIORITY') {
              badgeStyle = 'bg-[#060e20]/95 text-[#4edea3] border-[#4edea3] shadow-[0_0_16px_rgba(78,222,163,0.5)] font-bold';
            } else if (item.status === 'PREPARING') {
              badgeStyle = 'bg-[#060e20]/95 text-[#ffb95f] border-[#ffb95f] shadow-[0_0_12px_rgba(255,185,95,0.4)] font-bold';
            } else if (item.status === 'RESTORED') {
              badgeStyle = 'bg-[#060e20]/95 text-[#38bdf8] border-[#38bdf8]';
            } else {
              badgeStyle = 'bg-[#060e20]/85 text-[#dae2fd] border-[#334155]';
            }
          } else if (item.category === 'traffic' && item.status === 'HOLDING') {
            badgeStyle = 'bg-[#060e20]/95 text-[#ffb95f] border-[#ffb95f]';
          }

          return (
            <div
              key={item.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded text-[11px] font-data font-semibold shadow-lg border backdrop-blur-md transition-all duration-75 ${badgeStyle}`}
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

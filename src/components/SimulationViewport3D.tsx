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

  // Signal bulb references
  const sig01RedBulbRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sig01YellowBulbRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sig01GreenBulbRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sig01LightRef = useRef<THREE.PointLight | null>(null);
  const sig01PriorityPlaneRef = useRef<THREE.Mesh | null>(null);

  const sig02RedBulbRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sig02YellowBulbRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sig02GreenBulbRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sig02LightRef = useRef<THREE.PointLight | null>(null);
  const sig02PriorityPlaneRef = useRef<THREE.Mesh | null>(null);

  // Emergency Corridor Ribbon Objects
  const corridorActiveRibbonRef = useRef<THREE.Mesh | null>(null);
  const corridorFutureRibbonRef = useRef<THREE.Mesh | null>(null);

  // HTML overlay positioning for HUD labels
  const [hudLabels, setHudLabels] = useState<
    Array<{ id: string; label: string; x: number; y: number; isAmb?: boolean; isBraking?: boolean }>
  >([]);

  // Convert SUMO (sumoX, sumoY, sumoAngle) to 3D World space (X, Y, Z, rotationY)
  // SUMO corridor geometry: N_START (100, 300) -> SIG-01 (100, 200) -> SIG-02 (100, 100) -> HOSPITAL (100, 0)
  // In 3D World:
  // Z = -130 at N_START (y=300), Z = -40 at SIG-01 (y=200), Z = 40 at SIG-02 (y=100), Z = 120 at HOSPITAL (y=0)
  // X = 0 at sumoX=100
  const mapSumoTo3D = (sumoX: number, sumoY: number, sumoAngle: number = 180) => {
    const worldZ = ((150 - sumoY) / 150) * 120;
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
    scene.fog = new THREE.FogExp2('#060e20', 0.0025);
    sceneRef.current = scene;

    // 2. Camera (Presentation Camera Framing - Focused on AMB-01 & Next Signal)
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(22, 24, -95);
    camera.lookAt(0, 1.2, -35);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 250;
    controlsRef.current = controls;

    // 5. Ambient & Key Lighting
    const ambientLight = new THREE.AmbientLight('#1e293b', 2.0);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight('#38bdf8', '#0f172a', 1.0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#e2e8f0', 2.5);
    dirLight.position.set(70, 110, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 300;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    dirLight.shadow.camera.top = 170;
    dirLight.shadow.camera.bottom = -170;
    scene.add(dirLight);

    // ─── GROUND PLANE & ENVIRONMENT ──────────────────────────────────────────
    const groundGeo = new THREE.PlaneGeometry(450, 500);
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

    // ─── EXPANDED PROMINENT ROAD CORRIDOR (WIDTH = 26 UNITS) ────────────────
    const boulevardGeo = new THREE.PlaneGeometry(26, 320);
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: '#121a2b',
      roughness: 0.7,
      metalness: 0.2,
    });
    const boulevard = new THREE.Mesh(boulevardGeo, asphaltMat);
    boulevard.rotation.x = -Math.PI / 2;
    boulevard.position.set(0, 0, 0);
    boulevard.receiveShadow = true;
    scene.add(boulevard);

    // Sidewalk Curbs along Boulevard
    const curbGeo = new THREE.BoxGeometry(1.4, 0.2, 320);
    const curbMat = new THREE.MeshStandardMaterial({ color: '#2a364f', roughness: 0.5 });
    
    const curbLeft = new THREE.Mesh(curbGeo, curbMat);
    curbLeft.position.set(-13.7, 0.1, 0);
    scene.add(curbLeft);

    const curbRight = new THREE.Mesh(curbGeo, curbMat);
    curbRight.position.set(13.7, 0.1, 0);
    scene.add(curbRight);

    // Center Double Yellow Lines
    const yellowLineGeo = new THREE.PlaneGeometry(0.35, 320);
    const yellowLineMat = new THREE.MeshBasicMaterial({ color: '#ffb95f' });
    
    const yellowLine1 = new THREE.Mesh(yellowLineGeo, yellowLineMat);
    yellowLine1.rotation.x = -Math.PI / 2;
    yellowLine1.position.set(-0.35, 0.02, 0);
    scene.add(yellowLine1);

    const yellowLine2 = new THREE.Mesh(yellowLineGeo, yellowLineMat);
    yellowLine2.rotation.x = -Math.PI / 2;
    yellowLine2.position.set(0.35, 0.02, 0);
    scene.add(yellowLine2);

    // White Dashed Lane Dividers
    const dashedGeo = new THREE.PlaneGeometry(0.25, 3.5);
    const dashedMat = new THREE.MeshBasicMaterial({ color: '#dae2fd', opacity: 0.6, transparent: true });
    
    for (let z = -150; z <= 150; z += 8) {
      if ((z >= -48 && z <= -32) || (z >= 32 && z <= 48)) continue; // Skip intersections
      const dashLeft = new THREE.Mesh(dashedGeo, dashedMat);
      dashLeft.rotation.x = -Math.PI / 2;
      dashLeft.position.set(-6.5, 0.02, z);
      scene.add(dashLeft);

      const dashRight = new THREE.Mesh(dashedGeo, dashedMat);
      dashRight.rotation.x = -Math.PI / 2;
      dashRight.position.set(6.5, 0.02, z);
      scene.add(dashRight);
    }

    // Cross Street 1 (at Z = -40, width 20 along Z, length 160 along X)
    const cross1Geo = new THREE.PlaneGeometry(160, 20);
    const cross1 = new THREE.Mesh(cross1Geo, asphaltMat);
    cross1.rotation.x = -Math.PI / 2;
    cross1.position.set(0, 0.01, -40);
    cross1.receiveShadow = true;
    scene.add(cross1);

    // Cross Street 2 (at Z = 40, width 20 along Z, length 160 along X)
    const cross2Geo = new THREE.PlaneGeometry(160, 20);
    const cross2 = new THREE.Mesh(cross2Geo, asphaltMat);
    cross2.rotation.x = -Math.PI / 2;
    cross2.position.set(0, 0.01, 40);
    cross2.receiveShadow = true;
    scene.add(cross2);

    // ─── INTERSECTION ROAD MARKINGS (STOP LINES & ZEBRA CROSSWALKS) ──────────
    const createIntersectionMarkings = (centerZ: number) => {
      const stopLineGeo = new THREE.PlaneGeometry(24, 1.0);
      const stopLineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

      // Stop Lines (Northbound & Southbound entrances)
      const stopLineNorth = new THREE.Mesh(stopLineGeo, stopLineMat);
      stopLineNorth.rotation.x = -Math.PI / 2;
      stopLineNorth.position.set(0, 0.03, centerZ - 11);
      scene.add(stopLineNorth);

      const stopLineSouth = new THREE.Mesh(stopLineGeo, stopLineMat);
      stopLineSouth.rotation.x = -Math.PI / 2;
      stopLineSouth.position.set(0, 0.03, centerZ + 11);
      scene.add(stopLineSouth);

      // Zebra Crosswalk Stripes
      const stripeGeo = new THREE.PlaneGeometry(1.4, 0.5);
      const stripeMat = new THREE.MeshBasicMaterial({ color: '#e2e8f0', opacity: 0.9, transparent: true });

      [-9.5, 9.5].forEach((zOffset) => {
        for (let x = -11; x <= 11; x += 2.2) {
          const stripe = new THREE.Mesh(stripeGeo, stripeMat);
          stripe.rotation.x = -Math.PI / 2;
          stripe.position.set(x, 0.025, centerZ + zOffset);
          scene.add(stripe);
        }
      });
    };

    createIntersectionMarkings(-40);
    createIntersectionMarkings(40);

    // ─── STREET LIGHT POLES ALONG SIDEWALKS ───────────────────────────────
    const createStreetLamp = (x: number, z: number, isRight: boolean) => {
      const lampGroup = new THREE.Group();
      lampGroup.position.set(x, 0, z);

      const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 8, 12);
      const poleMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 4.0;
      lampGroup.add(pole);

      // Arm extending over road
      const armGeo = new THREE.BoxGeometry(3.0, 0.15, 0.15);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(isRight ? -1.5 : 1.5, 7.9, 0);
      lampGroup.add(arm);

      // Light Fixture & Soft Cyan PointLight
      const fixtureGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const fixtureMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(isRight ? -2.8 : 2.8, 7.7, 0);
      lampGroup.add(fixture);

      const lampLight = new THREE.PointLight('#38bdf8', 1.4, 25);
      lampLight.position.set(isRight ? -2.8 : 2.8, 7.5, 0);
      lampGroup.add(lampLight);

      scene.add(lampGroup);
    };

    [-130, -90, -50, -10, 30, 70, 110].forEach((z) => {
      createStreetLamp(-14.5, z, false);
      createStreetLamp(14.5, z, true);
    });

    // ─── BACKGROUND CITY BUILDINGS (SET BACK AT X <= -75 & X >= 75) ─────────
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

      // Main facade body (Low height to serve as background backdrop)
      const bodyGeo = new THREE.BoxGeometry(width, height, depth);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.5,
        metalness: 0.5,
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

    // Buildings are set back to X = -75 and X = +75 (BACKGROUND ONLY!)
    createBuildingBlock(-75, -100, 30, 70, 14, '#111b2e', '#38bdf8', 'TECH PARK A');
    createBuildingBlock(75, -100, 30, 70, 16, '#172238', '#ffb95f', 'COMMERCIAL PLAZA');
    createBuildingBlock(-75, 0, 30, 55, 12, '#111b2e', '#818cf8', 'FINANCIAL TOWER');
    createBuildingBlock(75, 0, 30, 55, 15, '#19253e', '#38bdf8', 'CIVIC CENTER');
    createBuildingBlock(-75, 95, 30, 55, 10, '#111b2e', '#4edea3', 'RESIDENTIAL DISTRICT');

    // Asynchronously Load External Static City Environment GLB (SCALED DOWN FOR BACKGROUND)
    const cityLoader = new GLTFLoader();
    cityLoader.load(
      '/models/city/low_poly_city.glb',
      (gltf) => {
        const cityModel = gltf.scene;
        cityModel.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });
        cityModel.scale.set(0.03, 0.03, 0.03);
        cityModel.position.set(-85, 0, -40);
        buildingGroup.add(cityModel);

        const cityModel2 = cityModel.clone();
        cityModel2.position.set(85, 0, -40);
        cityModel2.rotation.y = Math.PI;
        buildingGroup.add(cityModel2);
        console.log('[ResQX 3D] low_poly_city.glb loaded cleanly in background!');
      },
      undefined,
      (err) => {
        console.warn('[ResQX 3D] low_poly_city.glb load failed, procedural fallback active:', err);
      }
    );

    // ─── DESTINATION HOSPITAL (SET BACK AT X = 65, Z = 115) ─────────────────
    const hospitalGroup = new THREE.Group();
    hospitalGroup.position.set(65, 0, 115);

    // Main Hospital Building (Procedural Fallback)
    const hospBodyGeo = new THREE.BoxGeometry(38, 20, 48);
    const hospBodyMat = new THREE.MeshStandardMaterial({
      color: '#132338',
      roughness: 0.3,
      metalness: 0.7,
    });
    const hospBody = new THREE.Mesh(hospBodyGeo, hospBodyMat);
    hospBody.position.y = 10;
    hospBody.castShadow = true;
    hospBody.receiveShadow = true;
    hospitalGroup.add(hospBody);

    // Glowing Green Roof Trim
    const hospTrimGeo = new THREE.BoxGeometry(39, 0.6, 49);
    const hospTrimMat = new THREE.MeshBasicMaterial({ color: '#4edea3' });
    const hospTrim = new THREE.Mesh(hospTrimGeo, hospTrimMat);
    hospTrim.position.y = 20.3;
    hospitalGroup.add(hospTrim);

    // 3D Emergency Cross Symbol on Roof
    const crossVGeo = new THREE.BoxGeometry(3.0, 1.0, 12);
    const crossHGeo = new THREE.BoxGeometry(12, 1.0, 3.0);
    const crossMat = new THREE.MeshBasicMaterial({ color: '#4edea3' });

    const crossV = new THREE.Mesh(crossVGeo, crossMat);
    crossV.position.set(-6, 21.0, 0);
    hospitalGroup.add(crossV);

    const crossH = new THREE.Mesh(crossHGeo, crossMat);
    crossH.position.set(-6, 21.0, 0);
    hospitalGroup.add(crossH);

    // Helipad Circle & "H" on Roof
    const helipadRingGeo = new THREE.RingGeometry(6, 7.5, 32);
    const helipadRingMat = new THREE.MeshBasicMaterial({ color: '#4edea3', side: THREE.DoubleSide });
    const helipadRing = new THREE.Mesh(helipadRingGeo, helipadRingMat);
    helipadRing.rotation.x = -Math.PI / 2;
    helipadRing.position.set(10, 20.4, 0);
    hospitalGroup.add(helipadRing);

    // Ambulance Bay Entrance Glow
    const bayGlow = new THREE.PointLight('#4edea3', 4, 40);
    bayGlow.position.set(-20, 5, -5);
    hospitalGroup.add(bayGlow);

    scene.add(hospitalGroup);

    // Asynchronously Load External Hospital GLB Model
    const hospLoader = new GLTFLoader();
    hospLoader.load(
      '/models/hospital/low_poly_hospital.glb',
      (gltf) => {
        const hospModel = gltf.scene;
        hospModel.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });
        const bbox = new THREE.Box3().setFromObject(hospModel);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const scaleFactor = 32 / (Math.max(size.x, size.z) || 1);
        hospModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
        hospModel.rotation.y = -Math.PI / 2;
        hospModel.position.set(0, 0, 0);

        hospitalGroup.remove(hospBody);
        hospitalGroup.add(hospModel);
        console.log('[ResQX 3D] low_poly_hospital.glb loaded cleanly!');
      },
      undefined,
      (err) => {
        console.warn('[ResQX 3D] low_poly_hospital.glb load failed, procedural fallback active:', err);
      }
    );

    // ─── HIGHLY READABLE TRAFFIC SIGNALS (SIG-01 & SIG-02, HEIGHT = 16) ──────
    const createSignalGantry = (z: number, id: string) => {
      const gantry = new THREE.Group();
      gantry.position.set(0, 0, z);

      // Support Posts at sidewalk edges
      const postGeo = new THREE.CylinderGeometry(0.4, 0.4, 16, 16);
      const postMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8 });

      const postLeft = new THREE.Mesh(postGeo, postMat);
      postLeft.position.set(-14.2, 8, 0);
      gantry.add(postLeft);

      const postRight = new THREE.Mesh(postGeo, postMat);
      postRight.position.set(14.2, 8, 0);
      gantry.add(postRight);

      // Overhead Crossbar Truss
      const barGeo = new THREE.BoxGeometry(28.8, 0.5, 0.5);
      const bar = new THREE.Mesh(barGeo, postMat);
      bar.position.set(0, 15.5, 0);
      gantry.add(bar);

      // Signal Housing Box (Enlarged for readability)
      const boxGeo = new THREE.BoxGeometry(5.5, 2.0, 1.0);
      const boxMat = new THREE.MeshStandardMaterial({ color: '#091122', metalness: 0.9, roughness: 0.2 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(-6.5, 14.5, 0);
      gantry.add(box);

      // 3 Signal Light Bulbs (Enlarged Red, Yellow, Green)
      const bulbGeo = new THREE.SphereGeometry(0.75, 16, 16);

      const redMat = new THREE.MeshStandardMaterial({ color: '#690005', roughness: 0.3 });
      const yellowMat = new THREE.MeshStandardMaterial({ color: '#472a00', roughness: 0.3 });
      const greenMat = new THREE.MeshStandardMaterial({ color: '#003824', roughness: 0.3 });

      const redBulb = new THREE.Mesh(bulbGeo, redMat);
      redBulb.position.set(-8.0, 14.5, 0.4);
      gantry.add(redBulb);

      const yellowBulb = new THREE.Mesh(bulbGeo, yellowMat);
      yellowBulb.position.set(-6.5, 14.5, 0.4);
      gantry.add(yellowBulb);

      const greenBulb = new THREE.Mesh(bulbGeo, greenMat);
      greenBulb.position.set(-5.0, 14.5, 0.4);
      gantry.add(greenBulb);

      // Asynchronously Load External Traffic Light GLB
      const sigLoader = new GLTFLoader();
      sigLoader.load(
        '/models/signals/city_traffic_light.glb',
        (gltf) => {
          const sigModel = gltf.scene;
          sigModel.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              c.castShadow = true;
              c.receiveShadow = true;
            }
          });
          const bbox = new THREE.Box3().setFromObject(sigModel);
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const scaleFactor = 14 / (size.y || 1);
          sigModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
          sigModel.position.set(-14.2, 0, 0);
          gantry.add(sigModel);
          console.log(`[ResQX 3D] city_traffic_light.glb loaded cleanly for ${id}!`);
        },
        undefined,
        (err) => {
          console.warn(`[ResQX 3D] city_traffic_light.glb load failed for ${id}:`, err);
        }
      );

      // Emergency Light PointLight
      const sigLight = new THREE.PointLight('#4edea3', 0, 30);
      sigLight.position.set(0, 14, 0);
      gantry.add(sigLight);

      // Priority Road Surface Glow Frame (Width 28, Length 22)
      const priorityFrameGeo = new THREE.PlaneGeometry(28, 22);
      const priorityFrameMat = new THREE.MeshBasicMaterial({
        color: '#4edea3',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const priorityFrame = new THREE.Mesh(priorityFrameGeo, priorityFrameMat);
      priorityFrame.rotation.x = -Math.PI / 2;
      priorityFrame.position.set(0, 0.03, 0);
      gantry.add(priorityFrame);

      scene.add(gantry);

      if (id === 'SIG-01') {
        sig01RedBulbRef.current = redMat;
        sig01YellowBulbRef.current = yellowMat;
        sig01GreenBulbRef.current = greenMat;
        sig01LightRef.current = sigLight;
        sig01PriorityPlaneRef.current = priorityFrame;
      } else {
        sig02RedBulbRef.current = redMat;
        sig02YellowBulbRef.current = yellowMat;
        sig02GreenBulbRef.current = greenMat;
        sig02LightRef.current = sigLight;
        sig02PriorityPlaneRef.current = priorityFrame;
      }
    };

    createSignalGantry(-40, 'SIG-01');
    createSignalGantry(40, 'SIG-02');

    // ─── EMERGENCY CORRIDOR RIBBONS ──────────────────────────────────────────
    const activeRibbonGeo = new THREE.PlaneGeometry(14, 1);
    const activeRibbonMat = new THREE.MeshBasicMaterial({
      color: '#4edea3',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const activeRibbon = new THREE.Mesh(activeRibbonGeo, activeRibbonMat);
    activeRibbon.rotation.x = -Math.PI / 2;
    activeRibbon.position.set(0, 0.04, 0);
    scene.add(activeRibbon);
    corridorActiveRibbonRef.current = activeRibbon;

    const futureRibbonGeo = new THREE.PlaneGeometry(8, 1);
    const futureRibbonMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const futureRibbon = new THREE.Mesh(futureRibbonGeo, futureRibbonMat);
    futureRibbon.rotation.x = -Math.PI / 2;
    futureRibbon.position.set(0, 0.035, 0);
    scene.add(futureRibbon);
    corridorFutureRibbonRef.current = futureRibbon;

    // ─── PROMINENT AMBULANCE (AMB-01) 3D MESH & GLTF LOADER ──────────────────
    const ambGroup = new THREE.Group();
    scene.add(ambGroup);
    ambGroupRef.current = ambGroup;

    // Procedural Fallback Mesh Group (Length 7.0)
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

    // Asynchronously Load External ambulance.glb Model (Scaled to ~7.0 units)
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
        console.log('[ResQX 3D] Real ambulance.glb integrated successfully! Scale:', scaleFactor);
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

        // Presentation Follow Camera Lerp (Keeps AMB-01 in lower-middle viewport)
        if (followAmbulance && cameraRef.current && controlsRef.current) {
          const ambP = ambGroupRef.current.position;
          controlsRef.current.target.lerp(new THREE.Vector3(ambP.x, 1.2, ambP.z + 18), 0.12);
          cameraRef.current.position.lerp(new THREE.Vector3(ambP.x + 18, 20, ambP.z - 28), 0.12);
        }
      }

      // Smooth Lerp for Traffic Vehicles (CAR-01 to CAR-04)
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

  // Update Dynamic 3D Targets on Telemetry Change
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

    const updateSignalState = (
      sigId: 'SIG-01' | 'SIG-02',
      redMat: THREE.MeshStandardMaterial | null,
      yellowMat: THREE.MeshStandardMaterial | null,
      greenMat: THREE.MeshStandardMaterial | null,
      light: THREE.PointLight | null,
      priorityPlane: THREE.Mesh | null
    ) => {
      const sig = telemetry?.signals.find((s) => s.id === sigId);
      const state = sig?.emergencyState ?? 'NORMAL';

      if (!redMat || !yellowMat || !greenMat || !light || !priorityPlane) return;

      if (state === 'EMERGENCY PRIORITY') {
        redMat.color.setHex(0x690005);
        yellowMat.color.setHex(0x472a00);
        greenMat.color.setHex(0x4edea3);
        greenMat.emissive.setHex(0x4edea3);
        greenMat.emissiveIntensity = 1.2;
        light.color.setHex(0x4edea3);
        light.intensity = 6;

        priorityPlane.visible = true;
        (priorityPlane.material as THREE.MeshBasicMaterial).opacity = 0.35;
      } else if (state === 'PREPARING') {
        redMat.color.setHex(0x690005);
        yellowMat.color.setHex(0xffb95f);
        yellowMat.emissive.setHex(0xffb95f);
        yellowMat.emissiveIntensity = 1.0;
        greenMat.color.setHex(0x003824);
        greenMat.emissiveIntensity = 0;
        light.color.setHex(0xffb95f);
        light.intensity = 3;

        priorityPlane.visible = true;
        (priorityPlane.material as THREE.MeshBasicMaterial).opacity = 0.15;
      } else {
        redMat.color.setHex(0xff5451);
        yellowMat.color.setHex(0x472a00);
        greenMat.color.setHex(0x003824);
        redMat.emissiveIntensity = 0.6;
        yellowMat.emissiveIntensity = 0;
        greenMat.emissiveIntensity = 0;
        light.intensity = 0;

        priorityPlane.visible = false;
      }
    };

    updateSignalState('SIG-01', sig01RedBulbRef.current, sig01YellowBulbRef.current, sig01GreenBulbRef.current, sig01LightRef.current, sig01PriorityPlaneRef.current);
    updateSignalState('SIG-02', sig02RedBulbRef.current, sig02YellowBulbRef.current, sig02GreenBulbRef.current, sig02LightRef.current, sig02PriorityPlaneRef.current);

    if (corridorActiveRibbonRef.current && corridorFutureRibbonRef.current) {
      const isActiveMission = isRunning && amb?.status !== 'STAGED' && amb?.status !== 'ARRIVED';
      
      if (isActiveMission && amb) {
        const ambP = mapSumoTo3D(amb.x, amb.y);
        const nextSigId = amb.nextSignal ?? 'SIG-01';
        let targetZ = -40;
        if (nextSigId === 'SIG-02') targetZ = 40;
        else if (nextSigId === 'HOSPITAL' || ambP.z > 30) targetZ = 120;

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

    // Render Normal Traffic Vehicles (CAR-01 to CAR-04, Scaled to length 6.0)
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

    // Update Floating HUD Overlay Badges
    if (cameraRef.current && containerRef.current) {
      const labels: Array<{ id: string; label: string; x: number; y: number; isAmb?: boolean; isBraking?: boolean }> = [];
      const tempVec = new THREE.Vector3();
      const rect = containerRef.current.getBoundingClientRect();

      if (ambGroupRef.current && amb) {
        tempVec.setFromMatrixPosition(ambGroupRef.current.matrixWorld);
        tempVec.y += 3.8;
        tempVec.project(cameraRef.current);

        const x = ((tempVec.x + 1) * rect.width) / 2;
        const y = ((-tempVec.y + 1) * rect.height) / 2;

        labels.push({
          id: 'AMB-01',
          label: `AMB-01 • ${amb.speedKmh} km/h`,
          x,
          y,
          isAmb: true,
        });
      }

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
          label: isBraking ? `${id} • HOLDING` : id,
          x,
          y,
          isAmb: false,
          isBraking,
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
          if (item.x < 0 || item.x > 1200 || item.y < 0 || item.y > 800) return null;
          return (
            <div
              key={item.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded text-[11px] font-data font-bold shadow-lg border backdrop-blur-md transition-all duration-75 ${
                item.isAmb
                  ? 'bg-[#060e20]/95 text-[#ffb3ad] border-[#ff5451]'
                  : item.isBraking
                  ? 'bg-[#060e20]/95 text-[#ffb95f] border-[#ffb95f]'
                  : 'bg-[#060e20]/85 text-[#dae2fd] border-[#334155]'
              }`}
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

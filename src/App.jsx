import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import helvetikerUrl from 'three/examples/fonts/helvetiker_regular.typeface.json?url';

export default function App() {
  const bgCanvasRef = useRef(null);
  const textCanvasRef = useRef(null);
  const resumeLayerRef = useRef(null);
  const resumeVisibleRef = useRef(false);

  const [resumeVisible, setResumeVisible] = useState(false);
  const [shareLabel, setShareLabel] = useState('Share');
  const [error, setError] = useState('');

  const showResumeLayer = () => {
    resumeVisibleRef.current = true;
    setResumeVisible(true);
  };

  const hideResumeLayer = () => {
    resumeVisibleRef.current = false;
    setResumeVisible(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isClean = params.get('clean') === '1';
    const shouldPrint = params.get('print') === '1';
    if (isClean) showResumeLayer();
    if (shouldPrint) {
      const timerId = window.setTimeout(() => {
        window.print();
      }, 350);
      return () => window.clearTimeout(timerId);
    }
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (resumeVisible) document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') hideResumeLayer();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [resumeVisible]);

  useEffect(() => {
    let cleanup = () => {};

    const init = async () => {
      try {
        const bgCanvas = bgCanvasRef.current;
        const textCanvas = textCanvasRef.current;
        const resumeLayer = resumeLayerRef.current;
        if (!bgCanvas || !textCanvas || !resumeLayer) return;

        const randomSeed = Math.random() * 1000;
        const aspect = window.innerWidth / window.innerHeight;
        let currentAspect = aspect;

        const bgCamera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0, 10);
        bgCamera.position.z = 1;
        const bgScene = new THREE.Scene();
        // Premium: subtle, smoothed mouse influence in UV space (0..1)
        const mouseTargetUv = new THREE.Vector2(Math.random(), Math.random());
        const mouseUv = new THREE.Vector2(mouseTargetUv.x, mouseTargetUv.y);
        const centerUv = new THREE.Vector2(0.5, 0.5);

        const shaderMaterial = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uMouse: { value: mouseUv },
            uAspect: { value: aspect },
            uSeed: { value: randomSeed },
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float uTime;
            uniform vec2 uMouse;
            uniform float uAspect;
            uniform float uSeed;
            varying vec2 vUv;

            void main() {
              vec2 uv = vUv;
              vec2 centered = (uv * 2.0 - 1.0) * vec2(uAspect, 1.0);
              vec2 mouse = (uMouse * 2.0 - 1.0) * vec2(uAspect, 1.0);
              float dist = length(centered - mouse);

              float t = uTime * 0.24 + uSeed * 0.21;
              vec2 flowUv = uv + vec2(
                sin(t * 0.9 + uv.y * 6.5) * 0.045,
                cos(t * 0.75 + uv.x * 5.8) * 0.04
              );
              float bandA = sin((flowUv.x * 4.7 + flowUv.y * 2.9) + t) * 0.5 + 0.5;
              float bandB = cos((flowUv.y * 5.8 - flowUv.x * 2.0) - t * 0.95) * 0.5 + 0.5;
              float ripple = sin(dist * 7.0 - t * 1.6) * 0.5 + 0.5;
              float mixWave = bandA * 0.48 + bandB * 0.44 + ripple * 0.08;

              vec3 charcoal = vec3(0.055, 0.058, 0.070);
              vec3 softIndigo = vec3(0.17, 0.20, 0.30);
              vec3 deepIndigo = vec3(0.11, 0.13, 0.20);
              vec3 grad = mix(charcoal, softIndigo, smoothstep(0.0, 1.0, flowUv.x * 0.32 + flowUv.y * 0.85));
              vec3 col = mix(grad, deepIndigo, mixWave * 0.28);
              col *= 0.94 + mixWave * 0.10;
              col = pow(col, vec3(1.05));

              gl_FragColor = vec4(col, 1.0);
            }
          `,
        });

        const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(2 * aspect, 2), shaderMaterial);
        bgPlane.position.z = -0.5;
        bgScene.add(bgPlane);

        const bgRenderer = new THREE.WebGLRenderer({ antialias: true, canvas: bgCanvas });
        bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        bgRenderer.setSize(window.innerWidth, window.innerHeight);

        const textCamera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, -10, 10);
        textCamera.position.z = 1;
        const textScene = new THREE.Scene();

        const textRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: textCanvas });
        textRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        textRenderer.setSize(window.innerWidth, window.innerHeight);
        textRenderer.setClearColor(0x000000, 0);

        const fontLoader = new FontLoader();
        const font = await fontLoader.loadAsync(helvetikerUrl);

        const fillMat = new THREE.MeshBasicMaterial({ color: 0xe4e9ee, side: THREE.DoubleSide, depthTest: false });
        const strokeMat = new THREE.MeshBasicMaterial({ color: 0xe4e9ee, side: THREE.DoubleSide, depthTest: false });
        const responsiveScale = Math.min(1, Math.max(window.innerWidth / 900, 0.65));
        const H1 = 0.10 * responsiveScale;

        const wordSpecs = [
          { text: 'Pedro Pita', height: H1 },
          { text: 'Resume', height: H1 * 0.6, action: 'resume' },
          { text: 'Studio', height: H1 * 0.48, url: 'https://ironsignalworks.com' },
          { text: 'hello@pedropita.dev', height: H1 * 0.38, url: 'mailto:hello@pedropita.dev' },
        ];
        const DEFAULT_DRAG_PICKUP_OFFSET = -0.2;
        const DEFAULT_INTERACTIVE_PICKUP_OFFSET = 0;

        const WHITE = new THREE.Color(0xe4e9ee);
        const HOVER = new THREE.Color(0xb8d2e6);
        const clickables = [];
        const draggableWords = [];
        let lastHover = null;
        const getCombinedScale = (word) => {
          const baseScale = word.userData.baseScale || 1;
          const hoverScale = word.userData.hoverScale || 1;
          const pulseScale = word.userData.pulseScale || 1;
          return baseScale * hoverScale * pulseScale;
        };
        const applyCombinedScale = (word) => {
          const s = getCombinedScale(word);
          word.scale.set(s, s, 1);
        };

        function makeStrokeText(text, targetHeight, fillMaterial, strokeMaterial) {
          const shapes = font.generateShapes(text, 100);
          const geom = new THREE.ShapeGeometry(shapes);
          geom.computeBoundingBox();
          const bb = geom.boundingBox;
          const xMid = -0.5 * (bb.max.x - bb.min.x);
          const yMid = -0.5 * (bb.max.y - bb.min.y);
          geom.translate(xMid, yMid, 0);

          const group = new THREE.Group();
          const fill = new THREE.Mesh(geom, fillMaterial);
          fill.material.depthTest = false;
          fill.material.depthWrite = false;
          fill.renderOrder = 1;
          group.add(fill);

          const holeShapes = [];
          for (const s of shapes) {
            if (s.holes && s.holes.length) holeShapes.push(...s.holes);
          }
          shapes.push(...holeShapes);

          const style = SVGLoader.getStrokeStyle(5, '#ffffff');
          for (const s of shapes) {
            const pts = s.getPoints();
            const g = SVGLoader.pointsToStroke(pts, style);
            g.translate(xMid, yMid, 0);
            const strokeMesh = new THREE.Mesh(g, strokeMaterial);
            strokeMesh.material.depthTest = false;
            strokeMesh.material.depthWrite = false;
            strokeMesh.renderOrder = 2;
            group.add(strokeMesh);
          }

          const ascender = bb.max.y;
          const baseline = Math.max(bb.min.y, 0);
          const capHeight = Math.max(ascender - baseline, 0.001);
          let scale = targetHeight / capHeight;
          group.scale.set(scale, scale, 1);
          group.userData.baseScale = scale;

          let widthWorld = (bb.max.x - bb.min.x) * scale;
          let worldHeight = (bb.max.y - bb.min.y) * scale;

          const maxWidth = currentAspect * 2 - 0.24;
          const maxHeight = 2 - 0.24;
          const fitScale = Math.min(1, maxWidth / Math.max(widthWorld, 0.001), maxHeight / Math.max(worldHeight, 0.001));
          if (fitScale < 1) {
            scale *= fitScale;
            group.scale.set(scale, scale, 1);
            group.userData.baseScale = scale;
            widthWorld = (bb.max.x - bb.min.x) * scale;
            worldHeight = (bb.max.y - bb.min.y) * scale;
          }

          const hitboxGeom = new THREE.PlaneGeometry(widthWorld + 0.1, worldHeight + 0.1);
          const hitboxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false });
          const hitbox = new THREE.Mesh(hitboxGeom, hitboxMat);
          hitbox.renderOrder = 0;
          group.add(hitbox);

          group.userData.bounds = { width: widthWorld, height: worldHeight };
          group.userData.getMeshes = () => group.children;
          return group;
        }

        const padding = 0.1;
        const maxAnimatedScale = 1.12;
        const maxAttempts = 100;
        const getSafeAreaInsetPx = () => {
          const probe = document.createElement('div');
          probe.style.position = 'fixed';
          probe.style.visibility = 'hidden';
          probe.style.pointerEvents = 'none';
          probe.style.paddingTop = 'env(safe-area-inset-top)';
          probe.style.paddingRight = 'env(safe-area-inset-right)';
          probe.style.paddingBottom = 'env(safe-area-inset-bottom)';
          probe.style.paddingLeft = 'env(safe-area-inset-left)';
          document.body.appendChild(probe);
          const styles = window.getComputedStyle(probe);
          const inset = {
            top: parseFloat(styles.paddingTop) || 0,
            right: parseFloat(styles.paddingRight) || 0,
            bottom: parseFloat(styles.paddingBottom) || 0,
            left: parseFloat(styles.paddingLeft) || 0,
          };
          probe.remove();
          return inset;
        };
        const safeInsetPx = getSafeAreaInsetPx();
        const isMobileViewport = window.matchMedia('(max-width: 720px)').matches;
        const mobileEdgeBiasPx = isMobileViewport
          ? { top: 10, right: 20, bottom: 34, left: 10 }
          : { top: 0, right: 0, bottom: 0, left: 0 };
        const viewportPaddingWorld = 0.03;
        const getEffectiveBounds = (width, height) => ({
          width: width * maxAnimatedScale,
          height: height * maxAnimatedScale,
        });
        const getPlacementBounds = (width, height) => {
          const effective = getEffectiveBounds(width, height);
          const worldPerPxX = (2 * currentAspect) / Math.max(window.innerWidth, 1);
          const worldPerPxY = 2 / Math.max(window.innerHeight, 1);

          const leftInsetWorld = (safeInsetPx.left + mobileEdgeBiasPx.left) * worldPerPxX + viewportPaddingWorld;
          const rightInsetWorld = (safeInsetPx.right + mobileEdgeBiasPx.right) * worldPerPxX + viewportPaddingWorld;
          const topInsetWorld = (safeInsetPx.top + mobileEdgeBiasPx.top) * worldPerPxY + viewportPaddingWorld;
          const bottomInsetWorld =
            (safeInsetPx.bottom + mobileEdgeBiasPx.bottom) * worldPerPxY + viewportPaddingWorld;

          const left = -currentAspect + effective.width / 2 + padding + leftInsetWorld;
          const right = currentAspect - effective.width / 2 - padding - rightInsetWorld;
          const bottom = -1 + effective.height / 2 + padding + bottomInsetWorld;
          const top = 1 - effective.height / 2 - padding - topInsetWorld;

          return { left, right, top, bottom };
        };

        const isOverlapping = (x, y, width, height, existing) => {
          const target = getEffectiveBounds(width, height);
          for (const word of existing) {
            const bounds = getEffectiveBounds(word.userData.bounds.width, word.userData.bounds.height);
            const dx = Math.abs(x - word.position.x);
            const dy = Math.abs(y - word.position.y);
            const minDistX = (target.width + bounds.width) / 2 + padding;
            const minDistY = (target.height + bounds.height) / 2 + padding;
            if (dx < minDistX && dy < minDistY) return true;
          }
          return false;
        };

        const findRandomPosition = (width, height, existing) => {
          const bounds = getPlacementBounds(width, height);
          const canFitX = bounds.left <= bounds.right;
          const canFitY = bounds.bottom <= bounds.top;

          for (let i = 0; i < maxAttempts; i += 1) {
            const x = canFitX ? bounds.left + Math.random() * (bounds.right - bounds.left) : 0;
            const y = canFitY ? bounds.bottom + Math.random() * (bounds.top - bounds.bottom) : 0;
            if (!isOverlapping(x, y, width, height, existing)) return { x, y };
          }

          const col = existing.length % 3;
          const row = Math.floor(existing.length / 3);
          return { x: (col - 1) * 0.5, y: 0.3 - row * 0.3 };
        };

        for (const spec of wordSpecs) {
          const wordGroup = makeStrokeText(spec.text, spec.height, fillMat.clone(), strokeMat.clone());
          const bounds = wordGroup.userData.bounds;
          const pos = findRandomPosition(bounds.width, bounds.height, draggableWords);
          wordGroup.position.set(pos.x, pos.y, 0);
          wordGroup.userData.isDraggableWord = true;
          wordGroup.userData.hoverScale = 1;
          wordGroup.userData.hoverTargetScale = 1;
          wordGroup.userData.pulseScale = 1;
          wordGroup.userData.pulseOffset = Math.random() * Math.PI * 2;
          wordGroup.userData.pulseMix = 0;
          wordGroup.userData.dragPickupOffset = spec.dragPickupOffset ?? DEFAULT_DRAG_PICKUP_OFFSET;
          wordGroup.userData.interactivePickupOffset =
            spec.interactivePickupOffset ?? DEFAULT_INTERACTIVE_PICKUP_OFFSET;
          wordGroup.userData.applyScale = () => applyCombinedScale(wordGroup);

          if (spec.url || spec.action) {
            wordGroup.userData.url = spec.url;
            wordGroup.userData.action = spec.action;
            wordGroup.userData.isLink = true;
            wordGroup.userData.setHover = (hover) => {
              wordGroup.userData.hoverTargetScale = hover ? 1.06 : 1;

              for (const child of wordGroup.children) {
                if (child.material) {
                  if (child.material.color) child.material.color.copy(hover ? HOVER : WHITE);
                  child.material.transparent = true;
                  child.material.opacity = hover ? 1 : 0.94;
                  child.material.needsUpdate = true;
                }
              }
            };
            clickables.push(wordGroup);
          }

          draggableWords.push(wordGroup);
          textScene.add(wordGroup);
        }

        const pointer = new THREE.Vector2(-10, -10);
        let dragTarget = null;
        let dragOffset = new THREE.Vector2();
        let dragMoved = false;
        const pointerDownScreen = new THREE.Vector2();
        const dragThresholdPx = 6;

        const syncPointer = (e) => {
          const rect = textCanvas.getBoundingClientRect();
          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        };

        const findInteractiveWordAt = (worldX, worldY, pickupPadding = 0) => {
          let bestTarget = null;
          let bestScore = Number.POSITIVE_INFINITY;
          for (const word of clickables) {
            const bounds = word.userData.bounds;
            const extraPickup = Math.min(0, word.userData.interactivePickupOffset || 0);
            const halfW = bounds.width / 2 + pickupPadding + extraPickup;
            const halfH = bounds.height / 2 + pickupPadding + extraPickup;
            const dx = worldX - word.position.x;
            const dy = worldY - word.position.y;
            if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
              const score = dx * dx + dy * dy;
              if (score < bestScore) {
                bestScore = score;
                bestTarget = word;
              }
            }
          }
          return bestTarget;
        };

        const triggerWordAction = (word) => {
          if (!word) return false;
          const { url, action } = word.userData;
          if (action === 'resume') {
            showResumeLayer();
            return true;
          }
          if (url) {
            window.open(url, '_blank', 'noopener');
            return true;
          }
          return false;
        };

        const updateHoverState = () => {
          if (resumeVisibleRef.current) {
            if (lastHover) lastHover.userData.setHover(false);
            lastHover = null;
            document.body.classList.remove('hover-link');
            textCanvas.classList.remove('hover-link-zone');
            return;
          }

          const worldX = pointer.x * currentAspect;
          const worldY = pointer.y;
          const hoverGroup = findInteractiveWordAt(worldX, worldY, 0);

          if (hoverGroup !== lastHover) {
            if (lastHover) lastHover.userData.setHover(false);
            if (hoverGroup) hoverGroup.userData.setHover(true);
            lastHover = hoverGroup || null;
            const hasHoverLink = !!lastHover;
            document.body.classList.toggle('hover-link', hasHoverLink);
            textCanvas.classList.toggle('hover-link-zone', hasHoverLink);
          }
        };

        const clampPosition = (word) => {
          const bounds = getPlacementBounds(word.userData.bounds.width, word.userData.bounds.height);
          const minX = Math.min(bounds.left, bounds.right);
          const maxX = Math.max(bounds.left, bounds.right);
          const minY = Math.min(bounds.bottom, bounds.top);
          const maxY = Math.max(bounds.bottom, bounds.top);
          word.position.x = Math.max(minX, Math.min(maxX, word.position.x));
          word.position.y = Math.max(minY, Math.min(maxY, word.position.y));
        };

        for (const word of draggableWords) clampPosition(word);

        const triggerActionAtPointer = (pickupPadding = 0) => {
          if (resumeVisibleRef.current) return false;
          const worldX = pointer.x * currentAspect;
          const worldY = pointer.y;
          const target = findInteractiveWordAt(worldX, worldY, pickupPadding);
          return triggerWordAction(target);
        };

        const onPointerMove = (e) => {
          syncPointer(e);
          // pointer is NDC (-1..1). Convert to UV (0..1)
          if (!resumeVisibleRef.current) {
            mouseTargetUv.set(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);
            mouseTargetUv.x = Math.min(0.85, Math.max(0.15, mouseTargetUv.x));
            mouseTargetUv.y = Math.min(0.85, Math.max(0.15, mouseTargetUv.y));
          }
          if (dragTarget) {
            if (!dragMoved) {
              const dxPx = e.clientX - pointerDownScreen.x;
              const dyPx = e.clientY - pointerDownScreen.y;
              if (Math.hypot(dxPx, dyPx) >= dragThresholdPx) dragMoved = true;
            }
            if (!dragMoved) return;
            const worldX = pointer.x * currentAspect;
            const worldY = pointer.y;
            dragTarget.position.x = worldX - dragOffset.x;
            dragTarget.position.y = worldY - dragOffset.y;
            clampPosition(dragTarget);
            return;
          }
          updateHoverState();
        };

        const onPointerDown = (e) => {
          if (resumeLayer.contains(e.target)) return;
          if (resumeVisibleRef.current) return;
          syncPointer(e);
          updateHoverState();
          pointerDownScreen.set(e.clientX, e.clientY);

          const worldX = pointer.x * currentAspect;
          const worldY = pointer.y;
          const pickupPadding = 0.32;
          let bestTarget = null;
          let bestScore = Number.POSITIVE_INFINITY;

          // Use an expanded rectangular pickup zone around each word.
          for (const word of draggableWords) {
            const bounds = word.userData.bounds;
            const dragPickup = Math.max(-0.22, word.userData.dragPickupOffset || 0);
            const halfW = bounds.width / 2 + pickupPadding + dragPickup;
            const halfH = bounds.height / 2 + pickupPadding + dragPickup;
            const dx = worldX - word.position.x;
            const dy = worldY - word.position.y;
            if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
              const score = dx * dx + dy * dy;
              if (score < bestScore) {
                bestScore = score;
                bestTarget = word;
              }
            }
          }

          if (bestTarget) {
            dragTarget = bestTarget;
            dragOffset.set(worldX - dragTarget.position.x, worldY - dragTarget.position.y);
            dragMoved = false;
          }
        };

        const onPointerUp = (e) => {
          if (resumeLayer.contains(e.target)) return;
          if (resumeVisibleRef.current) return;
          const wasDragging = dragMoved;
          dragTarget = null;
          dragMoved = false;
          if (!wasDragging) triggerActionAtPointer();
        };

        const onResize = () => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const newAspect = w / h;
          currentAspect = newAspect;

          bgRenderer.setSize(w, h);
          bgCamera.left = -newAspect;
          bgCamera.right = newAspect;
          bgCamera.updateProjectionMatrix();
          bgPlane.scale.set(newAspect, 1, 1);
          shaderMaterial.uniforms.uAspect.value = newAspect;

          textRenderer.setSize(w, h);
          textCamera.left = -newAspect;
          textCamera.right = newAspect;
          textCamera.updateProjectionMatrix();

          for (const word of draggableWords) clampPosition(word);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('resize', onResize);

        let rafId = 0;
        let introStart = null;
        const animate = (t = 0) => {
          if (introStart === null) introStart = t * 0.001;
          const elapsed = t * 0.001 - introStart;
          // Premium smoothing: slow follow, tiny influence.
          const mouseLerp = 0.045;
          if (resumeVisibleRef.current) mouseTargetUv.lerp(centerUv, 0.02);
          mouseUv.lerp(mouseTargetUv, mouseLerp);

          if (elapsed > 0.05) {
            bgCanvas.classList.add('ready');
          }

          const activeHoverWord = resumeVisibleRef.current ? null : lastHover;
          for (const word of draggableWords) {
            const hoverTargetScale = word.userData.hoverTargetScale || 1;
            const hoverScale = word.userData.hoverScale || 1;
            word.userData.hoverScale = hoverScale + (hoverTargetScale - hoverScale) * 0.12;

            const pulseMixTarget = word === activeHoverWord ? 1 : 0;
            const pulseMix = word.userData.pulseMix || 0;
            word.userData.pulseMix = pulseMix + (pulseMixTarget - pulseMix) * 0.1;

            if (word === activeHoverWord) {
              const pulseOffset = word.userData.pulseOffset || 0;
              const pulse = Math.sin(elapsed * 1.35 + pulseOffset) * 0.03 * word.userData.pulseMix;
              word.userData.pulseScale = 1 + pulse;
            } else {
              const pulseOffset = word.userData.pulseOffset || 0;
              const pulse = Math.sin(elapsed * 1.35 + pulseOffset) * 0.03 * word.userData.pulseMix;
              word.userData.pulseScale = 1 + pulse;
            }
            applyCombinedScale(word);
          }

          shaderMaterial.uniforms.uTime.value = t * 0.001;
          bgRenderer.render(bgScene, bgCamera);
          textRenderer.render(textScene, textCamera);
          rafId = window.requestAnimationFrame(animate);
        };
        animate();

        cleanup = () => {
          window.cancelAnimationFrame(rafId);
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerdown', onPointerDown);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('resize', onResize);
          document.body.classList.remove('hover-link');
          textCanvas.classList.remove('hover-link-zone');
          const disposeMaterial = (material) => {
            if (!material) return;
            if (Array.isArray(material)) {
              for (const mat of material) mat.dispose();
              return;
            }
            material.dispose();
          };
          const disposeSceneResources = (scene) => {
            scene.traverse((obj) => {
              if (obj.geometry) obj.geometry.dispose();
              if (obj.material) disposeMaterial(obj.material);
            });
          };
          disposeSceneResources(textScene);
          if (bgPlane.geometry) bgPlane.geometry.dispose();
          disposeMaterial(shaderMaterial);
          fillMat.dispose();
          strokeMat.dispose();
          bgRenderer.dispose();
          textRenderer.dispose();
        };
      } catch (err) {
        setError(`Critical Error: ${err.message}`);
      }
    };

    init();
    return () => cleanup();
  }, []);

  const onDownload = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('clean', '1');
    url.searchParams.set('print', '1');

    const isMobile =
      window.matchMedia('(max-width: 720px)').matches ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    if (isMobile) {
      if (!resumeVisibleRef.current) showResumeLayer();
      window.setTimeout(() => {
        window.print();
      }, 120);
      return;
    }

    const printTab = window.open(url.toString(), '_blank', 'noopener');
    if (!printTab) {
      if (!resumeVisibleRef.current) showResumeLayer();
      window.setTimeout(() => {
        window.print();
      }, 120);
    }
  };

  const onShare = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('clean', '1');

    const shareData = {
      title: 'Pedro Pita - Resume',
      text: 'Resume - Frontend Engineer & Web Systems Developer',
      url: url.toString(),
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // ignore
      }
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareData.url);
        setShareLabel('Link copied!');
        setTimeout(() => setShareLabel('Share'), 1400);
      } catch {
        window.prompt('Copy this URL:', shareData.url);
      }
      return;
    }

    window.prompt('Copy this URL:', shareData.url);
  };

  return (
    <>
      <div id="error" style={{ display: error ? 'block' : 'none' }}>
        {error}
      </div>

      <canvas id="bgCanvas" ref={bgCanvasRef} />
      <canvas id="textCanvas" ref={textCanvasRef} className={resumeVisible ? 'hidden' : ''} />

        <div
          id="resumeLayer"
          ref={resumeLayerRef}
          className={resumeVisible ? 'visible' : ''}
          onClick={(event) => {
            if (event.target === event.currentTarget) hideResumeLayer();
          }}
        >
        <div className="resume-content cv cv-panel">
          <section className="cv-page page-1 section">
            <header>
              <div className="header-top">
                <h1>Pedro Pita</h1>
                <div className="actions actions--header">
                  <button className="btn" type="button" onClick={hideResumeLayer}>
                    Close
                  </button>
                  <button className="btn" id="shareBtn" type="button" onClick={onShare}>
                    {shareLabel}
                  </button>
                  <button className="btn" id="downloadBtn" type="button" onClick={onDownload}>
                    Save as PDF
                  </button>
                </div>
              </div>
              <p className="lead-line">Frontend Engineer &middot; React &amp; TypeScript &middot; Interactive Web Systems</p>
              <p className="lead-line">
                Lisbon, Portugal &middot; Remote OK &middot; <a href="mailto:hello@pedropita.dev">hello@pedropita.dev</a>
              </p>
              <p className="lead-line">
                <a href="https://www.linkedin.com/in/pedropitadev/" target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
                {' '} &middot;{' '}
                <a href="https://ironsignalworks.com" target="_blank" rel="noreferrer">ironsignalworks.com</a> &middot;{' '}
                <a href="https://github.com/IronSignalWorks" target="_blank" rel="noreferrer">GitHub</a>
              </p>
            </header>

            <h2>Summary</h2>
            <p className="copy-primary">
              Frontend engineer building production web applications, developer tools, and interactive browser systems using <span className="cv-key">React</span>, <span className="cv-key">TypeScript</span>, and <span className="cv-key">Node.js</span>.
            </p>
            <p className="copy-secondary">
              Experience includes <span className="cv-key">Agile</span> product delivery, internal developer tooling, interactive browser systems, and full deployment ownership.
            </p>

            <h2>Core Competencies</h2>
            <ul className="plain-list">
              <li>Frontend engineering with <span className="cv-key">React</span>, <span className="cv-key">TypeScript</span>, and modern <span className="cv-key">JavaScript</span> ecosystems.</li>
              <li><span className="cv-key">UI architecture</span>, component systems, accessibility standards, and performance optimization.</li>
              <li>Backend integration with <span className="cv-key">Node.js</span>, <span className="cv-key">REST APIs</span>, authentication flows, and data persistence.</li>
              <li>Deployment and infrastructure ownership: domains, hosting, <span className="cv-key">CI/CD pipelines</span>, analytics, and monitoring.</li>
              <li>Interactive browser systems leveraging <span className="cv-key">Canvas</span>, <span className="cv-key">WebGL</span>, and <span className="cv-key">WebAudio APIs</span>.</li>
              <li><span className="cv-key">Agile delivery environments</span>: sprint planning, backlog refinement, and iterative product releases.</li>
              <li>Modern development workflows including <span className="cv-key">AI-assisted tooling</span>, automated testing support, and accelerated code review cycles.</li>
            </ul>

            <h2>Experience</h2>
            <p className="role-title">
              <strong>Iron Signal Works - Web Systems Engineer</strong>
            </p>
            <p className="lead-line">2024 - Present &middot; Independent Studio</p>
            <ul>
              <li>Designed, built, and shipped production websites and web applications from initial scope through deployment.</li>
              <li>Developed <span className="cv-key">React</span> dashboards and internal tools integrated with <span className="cv-key">Node APIs</span> and database workflows.</li>
              <li>Implemented production infrastructure including domain management, hosting, <span className="cv-key">CI/CD pipelines</span>, analytics, and monitoring.</li>
              <li>Built interactive browser systems using <span className="cv-key">WebGL</span> rendering pipelines and <span className="cv-key">WebAudio</span> integration.</li>
              <li>Delivered production systems including developer tools, interactive browser applications, and client-facing platforms.</li>
              <li>Maintained codebases and delivered technical handoff documentation for client teams.</li>
            </ul>
            <p className="lead-line">
              Selected work:{' '}
              <a href="https://ironsignalworks.com/#work-start" target="_blank" rel="noreferrer">
                https://ironsignalworks.com/#work-start
              </a>
            </p>

            <p className="role-title">
              <strong>Carpe Data - Analyst, Product Delivery</strong>
            </p>
            <p className="lead-line">2021 - 2024</p>
            <ul>
              <li>Improved dashboard load times by 35% through frontend optimization, caching strategy, and query restructuring.</li>
              <li>Automated reporting workflows to improve consistency of operational data delivery.</li>
              <li>Improved fraud-detection workflows, reducing manual review workload and improving operational efficiency.</li>
              <li>Delivered production features in cross-functional collaboration with engineering and product teams.</li>
            </ul>
          </section>

          <section className="cv-page page-2 section">
            <h2>Technical Stack</h2>
            <ul className="plain-list">
              <li><strong>Frontend:</strong> <span className="cv-key">React</span>, <span className="cv-key">TypeScript</span>, <span className="cv-key">JavaScript</span>, <span className="cv-key">Vite</span>, Tailwind.</li>
              <li><strong>Backend:</strong> <span className="cv-key">Node.js</span>, Express, <span className="cv-key">REST APIs</span>, authentication, data integration.</li>
              <li><strong>Data:</strong> <span className="cv-key">SQL</span>, SQLite, MongoDB, Supabase.</li>
              <li><strong>Interactive:</strong> <span className="cv-key">Canvas</span>, <span className="cv-key">WebGL</span>, Three.js, GLSL, <span className="cv-key">WebAudio API</span>.</li>
              <li><strong>Infrastructure:</strong> <span className="cv-key">CI/CD</span>, Cloudflare, Render, Railway, monitoring/analytics.</li>
              <li><strong>Dev Tools:</strong> <span className="cv-key">Git</span>, GitHub, IDE-centric development.</li>
              <li><strong>Workflow:</strong> <span className="cv-key">Agile</span> delivery, <span className="cv-key">AI agents</span>, <span className="cv-key">prompt engineering</span>.</li>
              <li><strong>Design:</strong> <span className="cv-key">Figma</span>, Adobe CC, UI implementation from design systems.</li>
            </ul>

            <h2>Education</h2>
            <p>Faculdade de Letras da Universidade de Coimbra (FLUC) - Estudos Artisticos (Cinema)</p>
            <p>Additional training: Python, SQL, Git, Power BI.</p>
            <h2>Languages</h2>
            <p>Portuguese - Native</p>
            <p>English - C2</p>
          </section>
        </div>
      </div>
    </>
  );
}

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
    if (resumeLayerRef.current) resumeLayerRef.current.scrollTop = 0;
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
    if (isClean) showResumeLayer();
  }, []);

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
        const staticMouse = new THREE.Vector2(Math.random(), Math.random());

        const shaderMaterial = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uMouse: { value: staticMouse },
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

              float t = uTime * 0.18 + uSeed;
              float x = uv.x * 6.0 + t;
              float y = uv.y * 6.0 - t * 0.6 + uSeed * 0.5;

              float v1 = sin(x + uSeed);
              float v2 = cos(y);
              float v3 = sin(x + y + uSeed * 0.3);
              float ripple = sin(dist * 12.0 - t * 3.0 + uSeed) * 0.7;
              float v = v1 * 0.5 + v2 * 0.5 + v3 * 0.5 + ripple;

              vec3 base = sin(vec3(v, v + 1.57, v + 3.14159));

              float ang = uTime * 0.6 + uSeed * 0.2;
              float ca = cos(ang);
              float sa = sin(ang);

              mat3 rot = mat3(
                ca, -sa, 0.0,
                sa,  ca, 0.0,
                0.0, 0.0, 1.0
              );

              vec3 col = rot * base;
              col = pow(col * 0.5 + 0.5, vec3(1.1));

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
        textRenderer.setPixelRatio(window.devicePixelRatio);
        textRenderer.setSize(window.innerWidth, window.innerHeight);
        textRenderer.setClearColor(0x000000, 0);

        let scrollAccumulator = 0;
        const scrollThreshold = 100;
        let touchLastY = null;
        let touchSwipeAccumulator = 0;

        const onWheel = (event) => {
          if (resumeVisibleRef.current) {
            if (resumeLayer.scrollTop <= 0 && event.deltaY < 0) {
              event.preventDefault();
              hideResumeLayer();
              scrollAccumulator = 0;
            }
          } else {
            scrollAccumulator += event.deltaY;
            if (scrollAccumulator > scrollThreshold) {
              showResumeLayer();
              scrollAccumulator = 0;
            } else if (scrollAccumulator < -scrollThreshold) {
              scrollAccumulator = 0;
            }
          }
        };

        const onTouchStart = (event) => {
          if (event.touches.length) {
            touchLastY = event.touches[0].clientY;
            touchSwipeAccumulator = 0;
          }
        };

        const onTouchMove = (event) => {
          if (touchLastY === null || !event.touches.length) return;
          const currentY = event.touches[0].clientY;
          const deltaY = touchLastY - currentY;
          touchLastY = currentY;

          if (resumeVisibleRef.current) {
            if (resumeLayer.scrollTop <= 0 && deltaY < -scrollThreshold * 0.5) {
              hideResumeLayer();
            }
            return;
          }

          touchSwipeAccumulator += deltaY;
          if (touchSwipeAccumulator > scrollThreshold) {
            showResumeLayer();
            touchSwipeAccumulator = 0;
          }
        };

        const onTouchEnd = () => {
          touchLastY = null;
        };

        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });

        const fontLoader = new FontLoader();
        const font = await fontLoader.loadAsync(helvetikerUrl);

        const fillMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false });
        const strokeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false });
        const responsiveScale = Math.min(1, Math.max(window.innerWidth / 900, 0.65));
        const H1 = 0.10 * responsiveScale;

        const wordSpecs = [
          { text: 'Pedro Pita', height: H1, url: 'https://www.linkedin.com/in/pedropitadev/' },
          { text: 'Resume', height: H1 * 0.6, action: 'resume' },
          { text: 'Studio', height: H1 * 0.48, url: 'https://ironsignalworks.com' },
          { text: 'hello@pedropita.dev', height: H1 * 0.38, url: 'mailto:hello@pedropita.dev' },
        ];

        const WHITE = new THREE.Color(0xffffff);
        const HOVER = new THREE.Color(0x9fd4ff);
        const clickables = [];
        const draggableWords = [];
        let lastHover = null;

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
          const scale = targetHeight / capHeight;
          group.scale.set(scale, scale, 1);
          group.userData.baseScale = scale;

          const widthWorld = (bb.max.x - bb.min.x) * scale;
          const worldHeight = (bb.max.y - bb.min.y) * scale;

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
        const maxAttempts = 100;

        const isOverlapping = (x, y, width, height, existing) => {
          for (const word of existing) {
            const bounds = word.userData.bounds;
            const dx = Math.abs(x - word.position.x);
            const dy = Math.abs(y - word.position.y);
            const minDistX = (width + bounds.width) / 2 + padding;
            const minDistY = (height + bounds.height) / 2 + padding;
            if (dx < minDistX && dy < minDistY) return true;
          }
          return false;
        };

        const findRandomPosition = (width, height, existing) => {
          const marginX = width / 2 + padding;
          const marginY = height / 2 + padding;
          const maxX = currentAspect - marginX;
          const maxY = 1 - marginY;

          for (let i = 0; i < maxAttempts; i += 1) {
            const x = (Math.random() * 2 - 1) * maxX;
            const y = (Math.random() * 2 - 1) * maxY;
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

          if (spec.url || spec.action) {
            wordGroup.userData.url = spec.url;
            wordGroup.userData.action = spec.action;
            wordGroup.userData.isLink = true;
            wordGroup.userData.setHover = (hover) => {
              const baseScale = wordGroup.userData.baseScale || 1;
              const lift = hover ? 1.08 : 1;
              wordGroup.scale.set(baseScale * lift, baseScale * lift, 1);

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
        let didDrag = false;
        let suppressNextClick = false;

        const syncPointer = (e) => {
          const rect = textCanvas.getBoundingClientRect();
          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        };

        const findInteractiveWordAt = (worldX, worldY, pickupPadding = 0.22) => {
          let bestTarget = null;
          let bestScore = Number.POSITIVE_INFINITY;
          for (const word of clickables) {
            const bounds = word.userData.bounds;
            const halfW = bounds.width / 2 + pickupPadding;
            const halfH = bounds.height / 2 + pickupPadding;
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
          const hoverGroup = findInteractiveWordAt(worldX, worldY, 0.2);

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
          const bounds = word.userData.bounds;
          const maxX = currentAspect - bounds.width / 2 - padding;
          const maxY = 1 - bounds.height / 2 - padding;
          word.position.x = Math.max(-maxX, Math.min(maxX, word.position.x));
          word.position.y = Math.max(-maxY, Math.min(maxY, word.position.y));
        };

        const triggerActionAtPointer = (pickupPadding = 0.26) => {
          if (resumeVisibleRef.current) return false;
          const worldX = pointer.x * currentAspect;
          const worldY = pointer.y;
          const target = findInteractiveWordAt(worldX, worldY, pickupPadding);
          return triggerWordAction(target);
        };

        const onPointerMove = (e) => {
          syncPointer(e);
          if (dragTarget) {
            dragMoved = true;
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
          didDrag = false;

          const worldX = pointer.x * currentAspect;
          const worldY = pointer.y;
          const pickupPadding = 0.32;
          let bestTarget = null;
          let bestScore = Number.POSITIVE_INFINITY;

          // Use an expanded rectangular pickup zone around each word.
          for (const word of draggableWords) {
            const bounds = word.userData.bounds;
            const halfW = bounds.width / 2 + pickupPadding;
            const halfH = bounds.height / 2 + pickupPadding;
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
          didDrag = wasDragging;
          dragTarget = null;
          dragMoved = false;
          if (!wasDragging && triggerActionAtPointer()) suppressNextClick = true;
        };

        const onClick = (e) => {
          if (resumeLayer.contains(e.target)) return;
          if (resumeVisibleRef.current) return;
          if (suppressNextClick) {
            suppressNextClick = false;
            return;
          }
          if (didDrag) {
            didDrag = false;
            return;
          }
          triggerActionAtPointer();
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
        window.addEventListener('click', onClick);
        window.addEventListener('resize', onResize);

        let rafId = 0;
        const animate = (t = 0) => {
          shaderMaterial.uniforms.uTime.value = t * 0.001;
          bgRenderer.render(bgScene, bgCamera);
          textRenderer.render(textScene, textCamera);
          rafId = window.requestAnimationFrame(animate);
        };
        animate();

        cleanup = () => {
          window.cancelAnimationFrame(rafId);
          window.removeEventListener('wheel', onWheel);
          window.removeEventListener('touchstart', onTouchStart);
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('touchend', onTouchEnd);
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerdown', onPointerDown);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('click', onClick);
          window.removeEventListener('resize', onResize);
          document.body.classList.remove('hover-link');
          textCanvas.classList.remove('hover-link-zone');
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
    window.print();
  };

  const onShare = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('clean', '1');

    const shareData = {
      title: 'Pedro Pita - Resume',
      text: 'Resume - Frontend Developer & Web Systems Engineer',
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

      <div id="mobileCTA" aria-label="Mobile resume controls">
        <span>Need a resume?</span>
        <button className="mobileCTA__btn" type="button" id="mobileResumeBtn" onClick={showResumeLayer}>
          View resume
        </button>
        <a className="mobileCTA__link" href="mailto:hello@pedropita.dev">
          Email
        </a>
      </div>

      {!resumeVisible && (
        <div
          id="scrollCue"
          role="button"
          tabIndex={0}
          onClick={showResumeLayer}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') showResumeLayer();
          }}
          aria-label="Scroll to CV"
        >
          <span>Scroll to CV</span>
          <span aria-hidden="true">↓</span>
        </div>
      )}

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
        <div className="resume-content">
          <div className="actions">
            <button className="btn" id="shareBtn" type="button" onClick={onShare}>
              {shareLabel}
            </button>
            <button className="btn" id="downloadBtn" type="button" onClick={onDownload}>
              Download PDF
            </button>
          </div>

          <section className="cv-page page-1">
            <h1>Pedro Pita - Frontend Developer | React &amp; Web Systems</h1>
            <p className="lead-line">
              Lisbon, Portugal &middot; Remote OK &middot; <a href="mailto:hello@pedropita.dev">hello@pedropita.dev</a> &middot;{' '}
              <a href="https://www.linkedin.com/in/pedropitadev/" target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </p>
            <p className="lead-line">
              <a href="https://pedropita.dev" target="_blank" rel="noreferrer">Portfolio</a> &middot;{' '}
              <a href="https://ironsignalworks.com" target="_blank" rel="noreferrer">ironsignalworks.com</a> &middot;{' '}
              <a href="https://github.com/IronSignalWorks" target="_blank" rel="noreferrer">GitHub</a>
            </p>

            <h2>Summary</h2>
            <p>
              Frontend developer building fast, maintainable web interfaces and browser-native applications. Experienced in React systems,
              Node-backed tools, and performance-focused delivery. I ship production websites, dashboards, and interactive systems with strong
              emphasis on clarity, scalability, and clean handoff.
            </p>

            <h2>Core Skills</h2>
            <div className="skills-grid">
              <div className="skill-group">
                <h3>Frontend &amp; Architecture</h3>
                <p>React &middot; TypeScript &middot; Component systems &middot; Performance &middot; Accessibility</p>
              </div>
              <div className="skill-group">
                <h3>Full-Stack Delivery</h3>
                <p>Node &middot; APIs &middot; Auth &middot; Databases &middot; Deployment &middot; CI/CD</p>
              </div>
              <div className="skill-group">
                <h3>Interactive Systems</h3>
                <p>WebGL &middot; Canvas &middot; WebAudio &middot; Data visualization &middot; Real-time UI</p>
              </div>
            </div>

            <h2>Experience</h2>
            <p className="role-title">
              <strong>Iron Signal Works - Frontend Developer &amp; Web Systems Engineer (2024-Present)</strong>
            </p>
            <ul>
              <li>Shipped production-ready websites for service and commerce clients with strong SEO and fast performance metrics.</li>
              <li>Built React dashboards and internal tools backed by Node/Express APIs and lightweight auth systems.</li>
              <li>Delivered full deployment pipelines including domains, hosting, CI/CD, analytics, and monitoring.</li>
              <li>Created reusable component structures and maintainable architecture for rapid multi-project delivery.</li>
              <li>Developed browser-native interactive systems combining WebGL, WebAudio, and real-time UI logic.</li>
            </ul>

            <p className="role-title">
              <strong>Carpe Data - Analyst, Product Delivery (2021-2024)</strong>
            </p>
            <ul>
              <li>Improved dashboard load times by 35% through query restructuring, caching strategy, and frontend optimization.</li>
              <li>Automated reporting workflows and improved data pipeline reliability across product operations.</li>
              <li>Enhanced fraud detection workflows, reducing manual review time and improving decision accuracy.</li>
              <li>Delivered production features in cross-functional collaboration with engineering and product teams.</li>
            </ul>
          </section>

          <section className="cv-page page-2">
            <h2>Technical Stack</h2>
            <p>
              <strong>Web &amp; Runtime:</strong> JavaScript &middot; TypeScript &middot; React &middot; Node.js &middot; Express &middot; Vite
              &middot; Tailwind &middot; REST APIs
            </p>
            <p>
              <strong>Graphics &amp; Interactive Systems:</strong> Canvas &middot; WebGL &middot; Three.js &middot; GLSL &middot; Procedural
              visuals
            </p>
            <p>
              <strong>Audio &amp; Interactive:</strong> WebAudio API &middot; Max/MSP &middot; p5.js &middot; DSP chains &middot; UI sound
              systems
            </p>
            <p>
              <strong>Data &amp; Ops:</strong> MongoDB &middot; Supabase &middot; SQLite &middot; SQL &middot; Python (Data) &middot; CI/CD
              &middot; Docker &middot; Railway &middot; Render &middot; Vercel &middot; Netlify
            </p>
            <p>
              <strong>Design &amp; Tooling:</strong> Figma &middot; Adobe CC &middot; UX engineering &amp; prototyping
            </p>

            <h2>Interactive Systems &amp; Creative Engineering</h2>
            <ul>
              <li>Design and implementation of browser-native interactive audio systems and visual engines.</li>
              <li>Development of responsive UI sound suites, adaptive audio environments, and sequencing tools.</li>
              <li>Integration of visual/audio pipelines for interactive media and live capture workflows.</li>
            </ul>

            <h2>Education</h2>
            <p>Faculdade de Letras da Universidade de Coimbra (FLUC) - Estudos Artisticos - Cinema</p>
            <p>
              Complemented by technical training in Python (Data), SQL, Git, Power BI, and web development through self-directed production work.
            </p>
            <p>Languages: Portuguese (Native), English (C2)</p>
          </section>
        </div>
      </div>
    </>
  );
}

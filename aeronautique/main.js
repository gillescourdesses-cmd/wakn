/**
 * Wakn × Aéronautique — Landing 3D « Vol »
 *
 * Portage de la classe `Component` (référence .dc.html) en module vanilla.
 * Logique inchangée : scène Three.js r128, keyframes caméra interpolés par la
 * progression de scroll `p`, bascule des modèles (extérieur GLB / cabine Collada),
 * recolorisation du hangar, dé-branding du fuselage, et moteur de scroll « snap ».
 *
 * Les refs React (`this.xRef.current`) sont remplacées par un accès paresseux au
 * DOM via `domRef(id)`, qui expose la même API `.current`.
 */
(function () {
  'use strict';

  // Équivalent vanilla de React.createRef() ciblant un élément par id.
  function domRef(id) {
    return { get current() { return document.getElementById(id); } };
  }

  class WaknVol {
    constructor() {
      this.canvasRef = domRef('canvasRef');
      this.trackRef = domRef('trackRef');
      this.overlayRef = domRef('overlayRef');
      this.bgRef = domRef('bgRef');
      this.barRef = domRef('barRef');
      this.hintRef = domRef('hintRef');
      this.railRef = domRef('railRef');
      this.loaderRef = domRef('loaderRef');
      this.loaderBarRef = domRef('loaderBarRef');
      this.loaderTxtRef = domRef('loaderTxtRef');
      this.scrimRef = domRef('scrimRef');
      this.menuRef = domRef('menuRef');
      this.navLogoRef = domRef('navLogoRef');
      this.expertiseRef = domRef('expertiseRef');
      this.vignetteRef = domRef('vignetteRef');
      this.navRef = domRef('navRef');
    }

    // --- handlers (anciennement renderVals) ---
    openMenu() { const m = this.menuRef.current; if (m) { m.style.transform = 'translateY(0)'; m.style.pointerEvents = 'auto'; } }
    closeMenu() { const m = this.menuRef.current; if (m) { m.style.transform = 'translateY(-100%)'; m.style.pointerEvents = 'none'; } }
    goStage(e) { if (e && e.preventDefault) e.preventDefault(); const tr = this.trackRef.current; if (!tr) return; const cs = [0.04, 0.31, 0.53, 0.72, 0.93]; const i = +e.currentTarget.dataset.stage; this._idx = i; const sc = tr.offsetHeight - window.innerHeight; this._snapTo(Math.round(tr.offsetTop + cs[i] * sc)); }

    _bindUI() {
      document.querySelectorAll('[data-action="openMenu"]').forEach((el) => el.addEventListener('click', () => this.openMenu()));
      document.querySelectorAll('[data-action="closeMenu"]').forEach((el) => el.addEventListener('click', () => this.closeMenu()));
      document.querySelectorAll('.rail-btn').forEach((el) => el.addEventListener('click', (e) => this.goStage(e)));
    }

    mount() {
      this._bindUI();
      this._p = 0; this._tp = 0; this._t = 0; this._mt = { x: 0, y: 0 }; this._mo = { x: 0, y: 0 };
      this._modelReady = false; this._extReady = false; this._loaderHidden = false; this._idx = 0;
      this._initThree();
      this._onMouse = (e) => { this._mt.x = (e.clientX / window.innerWidth - 0.5) * 2; this._mt.y = (e.clientY / window.innerHeight - 0.5) * 2; };
      window.addEventListener('mousemove', this._onMouse, { passive: true });
      this._stops = [0.04, 0.31, 0.53, 0.72, 0.92];
      this._lastY = window.scrollY; this._scrollDir = 0;
      this._onScrollSnap = () => { const y = window.scrollY; this._scrollDir = y - this._lastY; this._lastY = y; if (this._snapping) return; if (this._snapTimer) clearTimeout(this._snapTimer); this._snapTimer = setTimeout(() => this._snap(), 165); };
      window.addEventListener('scroll', this._onScrollSnap, { passive: true });

      this._wheelLock = false;
      this._armUnlock = () => {
        clearTimeout(this._wheelCd);
        this._wheelCd = setTimeout(() => { if (this._snapping) this._armUnlock(); else this._wheelLock = false; }, 150);
      };
      const canCapture = (dir) => {
        const tr = this.trackRef.current; if (!tr) return null;
        const sc = tr.offsetHeight - window.innerHeight; if (sc <= 0) return null;
        const rect = tr.getBoundingClientRect();
        const inPinned = rect.top <= 1 && rect.bottom >= window.innerHeight - 1;
        if (!inPinned) return null;
        const last = this._stops.length - 1;
        if (dir > 0 && this._idx >= last) return null;   // sortir vers les sections du bas
        if (dir < 0 && this._idx <= 0) return null;       // remonter en haut de page
        return { tr, sc, last };
      };
      const fireStep = (dir) => {
        const ctx = canCapture(dir); if (!ctx) return false;   // geste non capturé -> scroll natif (sortie)
        this._armUnlock();                                      // tout geste réarme le verrou (anti-inertie)
        if (this._wheelLock || this._snapping) return true;     // déjà en transition : on bloque
        const ni = Math.max(0, Math.min(ctx.last, this._idx + dir));
        if (ni === this._idx) return true;
        this._idx = ni;
        this._wheelLock = true;
        this._snapTo(Math.round(ctx.tr.offsetTop + this._stops[ni] * ctx.sc));
        return true;
      };
      this._onWheel = (e) => { const d = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0); if (!d) return; if (fireStep(d)) e.preventDefault(); };
      window.addEventListener('wheel', this._onWheel, { passive: false });
      this._onKey = (e) => {
        let d = 0;
        if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Spacebar') d = 1;
        else if (e.key === 'ArrowUp' || e.key === 'PageUp') d = -1;
        if (!d) return; if (fireStep(d)) e.preventDefault();
      };
      window.addEventListener('keydown', this._onKey);
      this._touchY = null;
      this._onTS = (e) => { this._touchY = e.touches && e.touches[0] ? e.touches[0].clientY : null; };
      this._onTM = (e) => {
        if (this._touchY == null) return;
        const y = e.touches && e.touches[0] ? e.touches[0].clientY : this._touchY;
        const dy = this._touchY - y;
        if (Math.abs(dy) < 26) return;
        const d = dy > 0 ? 1 : -1;
        if (fireStep(d)) { e.preventDefault(); this._touchY = null; }
      };
      window.addEventListener('touchstart', this._onTS, { passive: true });
      window.addEventListener('touchmove', this._onTM, { passive: false });
    }
    _snap() {
      const tr = this.trackRef.current; if (!tr) return;
      const sc = tr.offsetHeight - window.innerHeight; if (sc <= 0) return;
      // hors de la zone épinglée (sections du bas, ex. « Nos expertises ») : ne pas snapper,
      // sinon on ramène l'utilisateur de force dans la scène 3D.
      const rect = tr.getBoundingClientRect();
      if (!(rect.top <= 1 && rect.bottom >= window.innerHeight - 1)) return;
      const top = tr.offsetTop;
      const p = (window.scrollY - top) / sc;
      const stops = this._stops, last = stops.length - 1;
      if (this._idx == null) this._idx = 0;
      // allow exiting the pinned section at the ends
      if (this._idx >= last && this._scrollDir > 0) return;
      if (this._idx <= 0 && this._scrollDir < 0 && p <= stops[0] + 0.002) return;
      let ti = this._idx;
      if (this._scrollDir > 1) { let f = stops.findIndex((s) => s > p + 0.004); if (f === -1) f = last; ti = Math.min(this._idx + 1, f); }
      else if (this._scrollDir < -1) { let b = 0; for (let k = last; k >= 0; k--) { if (stops[k] < p - 0.004) { b = k; break; } } ti = Math.max(this._idx - 1, b); }
      else { let bd = 9; stops.forEach((s, k) => { const d = Math.abs(p - s); if (d < bd) { bd = d; ti = k; } }); }
      ti = Math.max(0, Math.min(last, ti));
      this._idx = ti;
      const targetY = Math.round(top + stops[ti] * sc);
      if (Math.abs(targetY - window.scrollY) < 6) return;
      this._snapTo(targetY);
    }
    _snapTo(targetY) {
      if (this._snapRaf) cancelAnimationFrame(this._snapRaf);
      const startY = window.scrollY, dist = targetY - startY, dur = 760, t0 = performance.now();
      this._snapping = true;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur); const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        window.scrollTo(0, Math.round(startY + dist * e));
        if (k < 1) { this._snapRaf = requestAnimationFrame(step); }
        else { this._snapping = false; this._lastY = window.scrollY; }
      };
      this._snapRaf = requestAnimationFrame(step);
    }
    _c01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    _sm(a, b, x) { const t = this._c01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
    _lerpHex(a, b, t) { const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255; const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t); return 'rgb(' + r + ',' + g + ',' + bl + ')'; }

    _initThree() {
      if (!window.THREE || !window.THREE.ColladaLoader || !window.THREE.GLTFLoader || !window.THREE.BufferGeometryUtils) { this._timer = setTimeout(() => this._initThree(), 80); return; }
      const T = window.THREE;
      const canvas = this.canvasRef.current; const host = canvas && canvas.parentElement;
      if (!canvas || !host) { this._timer = setTimeout(() => this._initThree(), 80); return; }
      const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
      this._renderer = renderer;
      const scene = new T.Scene(); this._scene = scene;
      const camera = new T.PerspectiveCamera(44, 1, 0.05, 6000); this._camera = camera;
      try { const pm = new T.PMREMGenerator(renderer); const env = T.RoomEnvironment ? new T.RoomEnvironment() : new T.Scene(); scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose(); } catch (e) {}
      scene.add(new T.AmbientLight(0xcfe2dd, 0.32));
      const key = new T.DirectionalLight(0xfff2e6, 2.1); key.position.set(20, 38, 26); scene.add(key);
      const rim = new T.DirectionalLight(0x43B59A, 1.35); rim.position.set(-26, 12, -22); scene.add(rim);
      const fill = new T.DirectionalLight(0x7db4ff, 0.55); fill.position.set(10, 6, -24); scene.add(fill);
      // cabin interior lights (along fuselage length X, at seat level)
      const cab = new T.Group(); scene.add(cab); this._cabin = cab;
      [-12, -4, 4, 12].forEach((x) => { const pl = new T.PointLight(0xfff0dc, 0, 60, 2); pl.position.set(x, 1.5, 0); cab.add(pl); });

      const ac = new T.Group(); scene.add(ac); this._ac = ac;
      this._v1 = new T.Vector3(); this._v2 = new T.Vector3(); this._up = new T.Vector3(0, 1, 0);

      // speed streaks (flight)
      const streaks = new T.Group(); streaks.visible = false; scene.add(streaks); this._streaks = streaks;
      for (let i = 0; i < 46; i++) { const white = i % 4 === 0; const mm = new T.MeshBasicMaterial({ color: white ? 0xffffff : 0x6fd0bd, transparent: true, opacity: 0 }); const s = new T.Mesh(new T.BoxGeometry(13 + Math.random() * 10, 0.22, 0.22), mm); s.userData.w = white; s.position.set(-58 + Math.random() * 92, (Math.random() - 0.4) * 24, (Math.random() - 0.5) * 42); streaks.add(s); }

      // camera keyframes (world units; plane normalized to length 36, centered at origin)
      // nez = -X (pointe), queue/dérive = +X. Cabine passagers x≈-14..+8
      this._cams = [
        { p: 0.00, pos: [-36, 0.3, 3.2], look: [-15, -1.1, -0.6], fov: 34 },  // DE FACE, zoomé (nez) — Achats
        { p: 0.10, pos: [-30, 2.6, 12], look: [-8, -1.2, 0], fov: 44 },        // transition vers 3/4
        { p: 0.31, pos: [-23, 3.5, 25], look: [-2, -0.8, 0], fov: 46 },      // Programme (3/4 avant, assemblage)
        { p: 0.40, pos: [10, 4, 19], look: [14, -0.5, 0], fov: 54 },      // contournement vers la queue
        { p: 0.47, pos: [9, -1.0, 0], look: [-6, -1.1, 0], fov: 64 },     // ENTREE arrière de cabine, regard avant (-X)
        { p: 0.53, pos: [3, -1.0, 0], look: [-12, -1.1, 0], fov: 62 },    // DANS la cabine, parmi les sièges — Transformation digitale
        { p: 0.63, pos: [-5, -1.0, 0], look: [-15, -1.1, 0], fov: 60 },   // avance vers l'avant de cabine
        { p: 0.69, pos: [-13.6, -1.15, 0], look: [-17, -1.7, 0], fov: 68 }, // entrée cockpit
        { p: 0.72, pos: [-14.4, -1.2, 0], look: [-17.5, -1.82, 0], fov: 73 }, // DANS LE COCKPIT — Aux commandes (légèrement reculé)
        { p: 0.76, pos: [-13.5, 0.2, 7], look: [-12, -1, 0], fov: 60 },   // sortie latérale du cockpit (vers l'arrière)
        { p: 0.82, pos: [-4, 3, 18], look: [-3, -0.2, 0], fov: 50 },      // dehors, avant-gauche, recul continu
        { p: 0.90, pos: [18, 5, 25], look: [2, 1.2, 0], fov: 46 },        // arc vers l'arrière-droit
        { p: 1.00, pos: [40, 7, 11], look: [-5, 2, 0], fov: 44 },         // EN VOL — vu de derrière (3/4 arrière)
      ];

      const resize = () => { const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      resize(); this._ro = new ResizeObserver(resize); this._ro.observe(host);
      this._clock = new T.Clock(); this._update(0);
      const loop = () => { this._raf = requestAnimationFrame(loop); this._frame(); };
      loop();

      // hangar (GLB)
      this._hangarMats = [];
      scene.fog = new T.Fog(0xdfeae7, 70, 240);
      const gltf = new T.GLTFLoader();
      gltf.load('assets/hangar/hangar.glb', (hg) => {
        try {
          const h = hg.scene;
          h.traverse((o) => { const n = o.name || ''; if (/SM_Aircraft|ThirdPersonCharacter|FollowCamera/i.test(n)) o.visible = false; });
          this._recolorHangar(T, h);
          const k = 1.55; const grp = new T.Group(); grp.add(h); grp.scale.setScalar(k); grp.position.set(0, -4.1 * k, -9.4 * k); scene.add(grp); this._hangar = grp;
        } catch (e) { console.error('hangar', e); }
      }, undefined, (e) => { console.error('hangar', e); });

      // interior + exterior (Collada, merged)
      const col = new T.ColladaLoader();
      col.load('assets/a320-interior/model.dae', (c) => { try { this._setupInterior(T, c); } catch (err) { console.error(err); if (this.loaderTxtRef.current) this.loaderTxtRef.current.textContent = 'Erreur de préparation du modèle'; } },
        (p) => { if (p.total && this.loaderBarRef.current) { const pct = Math.round(p.loaded / p.total * 100); this.loaderBarRef.current.style.width = pct + '%'; if (this.loaderTxtRef.current) this.loaderTxtRef.current.textContent = 'Chargement… ' + pct + '%'; } },
        (err) => { console.error(err); if (this.loaderTxtRef.current) this.loaderTxtRef.current.textContent = 'Erreur de chargement'; });

      // exterior hero (A320 débrandé, GLB PBR) — used for exterior chapters
      const gltfX = new T.GLTFLoader();
      gltfX.load('assets/cockpit/scene-compressed.glb', (g) => { try { this._setupExterior(T, g); } catch (e) { console.error('exterior', e); this._extReady = true; this._maybeHideLoader(); } }, undefined, (e) => { console.error('exterior', e); this._extReady = true; this._maybeHideLoader(); });
    }

    _setupExterior(T, g) {
      const model = g.scene;
      model.rotation.y = Math.PI / 2;            // nez -Z -> -X (convention Collada)
      model.updateMatrixWorld(true);
      let box = new T.Box3().setFromObject(model);
      let size = box.getSize(new T.Vector3());
      const s = 36 / size.x;                     // longueur(X) = 36, comme l'intérieur
      model.scale.setScalar(s);
      model.updateMatrixWorld(true);
      box = new T.Box3().setFromObject(model);
      const ctr = box.getCenter(new T.Vector3());
      model.position.sub(ctr);                   // bbox centrée à l'origine
      model.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { m.envMapIntensity = 1.15; if (m.map) m.map.encoding = T.sRGBEncoding; });
        }
      });
      // remplace la texture fuselage par la version débrandée (sans Lufthansa, dérive teal Wakn)
      new T.TextureLoader().load('assets/cockpit/fuselage-clean.png', (tex) => {
        // le fuselage = le matériau dont les meshes couvrent la plus grande emprise (x*z)
        const spans = new Map();
        model.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (!m.map) return; let e = spans.get(m); if (!e) { e = new T.Box3(); spans.set(m, e); } e.union(new T.Box3().setFromObject(o)); }); } });
        let best = null, bestFoot = 0;
        spans.forEach((box, m) => { const s = box.getSize(new T.Vector3()); const foot = s.x * s.z; if (foot > bestFoot) { bestFoot = foot; best = m; } });
        if (best && best.map) { const old = best.map; tex.flipY = old.flipY; tex.wrapS = old.wrapS; tex.wrapT = old.wrapT; tex.encoding = T.sRGBEncoding; tex.anisotropy = old.anisotropy || 4; tex.needsUpdate = true; best.map = tex; best.needsUpdate = true; }
        this._extReady = true; this._maybeHideLoader();
      }, undefined, () => { this._extReady = true; this._maybeHideLoader(); });
      const outer = new T.Group(); outer.add(model); outer.visible = false; this._ac.add(outer); this._extPlane = outer;
    }

    _maybeHideLoader() {
      if (!this._modelReady || !this._extReady) return;
      if (this._loaderHidden) return; this._loaderHidden = true;
      if (this.loaderRef.current) { this.loaderRef.current.style.opacity = '0'; setTimeout(() => { if (this.loaderRef.current) this.loaderRef.current.style.display = 'none'; }, 650); }
    }

    _recolorHangar(T, root) {
      const WALL = 0xdde6e2, STRUCT = 0x49595a, ACCENT = 0x2f9e86, BOXC = 0x9a8366;
      root.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const out = mats.map((m) => {
          const c = m.clone();
          const isGlass = /glass/i.test(m.name || '') || (c.opacity < 0.5 && c.transparent);
          if (isGlass) { c.color.setHex(0xbcd4d0); c.transparent = true; c.opacity = 0.14; c.metalness = 0; c.roughness = 0.1; c.depthWrite = false; }
          else if (/accent|light/i.test(m.name || '')) { c.color.setHex(ACCENT); c.metalness = 0.3; c.roughness = 0.4; c.emissive = new T.Color(0x0c2a28); }
          else if (/box/i.test(m.name || '')) { c.color.setHex(BOXC); c.metalness = 0.1; c.roughness = 0.85; }
          else { const lum = 0.299 * c.color.r + 0.587 * c.color.g + 0.114 * c.color.b; c.color.setHex(lum < 0.4 ? STRUCT : WALL); c.metalness = 0.1; c.roughness = 0.78; }
          c.envMapIntensity = 0.7;
          this._hangarMats.push({ m: c, glass: isGlass, baseOp: isGlass ? 0.14 : 1 });
          return c;
        });
        o.material = out.length > 1 ? out : out[0];
      });
    }

    _setupInterior(T, col) {
      const root = col.scene; root.updateMatrixWorld(true);
      const groups = new Map();
      root.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const m = (Array.isArray(o.material) ? o.material : [o.material])[0];
        const key = m.map ? 'tex:' + m.uuid : 'col:' + m.color.getHexString();
        let g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
        if (!g.attributes.normal) g.computeVertexNormals();
        const n = g.attributes.position.count;
        if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2));
        for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
        if (g.index) g = g.toNonIndexed();
        if (!groups.has(key)) groups.set(key, { mat: m, geos: [] });
        groups.get(key).geos.push(g);
      });
      const grp = new T.Group();
      for (const [k, v] of groups) {
        const merged = T.BufferGeometryUtils.mergeBufferGeometries(v.geos, false);
        if (!merged) continue;
        const src = v.mat;
        let color = src.color ? src.color.clone() : new T.Color(0xffffff);
        let metalness = 0.12, roughness = 0.74;
        if (!src.map) {
          const lum = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
          if (lum > 0.6) { color.setRGB(0.36, 0.52, 0.58); metalness = 0.62; roughness = 0.36; } // carrosserie : acier teinté teal Wakn (couleur visible, contraste sur fond clair)
        }
        const mat = new T.MeshStandardMaterial({ color: color, map: src.map || null, metalness: metalness, roughness: roughness, side: T.DoubleSide, transparent: !!src.transparent, opacity: src.opacity != null ? src.opacity : 1 });
        if (mat.map) mat.map.encoding = T.sRGBEncoding;
        mat.envMapIntensity = 1.15;
        grp.add(new T.Mesh(merged, mat));
      }
      const box = new T.Box3().setFromObject(grp); const size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3());
      grp.children.forEach((m) => m.geometry.translate(-ctr.x, -ctr.y, -ctr.z));
      const maxd = Math.max(size.x, size.y, size.z); const s = 36 / maxd;
      const outer = new T.Group(); outer.add(grp); outer.scale.setScalar(s); this._ac.add(outer); this._plane = outer;
      this._halfH = (size.y / 2) * s;
      this._modelReady = true;
      this._maybeHideLoader();
    }

    _frame() {
      const dt = Math.min(this._clock.getDelta(), 0.05); this._t += dt;
      const tr = this.trackRef.current;
      if (tr) { const sc = tr.offsetHeight - window.innerHeight; if (sc > 0) this._tp = Math.max(0, Math.min(1, (-tr.getBoundingClientRect().top) / sc)); }
      if (window.__waknP != null) this._tp = window.__waknP;
      this._p += (this._tp - this._p) * 0.08;
      this._mo.x += (this._mt.x - this._mo.x) * 0.05; this._mo.y += (this._mt.y - this._mo.y) * 0.05;
      this._update(this._p);
      const nl = this.navLogoRef.current, ex = this.expertiseRef.current, navEl = this.navRef.current;
      if (ex) {
        const r = ex.getBoundingClientRect();
        if (nl) { const over = window.innerWidth <= 820 && r.top < 72; nl.style.opacity = over ? '0' : '1'; nl.style.pointerEvents = over ? 'none' : 'auto'; }
        // menu clair tant que la nav survole la section sombre (commence au-dessus de la nav, finit en dessous)
        if (navEl) { const navH = navEl.offsetHeight || 78; navEl.classList.toggle('nav-dark', r.top < navH && r.bottom > navH); }
      }
      this._renderer.render(this._scene, this._camera);
    }

    _sampleCam(p) { const K = this._cams; let i = 0; while (i < K.length - 1 && p > K[i + 1].p) i++; const a = K[i], b = K[Math.min(i + 1, K.length - 1)]; const sp = (b.p - a.p) || 1; let t = this._c01((p - a.p) / sp); t = t * t * (3 - 2 * t); const L = (u, v2) => u + (v2 - u) * t; return { px: L(a.pos[0], b.pos[0]), py: L(a.pos[1], b.pos[1]), pz: L(a.pos[2], b.pos[2]), lx: L(a.look[0], b.look[0]), ly: L(a.look[1], b.look[1]), lz: L(a.look[2], b.look[2]), fov: L(a.fov || 44, b.fov || 44) }; }

    _update(p) {
      const cam = this._camera; if (!cam || !this._cams) return;
      const inside = this._sm(0.42, 0.47, p) * (1 - this._sm(0.82, 0.86, p));
      // bascule modèle : Collada (cabine+sièges) seulement dans la cabine ; Lufthansa (extérieur + cockpit) ailleurs
      const cabin = this._sm(0.44, 0.48, p) * (1 - this._sm(0.64, 0.675, p));
      const haveExt = !!this._extReady;
      if (this._plane) this._plane.visible = haveExt ? (cabin > 0.5) : true;
      if (this._extPlane) this._extPlane.visible = haveExt && (cabin <= 0.5);
      const par = 0.5 * (1 - inside);
      const c = this._sampleCam(p);
      cam.fov = c.fov; cam.updateProjectionMatrix();
      cam.position.set(c.px + this._mo.x * par, c.py - this._mo.y * par * 0.7, c.pz);
      const groundPan = (1 - inside) * (1 - this._sm(0.80, 0.90, p)) * 0;
      const fwd = this._v1.set(c.lx - c.px, c.ly - c.py, c.lz - c.pz).normalize();
      const right = this._v2.crossVectors(fwd, this._up).normalize();
      cam.lookAt(c.lx - right.x * groundPan, c.ly, c.lz - right.z * groundPan);

      // cabin lights on while inside
      const lit = inside;
      if (this._cabin) this._cabin.children.forEach((l) => { l.intensity = 1.5 * lit; });

      // gentle flight bank/pitch (plane otherwise static)
      if (this._ac) { const prof = this._sm(0.82, 0.98, p); this._ac.rotation.z = -prof * 0.05; this._ac.rotation.x = -prof * 0.04; }

      // background sky shift only at the very end
      const sky = this._sm(0.82, 0.97, p);
      const top = this._lerpHex(0xcde7de, 0xbfe0e8, sky), bot = this._lerpHex(0x8fc4b6, 0xe9f6f3, sky);
      if (this.bgRef.current) this.bgRef.current.style.background = 'linear-gradient(180deg,' + top + ',' + bot + ')';

      // hangar visible for exterior ground chapters, fades before entering cabin
      if (this._hangar) {
        const hf = 1 - this._sm(0.28, 0.39, p);
        if (hf <= 0.01) { if (this._hangar.visible) { this._hangar.visible = false; if (this._scene) this._scene.fog = null; } }
        else {
          if (!this._hangar.visible) { this._hangar.visible = true; if (this._scene && !this._scene.fog) this._scene.fog = new (window.THREE.Fog)(0xdfeae7, 70, 240); }
          const fading = hf < 0.995;
          this._hangarMats.forEach((e) => { e.m.opacity = (e.glass ? e.baseOp : 1) * hf; e.m.transparent = e.glass || fading; e.m.depthWrite = e.glass ? false : !fading; });
        }
      }

      // vignette: bump while crossing the fuselage into the cabin
      if (this.vignetteRef.current) {
        const cross = this._sm(0.40, 0.45, p) * (1 - this._sm(0.46, 0.50, p));
        const insideSoft = inside * 0.28;
        this.vignetteRef.current.style.opacity = Math.max(cross * 0.95, insideSoft).toFixed(3);
      }

      // speed streaks during flight
      const fl = this._sm(0.84, 0.96, p);
      if (this._streaks) { this._streaks.visible = fl > 0.02; this._streaks.children.forEach((s) => { s.material.opacity = fl * (s.userData.w ? 0.7 : 0.4); s.position.x += 2.2 + (s.userData.w ? 1.2 : 0); if (s.position.x > 34) s.position.x = -60 - Math.random() * 12; }); }

      // chapter overlays
      const ov = this.overlayRef.current;
      if (ov) {
        const chaps = ov.querySelectorAll('[data-chap]');
        const ctr = [0.06, 0.31, 0.53, 0.72, 0.92];
        const last = chaps.length - 1;
        chaps.forEach((el, i) => {
          let op;
          if (i === 0) op = 1 - this._sm(0.11, 0.15, p);                 // net dès l'arrivée (p=0), puis sort
          else if (i === last) op = this._sm(0.85, 0.93, p);
          else op = this._sm(ctr[i] - 0.085, ctr[i] - 0.05, p) * (1 - this._sm(ctr[i] + 0.05, ctr[i] + 0.085, p));
          el.style.opacity = op.toFixed(3);
          const baseT = (i === last) ? 'translate(-50%,-50%)' : 'translateY(-50%)';
          el.style.transform = baseT + ' translateY(' + ((1 - op) * 16).toFixed(1) + 'px)';
          el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
        });
      }
      if (this.scrimRef.current) this.scrimRef.current.style.opacity = (1 - this._sm(0.82, 0.92, p)).toFixed(3);
      const rail = this.railRef.current; if (rail) { const cs = [0.06, 0.31, 0.53, 0.72, 0.92]; let ai = 0, bd = 9; cs.forEach((v, k) => { const dd = Math.abs(p - v); if (dd < bd) { bd = dd; ai = k; } }); Array.prototype.forEach.call(rail.children, (el, k) => { el.style.opacity = k === ai ? '1' : '0.38'; }); }
      if (this.barRef.current) this.barRef.current.style.width = (p * 100).toFixed(2) + '%';
      if (this.hintRef.current) this.hintRef.current.style.opacity = (1 - this._sm(0.02, 0.08, p)).toFixed(2);
    }
  }

  function boot() { new WaknVol().mount(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The landing hero's WebGL layer: a wireframe globe inside a particle shell,
 * wrapped by two inclined orbit rings, rotating and tilting toward the cursor.
 *
 * The structure here is the point. An earlier version was just an additive
 * particle cloud, which reads as a flat glow no matter how much it moves -
 * the eye needs silhouette, occlusion and perspective to see depth. So:
 *   - visible wireframe edges give it a shape
 *   - edges and points fade with view-space depth, so the far side recedes
 *   - inclined rings project as ellipses, the strongest perspective cue there is
 *
 * Written against three.js directly rather than react-three-fiber: R3F caps at
 * react <19.3 and this project is on 19.3, and one scene gains nothing from
 * the reconciler while costing bundle size.
 */
export default function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      // No WebGL (old device, blocked context) - the CSS backdrop stands in.
      return;
    }

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 13;

    // Everything lives in one group so pointer tilt moves the whole object.
    const world = new THREE.Group();
    scene.add(world);

    const COLOR_A = new THREE.Color("#6366f1");
    const COLOR_B = new THREE.Color("#22d3ee");

    // Shared depth-fade: anything further from the camera dims, which is what
    // makes the far side of the globe visibly sit *behind* the near side.
    const depthFade = /* glsl */ `
      float depthFade(vec4 mvPosition) {
        return clamp((mvPosition.z + 16.0) / 14.0, 0.05, 1.0);
      }
    `;

    // ---- wireframe globe -------------------------------------------------
    const globeGeometry = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(4.4, 2));
    const globeMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColorA: { value: COLOR_A },
        uColorB: { value: COLOR_B },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        ${depthFade}
        varying float vFade;
        varying float vMix;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFade = depthFade(mv);
          vMix = clamp((position.y + 4.4) / 8.8, 0.0, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vFade;
        varying float vMix;
        void main() {
          vec3 color = mix(uColorA, uColorB, vMix);
          gl_FragColor = vec4(color, vFade * 0.55);
        }
      `,
    });
    const globe = new THREE.LineSegments(globeGeometry, globeMaterial);
    world.add(globe);

    // A faint solid shell just behind the wireframe so the far edges read as
    // occluded rather than floating - this is what sells it as a solid body.
    const shellGeometry = new THREE.IcosahedronGeometry(4.3, 3);
    const shellMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.FrontSide,
      uniforms: { uColor: { value: new THREE.Color("#0b1020") } },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          // Fresnel: transparent face-on, denser at grazing angles, giving the
          // sphere a visible rim.
          float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.0);
          gl_FragColor = vec4(uColor, 0.55 + fresnel * 0.35);
        }
      `,
    });
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    world.add(shell);

    // ---- orbit rings -----------------------------------------------------
    const ringMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: COLOR_B } },
      vertexShader: /* glsl */ `
        ${depthFade}
        varying float vFade;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFade = depthFade(mv);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vFade;
        void main() {
          gl_FragColor = vec4(uColor, vFade * 0.5);
        }
      `,
    });

    const rings: THREE.Mesh[] = [];
    const ringSpecs = [
      { radius: 6.1, tilt: [1.15, 0, 0.35] },
      { radius: 7.0, tilt: [1.5, 0.4, -0.5] },
    ] as const;

    for (const spec of ringSpecs) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(spec.radius, 0.012, 8, 160),
        ringMaterial,
      );
      ring.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
      world.add(ring);
      rings.push(ring);
    }

    // ---- particle shell --------------------------------------------------
    const COUNT = 1400;
    const positions = new Float32Array(COUNT * 3);
    const scales = new Float32Array(COUNT);
    const seeds = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      // Fibonacci sphere: even spread, unlike naive spherical coords which
      // bunch hard at the poles.
      const t = i / COUNT;
      const inclination = Math.acos(1 - 2 * t);
      const azimuth = Math.PI * (1 + Math.sqrt(5)) * i;
      const radius = 5.2 + Math.random() * 2.6;

      positions[i * 3] = radius * Math.sin(inclination) * Math.cos(azimuth);
      positions[i * 3 + 1] = radius * Math.sin(inclination) * Math.sin(azimuth);
      positions[i * 3 + 2] = radius * Math.cos(inclination);
      scales[i] = Math.random();
      seeds[i] = Math.random() * Math.PI * 2;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const particleUniforms = {
      uTime: { value: 0 },
      uColorA: { value: COLOR_A },
      uColorB: { value: COLOR_B },
      uPixelRatio: { value: renderer.getPixelRatio() },
    };

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: particleUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        ${depthFade}
        uniform float uTime;
        uniform float uPixelRatio;
        attribute float aScale;
        attribute float aSeed;
        varying float vAlpha;
        varying float vMix;

        void main() {
          vec3 pos = position;
          pos *= 1.0 + sin(uTime * 0.5 + aSeed) * 0.03;

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          float fade = depthFade(mv);

          gl_Position = projectionMatrix * mv;
          gl_PointSize = (aScale * 7.0 + 2.0) * uPixelRatio * fade;
          vAlpha = fade * (0.3 + aScale * 0.6);
          vMix = clamp((pos.y + 7.0) / 14.0, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vAlpha;
        varying float vMix;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float falloff = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(mix(uColorA, uColorB, vMix), falloff * vAlpha);
        }
      `,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    world.add(particles);

    // ---- pointer ---------------------------------------------------------
    const pointer = new THREE.Vector2(0, 0);
    const targetPointer = new THREE.Vector2(0, 0);

    const onPointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      targetPointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    // ---- resize ----------------------------------------------------------
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      particleUniforms.uPixelRatio.value = renderer.getPixelRatio();
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    // ---- loop ------------------------------------------------------------
    // Hand-rolled clock rather than THREE.Clock (deprecated), and accumulating
    // elapsed time ourselves means the scene resumes where it paused instead
    // of snapping back to the start when it scrolls into view again.
    let elapsed = 0;
    let lastFrame = performance.now();
    let frame = 0;
    let running = true;

    // Pause when scrolled away - no reason to burn GPU on an unseen scene.
    const visibility = new IntersectionObserver(
      ([entry]) => {
        running = entry?.isIntersecting ?? true;
        // Don't bill the scene for the time it spent off screen.
        if (running) lastFrame = performance.now();
      },
      { threshold: 0 },
    );
    visibility.observe(mount);

    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!running) return;

      const now = performance.now();
      elapsed += (now - lastFrame) / 1000;
      lastFrame = now;

      globeMaterial.uniforms["uTime"]!.value = elapsed;
      particleUniforms.uTime.value = elapsed;

      // Ease toward the cursor so the tilt feels weighted, not twitchy.
      pointer.lerp(targetPointer, 0.05);

      // Clearly visible rotation - the earlier version was so slow it read as
      // a still image with a glow on it.
      world.rotation.y = elapsed * 0.18 + pointer.x * 0.5;
      world.rotation.x = -0.15 + pointer.y * 0.35;

      // Rings counter-rotate slightly so the structure never looks rigid.
      rings.forEach((ring, index) => {
        ring.rotation.z += index === 0 ? 0.0016 : -0.0011;
      });
      particles.rotation.y = -elapsed * 0.06;

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      visibility.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      globeGeometry.dispose();
      globeMaterial.dispose();
      shellGeometry.dispose();
      shellMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      ringMaterial.dispose();
      rings.forEach((ring) => ring.geometry.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />;
}

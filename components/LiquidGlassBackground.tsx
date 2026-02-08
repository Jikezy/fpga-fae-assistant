'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function LiquidGlassBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mousePos = useRef({ x: 0, y: 0 })
  const targetMousePos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    containerRef.current.appendChild(renderer.domElement)

    // Custom Shader Material - Liquid Glass Effect
    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vPosition;
      uniform float uTime;
      uniform vec2 uMouse;

      // 3D Noise function
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      void main() {
        vUv = uv;
        vPosition = position;

        // Liquid deformation
        vec3 pos = position;
        float noise = snoise(vec3(position.x * 0.5 + uTime * 0.1, position.y * 0.5, uTime * 0.2));

        // Mouse interaction - magnetic attraction
        vec2 mouseInfluence = (uMouse - position.xy) * 0.3;
        float dist = length(mouseInfluence);
        float influence = smoothstep(2.0, 0.0, dist);

        pos.z += noise * 0.5 + influence * 0.8;
        pos.xy += mouseInfluence * influence * 0.3;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `

    const fragmentShader = `
      varying vec2 vUv;
      varying vec3 vPosition;
      uniform float uTime;
      uniform vec2 uMouse;
      uniform vec2 uResolution;

      // Color palette - Minimalist blue-gray scheme
      vec3 color1 = vec3(0.039, 0.055, 0.102); // Deep blue-black #0a0e1a
      vec3 color2 = vec3(0.102, 0.125, 0.173); // Dark blue-gray #1a202c
      vec3 color3 = vec3(0.176, 0.216, 0.282); // Medium blue-gray #2d3748
      vec3 color4 = vec3(0.490, 0.827, 0.988); // Light cyan accent #7dd3fc
      vec3 color5 = vec3(0.541, 0.608, 0.729); // Muted blue-gray #8a9bb7

      // Simplex noise for smooth gradients
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // Chromatic Aberration (color dispersion)
      vec3 chromaticAberration(vec2 uv, float amount) {
        float r = noise(uv * 3.0 + uTime * 0.1 + amount * 0.01);
        float g = noise(uv * 3.0 + uTime * 0.15);
        float b = noise(uv * 3.0 + uTime * 0.2 - amount * 0.01);
        return vec3(r, g, b);
      }

      // Caustics pattern
      float caustic(vec2 uv, float time) {
        vec2 p = uv * 4.0;
        float c = 0.0;
        for(float i = 0.0; i < 3.0; i++) {
          p.x += 0.3 / (i + 1.0) * sin(i * 2.5 + time * 0.5 + p.y * 2.0);
          p.y += 0.4 / (i + 1.0) * cos(i * 1.5 + time * 0.3 + p.x * 2.0);
          c += length(vec2(
            cos(p.x + time * 0.2) / (i + 1.0),
            sin(p.y + time * 0.3) / (i + 1.0)
          ));
        }
        return c * 0.2;
      }

      void main() {
        vec2 uv = vUv;
        vec2 center = vec2(0.5);

        // Animated UV distortion
        vec2 distortedUv = uv;
        distortedUv.x += sin(uv.y * 10.0 + uTime * 0.3) * 0.02;
        distortedUv.y += cos(uv.x * 10.0 + uTime * 0.2) * 0.02;

        // Multi-layer color mixing
        float n1 = noise(distortedUv * 2.0 + uTime * 0.1);
        float n2 = noise(distortedUv * 3.0 - uTime * 0.15);
        float n3 = noise(distortedUv * 1.5 + vec2(uTime * 0.08));

        // Color blending based on position and noise
        vec3 color = mix(color1, color2, n1);
        color = mix(color, color3, n2 * 0.7);
        color = mix(color, color4, n3 * 0.3);

        // Add caustics highlight
        float causticsPattern = caustic(distortedUv, uTime);
        color += color5 * causticsPattern * 0.15;

        // Chromatic aberration
        vec3 aberration = chromaticAberration(distortedUv, 1.0);
        color *= 0.9 + aberration * 0.1;

        // Volumetric fog (depth attenuation)
        float depth = length(vPosition) * 0.3;
        color *= 1.0 - depth * 0.2;

        // Add subtle glow around edges
        float edgeGlow = smoothstep(0.0, 0.3, length(uv - center)) * 0.2;
        color += vec3(0.9, 0.95, 1.0) * edgeGlow;

        // Mouse proximity glow
        vec2 mouseUv = (uMouse + 1.0) * 0.5; // Convert from -1,1 to 0,1
        float mouseDist = length(uv - mouseUv);
        float mouseGlow = smoothstep(0.4, 0.0, mouseDist) * 0.3;
        color += color4 * mouseGlow;

        gl_FragColor = vec4(color, 1.0);
      }
    `

    // Create liquid mesh
    const geometry = new THREE.PlaneGeometry(10, 10, 64, 64)
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      },
      side: THREE.DoubleSide,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Mouse tracking
    const handleMouseMove = (event: MouseEvent) => {
      targetMousePos.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1,
      }
    }

    window.addEventListener('mousemove', handleMouseMove)

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    // Animation loop
    const clock = new THREE.Clock()

    const animate = () => {
      requestAnimationFrame(animate)

      // Smooth mouse interpolation
      mousePos.current.x += (targetMousePos.current.x - mousePos.current.x) * 0.05
      mousePos.current.y += (targetMousePos.current.y - mousePos.current.y) * 0.05

      // Update uniforms
      material.uniforms.uTime.value = clock.getElapsedTime()
      material.uniforms.uMouse.value.set(mousePos.current.x, mousePos.current.y)

      // Gentle rotation
      mesh.rotation.z = Math.sin(clock.getElapsedTime() * 0.1) * 0.1

      renderer.render(scene, camera)
    }

    animate()

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-10"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}

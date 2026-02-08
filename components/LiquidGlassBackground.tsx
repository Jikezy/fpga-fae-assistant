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

        // 缓慢优雅的液态变形（克制的动画）
        vec3 pos = position;
        float noise = snoise(vec3(position.x * 0.3 + uTime * 0.05, position.y * 0.3, uTime * 0.1));

        // 轻柔的鼠标磁力（水滴般丝滑）
        vec2 mouseInfluence = (uMouse - position.xy) * 0.15;
        float dist = length(mouseInfluence);
        float influence = smoothstep(1.5, 0.0, dist);

        pos.z += noise * 0.3 + influence * 0.4;
        pos.xy += mouseInfluence * influence * 0.15;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `

    const fragmentShader = `
      varying vec2 vUv;
      varying vec3 vPosition;
      uniform float uTime;
      uniform vec2 uMouse;
      uniform vec2 uResolution;

      // Clean & Airy - 影棚柔光配色（清澈水晶感）
      vec3 color1 = vec3(0.95, 0.96, 0.98); // 乳白色 #f2f4f9
      vec3 color2 = vec3(0.88, 0.91, 0.95); // 银白色 #e1e8f2
      vec3 color3 = vec3(0.82, 0.87, 0.93); // 高级灰 #d1dded
      vec3 color4 = vec3(0.70, 0.85, 0.95); // 淡雅冰蓝 #b3d9f2
      vec3 color5 = vec3(0.60, 0.75, 0.88); // 水晶蓝 #99bfe0

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

        // 克制的多层混合（少而精）
        float n1 = noise(distortedUv * 1.5 + uTime * 0.05); // 减速，更优雅
        float n2 = noise(distortedUv * 2.0 - uTime * 0.08);

        // 清澈的颜色混合（高亮度）
        vec3 color = mix(color1, color2, n1 * 0.5);
        color = mix(color, color3, n2 * 0.3);

        // 水晶焦散（轻微点缀）
        float causticsPattern = caustic(distortedUv, uTime);
        color += color4 * causticsPattern * 0.15;

        // 柔和的边缘光晕（影棚柔光效果）
        float edgeGlow = smoothstep(0.0, 0.5, length(uv - center)) * 0.2;
        color = mix(color, vec3(0.92, 0.94, 0.97), edgeGlow);

        // 极微弱的鼠标交互（不干扰视觉）
        vec2 mouseUv = (uMouse + 1.0) * 0.5;
        float mouseDist = length(uv - mouseUv);
        float mouseGlow = smoothstep(0.25, 0.0, mouseDist) * 0.08;
        color += color5 * mouseGlow;

        // 保持高亮度（影棚光感）
        color = clamp(color, 0.85, 1.0);

        gl_FragColor = vec4(color, 1.0);
      }
    `

    // 克制的液态网格（少而精，留白处浮动）
    const geometry = new THREE.PlaneGeometry(15, 12, 48, 48) // 减少尺寸和细分，更优雅
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

      // 轻盈的旋转（水滴般优雅）
      mesh.rotation.z = Math.sin(clock.getElapsedTime() * 0.05) * 0.05

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

import * as THREE from 'three';

// ==========================================
// 0. GLSL 噪声算法
// ==========================================
const noiseChunk = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}
`;

// ==========================================
// 1. 恒星本体着色器
// ==========================================

const starVertexShader = `
uniform float time;
uniform float boilScale; 
uniform float boilSpeed;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vModelPosition;
varying vec3 vViewPosition;
varying float vDisplacement; 

${noiseChunk}

void main() {
    vUv = uv;
    vec3 objectNormal = normalize(normal);
    
    // --- 强化物理沸腾 ---
    // 增加频率 (* 2.5) 让波浪更密集
    float noiseVal = snoise(objectNormal * 2.5 + time * boilSpeed);
    
    // 顶点位移
    vec3 newPosition = position + objectNormal * noiseVal * boilScale;
    
    vDisplacement = noiseVal;
    
    vNormal = normalize(normalMatrix * objectNormal);
    vModelPosition = position; 
    
    vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
    vViewPosition = -mvPosition.xyz;
    
    gl_Position = projectionMatrix * mvPosition;
}
`;

const starFragmentShader = `
uniform float time;
uniform vec3 colorHot;
uniform vec3 colorCool;
uniform float cutAngle;
uniform bool isShell;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vModelPosition;
varying vec3 vViewPosition;
varying float vDisplacement; 

${noiseChunk}

void main() {
    // 1. 洋葱切割
    float angle = atan(vModelPosition.x, vModelPosition.z);
    if (angle > 0.0 && angle < cutAngle) discard;

    vec3 normal = normalize(vNormal);
    if (!gl_FrontFacing) normal = -normal;

    // 2. 表面纹理 (增强对比度)
    float n1 = snoise(normal * 3.0 + time * 0.2);
    float n2 = snoise(normal * 10.0 + time * 0.5);
    float n3 = snoise(normal * 25.0 + time * 0.8); 
    float textureNoise = n1 * 0.6 + n2 * 0.3 + n3 * 0.1; // 调整权重

    // 3. 温度映射 (更激进的冷热混合)
    float tempFactor = textureNoise * 0.3 + vDisplacement * 0.7; // 位移权重更高
    vec3 surfaceColor = mix(colorCool, colorHot, smoothstep(-0.3, 0.6, tempFactor));

    // 4. 磁重联耀斑 (降低阈值，增加亮度)
    float flareNoise = snoise(normal * 6.0 + time * 1.8);
    // 阈值从 0.75 降到 0.65，耀斑更容易出现
    float flareMask = smoothstep(0.65, 0.95, flareNoise); 
    // 亮度从 3.0 提至 5.0，更刺眼
    surfaceColor += vec3(1.0, 0.9, 0.8) * flareMask * 5.0; 

    // 5. 光照模型
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = dot(viewDir, normal);
    fresnel = clamp(fresnel, 0.0, 1.0);
    
    if (gl_FrontFacing) {
        float limbDarkening = 0.2 + 0.8 * fresnel;
        float atmosphere = pow(1.0 - fresnel, 3.0);
        
        vec3 finalColor = surfaceColor * limbDarkening;
        finalColor += colorHot * atmosphere * 1.5;
        gl_FragColor = vec4(finalColor, 1.0);
    } else {
        vec3 innerColor = surfaceColor * 0.6;
        innerColor += colorHot * 0.4 * pow(fresnel, 2.0);
        gl_FragColor = vec4(innerColor, 1.0);
    }
}
`;

// ==========================================
// 2. 太阳风着色器
// ==========================================

const coronaVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const coronaFragmentShader = `
uniform float time;
uniform vec3 colorWind;
varying vec3 vNormal;

${noiseChunk}

void main() {
    // 太阳风流速加快 (* 2.0)
    float flowNoise = snoise(vNormal * 3.0 - vec3(0.0, time * 2.0, 0.0));
    
    vec3 viewDir = vec3(0.0, 0.0, 1.0); 
    float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 1.5);
    
    // 增加不透明度 (0.5 -> 0.6)
    float alpha = smoothstep(0.1, 0.7, flowNoise) * 0.6 * fresnel;
    
    gl_FragColor = vec4(colorWind, alpha);
}
`;

// ==========================================
// 3. 主类逻辑
// ==========================================
export class ProgenitorStar {
    constructor(scene) {
        this.scene = scene;
        this.layers = []; 
        this.corona = null;
        this.baseRadius = 4.0;
        this.targetCutAngle = 0;
        console.log("物理加强版 ProgenitorStar 已加载");
    }

    init() {
        const layerData = [
            { name: "Fe (Core)", radius: 0.15, colorHot: 0xffffff, colorCool: 0x99ccff },
            { name: "Si",        radius: 0.30, colorHot: 0xffeba1, colorCool: 0xcc8800 },
            { name: "O",         radius: 0.45, colorHot: 0xff4422, colorCool: 0x550000 },
            { name: "Ne",        radius: 0.60, colorHot: 0xff00ff, colorCool: 0x440044 },
            { name: "C",         radius: 0.75, colorHot: 0x22ff44, colorCool: 0x003300 },
            { name: "He",        radius: 0.88, colorHot: 0x00ccff, colorCool: 0x001133 },
            { name: "H (Envelope)", radius: 1.0,  colorHot: 0xffaa00, colorCool: 0xaa1100 }
        ];

        layerData.forEach(data => {
            const geometry = new THREE.SphereGeometry(this.baseRadius * data.radius, 256, 256);
            
            const uniforms = {
                time: { value: Math.random() * 100 },
                colorHot: { value: new THREE.Color(data.colorHot) },
                colorCool: { value: new THREE.Color(data.colorCool) },
                cutAngle: { value: 0.0 },
                // --- 强化参数 ---
                // boilScale: 从 0.08 提升到 0.15 (变形更夸张)
                // boilSpeed: 从 0.4 提升到 0.8 (沸腾更快)
                boilScale: { value: data.name.includes("H") ? 0.15 : 0.02 }, 
                boilSpeed: { value: data.name.includes("H") ? 0.8 : 0.2 }    
            };

            const material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: starVertexShader,
                fragmentShader: starFragmentShader,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = data.name;
            this.scene.add(mesh);
            this.layers.push({ mesh, uniforms });
        });

        // 太阳风
        const coronaGeo = new THREE.SphereGeometry(this.baseRadius * 1.3, 64, 64);
        const coronaUniforms = {
            time: { value: 0 },
            colorWind: { value: new THREE.Color(0xff6600) } 
        };
        const coronaMat = new THREE.ShaderMaterial({
            uniforms: coronaUniforms,
            vertexShader: coronaVertexShader,
            fragmentShader: coronaFragmentShader,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.corona = new THREE.Mesh(coronaGeo, coronaMat);
        this.scene.add(this.corona);
    }

    update(deltaTime) {
        if (this.layers.length > 0) {
            const currentAngle = this.layers[0].uniforms.cutAngle.value;
            const newAngle = THREE.MathUtils.lerp(currentAngle, this.targetCutAngle, deltaTime * 2.0);

            this.layers.forEach((layer, index) => {
                const speedMultiplier = 1.0 - (index * 0.08); 
                layer.uniforms.time.value += deltaTime * speedMultiplier; 
                layer.uniforms.cutAngle.value = newAngle;
            });
        }

        if (this.corona) {
            this.corona.material.uniforms.time.value += deltaTime * 0.8;
            // 呼吸幅度加大
            const pulse = 1.0 + Math.sin(this.corona.material.uniforms.time.value * 3.0) * 0.03;
            this.corona.scale.set(pulse, pulse, pulse);
        }
    }

    toggleCutout(isOpen) {
        this.targetCutAngle = isOpen ? Math.PI / 1.5 : 0.0;
        if (this.corona) {
            this.corona.visible = !isOpen; 
        }
    }
}
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ==========================================
// 0. GLSL 噪声算法 (保持不变)
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
    
    // 物理沸腾
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
uniform float flareIntensity; 

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

    // 2. 表面纹理
    float n1 = snoise(normal * 3.0 + time * 0.2);
    float n2 = snoise(normal * 10.0 + time * 0.5);
    float n3 = snoise(normal * 25.0 + time * 0.8); 
    float textureNoise = n1 * 0.6 + n2 * 0.3 + n3 * 0.1;

    // 3. 温度映射
    float tempFactor = textureNoise * 0.3 + vDisplacement * 0.7;
    vec3 surfaceColor = mix(colorCool, colorHot, smoothstep(-0.3, 0.6, tempFactor));

    // 4. 可控耀斑
    float flareNoise = snoise(normal * 6.0 + time * 1.8);
    float flareMask = smoothstep(0.65, 0.95, flareNoise); 
    surfaceColor += vec3(1.0, 0.95, 0.8) * flareMask * flareIntensity; 

    // 5. 光照
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = clamp(dot(viewDir, normal), 0.0, 1.0);
    
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
// 2. 主类逻辑
// ==========================================
export class ProgenitorStar {
    constructor(scene) {
        this.scene = scene;
        this.layers = []; 
        this.labels = []; 
        this.baseRadius = 4.0;
        this.targetCutAngle = 0;
        
        this.params = {
            boilSpeed: 0.8,
            boilScale: 0.15,
            flareIntensity: 5.0,
            rotationSpeed: 0.1
        };
        
        console.log("ProgenitorStar Loaded (Detail Fixed)");
    }

    init() {
        const layerData = [
            { name: "Fe (Core)", symbol: "Fe", radius: 0.15, colorHot: 0xffffff, colorCool: 0x99ccff },
            { name: "Si Shell",  symbol: "Si", radius: 0.30, colorHot: 0xffeba1, colorCool: 0xcc8800 },
            { name: "O Shell",   symbol: "O",  radius: 0.45, colorHot: 0xff4422, colorCool: 0x550000 },
            { name: "Ne Shell",  symbol: "Ne", radius: 0.60, colorHot: 0xff00ff, colorCool: 0x440044 },
            { name: "C Shell",   symbol: "C",  radius: 0.75, colorHot: 0x22ff44, colorCool: 0x003300 },
            { name: "He Shell",  symbol: "He", radius: 0.88, colorHot: 0x00ccff, colorCool: 0x001133 },
            { name: "H Envelope",symbol: "H",  radius: 1.0,  colorHot: 0xffaa00, colorCool: 0xaa1100 }
        ];

        layerData.forEach((data, index) => {
            // 【关键修复】detail 设为 5，面数约2万，既细腻又流畅
            // 之前的 16 会导致 crash
            const geometry = new THREE.IcosahedronGeometry(this.baseRadius * data.radius, 5);
            
            const uniforms = {
                time: { value: Math.random() * 100 },
                colorHot: { value: new THREE.Color(data.colorHot) },
                colorCool: { value: new THREE.Color(data.colorCool) },
                cutAngle: { value: 0.0 },
                boilScale: { value: data.name.includes("H") ? this.params.boilScale : 0.02 }, 
                boilSpeed: { value: data.name.includes("H") ? this.params.boilSpeed : 0.2 },
                flareIntensity: { value: data.name.includes("H") ? this.params.flareIntensity : 0.0 }
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
            this.layers.push({ mesh, uniforms, isOuter: data.name.includes("H") });

            const div = document.createElement('div');
            div.className = 'star-label';
            div.innerHTML = `<span class="chem-symbol">${data.symbol}</span> ${data.name}`;
            const label = new CSS2DObject(div);
            label.position.set(this.baseRadius * data.radius * 0.8, this.baseRadius * data.radius * 0.5, 0); 
            label.visible = false; 
            mesh.add(label);
            this.labels.push(label);
        });
    }

    update(deltaTime) {
        if (this.layers.length > 0) {
            const currentAngle = this.layers[0].uniforms.cutAngle.value;
            const newAngle = THREE.MathUtils.lerp(currentAngle, this.targetCutAngle, deltaTime * 2.0);
            
            const showLabels = newAngle > 0.5;

            this.layers.forEach((layer, index) => {
                const speedMultiplier = 1.0 - (index * 0.08); 
                layer.uniforms.time.value += deltaTime * speedMultiplier; 
                layer.uniforms.cutAngle.value = newAngle;

                if (layer.isOuter) {
                    layer.uniforms.boilSpeed.value = this.params.boilSpeed;
                    layer.uniforms.boilScale.value = this.params.boilScale;
                    layer.uniforms.flareIntensity.value = this.params.flareIntensity;
                }
                
                layer.mesh.rotation.y += deltaTime * this.params.rotationSpeed * (1.0 - index * 0.1);

                if (this.labels[index]) {
                    this.labels[index].visible = showLabels;
                    this.labels[index].element.style.opacity = showLabels ? "1" : "0";
                }
            });
        }
    }

    setParams(key, value) {
        if (this.params.hasOwnProperty(key)) {
            this.params[key] = value;
        }
    }

    toggleCutout(isOpen) {
        this.targetCutAngle = isOpen ? Math.PI / 1.5 : 0.0;
    }
}
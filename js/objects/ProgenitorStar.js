import * as THREE from 'three';

// --- 顶点着色器 ---
const vertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vModelPosition;
varying vec3 vViewPosition;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    // 记录模型坐标 (用于切割)
    vModelPosition = position; 
    
    // 记录视图坐标 (用于光照)
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    
    gl_Position = projectionMatrix * mvPosition;
}
`;

// --- 片元着色器：3层噪声 + 完美光照 ---
const fragmentShader = `
uniform float time;
uniform vec3 colorHot;
uniform vec3 colorCool;
uniform float cutAngle;
uniform bool isShell;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vModelPosition;
varying vec3 vViewPosition;

// --- Simplex Noise 算法 ---
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

void main() {
    // 1. 切割逻辑 (洋葱皮)
    float angle = atan(vModelPosition.x, vModelPosition.z);
    // 让切口固定在正面右侧，不随噪声旋转
    if (angle > 0.0 && angle < cutAngle) {
        discard;
    }

    // 2. 高级噪声纹理 (3层叠加 = 4K画质)
    // 基础流动 (低频)
    float noise1 = snoise(vNormal * 2.5 + time * 0.2);
    // 细节纹理 (中频)
    float noise2 = snoise(vNormal * 8.0 + time * 0.4);
    // 微观颗粒 (高频) - 这一层是精细度的关键
    float noise3 = snoise(vNormal * 20.0 + time * 0.6);
    
    // 混合权重：基础占50%，细节占30%，颗粒占20%
    float combinedNoise = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;
    
    // 颜色混合增强对比度
    float intensity = smoothstep(-0.2, 0.8, combinedNoise); 
    vec3 surfaceColor = mix(colorCool, colorHot, intensity);

    // 3. 物理级光照
    vec3 viewDir = normalize(vViewPosition);
    vec3 normal = normalize(vNormal);

    // 内壁法线反转
    if (!gl_FrontFacing) {
        normal = -normal;
    }

    // 菲涅尔效应
    float fresnel = dot(viewDir, normal);
    fresnel = clamp(fresnel, 0.0, 1.0);
    
    // 边缘光晕 (Atmosphere)
    float atmosphere = pow(1.0 - fresnel, 4.0); 

    vec3 finalColor;

    if (gl_FrontFacing) {
        // 外表面：中心亮，边缘暗(Limb Darkening) + 最外圈发光(Glow)
        float limbDarkening = 0.3 + 0.7 * fresnel;
        finalColor = surfaceColor * limbDarkening;
        finalColor += colorHot * atmosphere * 1.8; // 增强光晕强度
    } else {
        // 内表面：稍微压暗，模拟内部深邃感
        finalColor = surfaceColor * 0.7; 
        // 内部高光，模拟岩浆反光
        finalColor += colorHot * 0.3 * pow(fresnel, 3.0);
    }

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export class ProgenitorStar {
    constructor(scene) {
        this.scene = scene;
        this.layers = []; 
        this.baseRadius = 4.0;
        this.targetCutAngle = 0;
    }

    init() {
        // 调整了颜色，使其更具“电影感”
        const layerData = [
            { name: "Fe (Core)", radius: 0.15, colorHot: 0xffffff, colorCool: 0x88ccff }, // 铁核：极热白蓝
            { name: "Si",        radius: 0.30, colorHot: 0xffddaa, colorCool: 0xaa6600 }, // 硅：熔岩黄
            { name: "O",         radius: 0.45, colorHot: 0xff3300, colorCool: 0x440000 }, // 氧：深红
            { name: "Ne",        radius: 0.60, colorHot: 0xff00ff, colorCool: 0x330033 }, // 氖：高能紫
            { name: "C",         radius: 0.75, colorHot: 0x00ff44, colorCool: 0x002200 }, // 碳：翡翠绿
            { name: "He",        radius: 0.88, colorHot: 0x00aaff, colorCool: 0x001144 }, // 氦：深海蓝
            { name: "H (Envelope)", radius: 1.0,  colorHot: 0xffaa00, colorCool: 0xcc2200 } // 氢：经典的红巨星
        ];

        layerData.forEach(data => {
            // 保持高细分度
            const geometry = new THREE.SphereGeometry(this.baseRadius * data.radius, 128, 128);
            
            const uniforms = {
                time: { value: Math.random() * 100 },
                colorHot: { value: new THREE.Color(data.colorHot) },
                colorCool: { value: new THREE.Color(data.colorCool) },
                cutAngle: { value: 0.0 },
                isShell: { value: data.name !== "Fe (Core)" }
            };

            const material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = data.name;
            
            this.scene.add(mesh);
            
            // 注意：移除了 'speed' 属性，因为我们不再旋转Mesh本身
            this.layers.push({ mesh, uniforms });
        });
    }

    update(deltaTime) {
        if (this.layers.length > 0) {
            const currentAngle = this.layers[0].uniforms.cutAngle.value;
            const newAngle = THREE.MathUtils.lerp(currentAngle, this.targetCutAngle, deltaTime * 2.0);

            this.layers.forEach((layer, index) => {
                // 1. 更新时间：让岩浆流动 (每层流动速度稍有不同，增加层次感)
                const flowSpeed = 1.0 - (index * 0.1); 
                layer.uniforms.time.value += deltaTime * flowSpeed; 
                
                // 2. 移除 Mesh 旋转！保证切口永远对其！
                // layer.mesh.rotation.y += ... (已删除)

                // 3. 更新切口角度
                layer.uniforms.cutAngle.value = newAngle;
            });
        }
    }

    toggleCutout(isOpen) {
        this.targetCutAngle = isOpen ? Math.PI / 1.5 : 0.0;
    }
}
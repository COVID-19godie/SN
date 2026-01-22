import * as THREE from 'three';

// ==========================================
// 0. 公共函数：GLSL 噪声算法 (Simplex Noise)
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
// 1. 恒星本体着色器 (Star Body)
//    关键升级：物理沸腾(Vertex Displacement) + 耀斑(Flares)
// ==========================================

const starVertexShader = `
uniform float time;
uniform float boilScale; // 沸腾幅度 (物理形变程度)
uniform float boilSpeed;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vModelPosition;
varying vec3 vViewPosition;
varying float vDisplacement; // 将位移量传递给片元，用于温度映射

${noiseChunk}

void main() {
    vUv = uv;
    // 原始法线
    vec3 objectNormal = normalize(normal);
    
    // --- 物理升级：对流沸腾计算 ---
    // 使用低频噪声模拟大尺度的对流泡 (Convection Cells)
    // 这种变形对应了恒星演化后期外层的不稳定性
    float noiseVal = snoise(objectNormal * 2.0 + time * boilSpeed);
    
    // 顶点位移：沿法线方向推挤顶点
    // 正值凸起(热上涌)，负值凹陷(冷下沉)
    vec3 newPosition = position + objectNormal * noiseVal * boilScale;
    
    // 记录位移量供片元着色器使用 (越凸起越热)
    vDisplacement = noiseVal;
    
    // 传递坐标
    vNormal = normalize(normalMatrix * objectNormal);
    vModelPosition = position; // 保持原始坐标用于切割，防止切口抖动
    
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
varying float vDisplacement; // 来自顶点的凸起程度

${noiseChunk}

void main() {
    // 1. 洋葱切割逻辑
    float angle = atan(vModelPosition.x, vModelPosition.z);
    if (angle > 0.0 && angle < cutAngle) {
        discard;
    }

    vec3 normal = normalize(vNormal);
    if (!gl_FrontFacing) normal = -normal;

    // 2. 表面纹理 (Granulation)
    // 结合三层噪声模拟米粒组织
    float n1 = snoise(normal * 3.0 + time * 0.2);
    float n2 = snoise(normal * 10.0 + time * 0.5);
    float n3 = snoise(normal * 25.0 + time * 0.8); // 高频细节
    float textureNoise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

    // 3. 温度映射 (物理耦合)
    // 颜色不再只看纹理，而是和物理位移挂钩
    // 凸起的地方(vDisplacement > 0)更热更亮
    float tempFactor = textureNoise * 0.4 + vDisplacement * 0.6;
    vec3 surfaceColor = mix(colorCool, colorHot, smoothstep(-0.4, 0.8, tempFactor));

    // 4. --- 物理升级：磁重联耀斑 (Solar Flares) ---
    // 模拟磁场活动：当局部湍流极其剧烈时，释放能量
    float flareNoise = snoise(normal * 8.0 + time * 1.5);
    // 阈值判定：只在噪声 > 0.75 的极端区域产生耀斑
    float flareMask = smoothstep(0.75, 1.0, flareNoise); 
    // 叠加极亮白色 (能量释放)
    surfaceColor += vec3(1.0, 1.0, 1.0) * flareMask * 3.0; 

    // 5. 光照模型 (Fresnel)
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = dot(viewDir, normal);
    fresnel = clamp(fresnel, 0.0, 1.0);
    
    if (gl_FrontFacing) {
        // 外表面
        float limbDarkening = 0.3 + 0.7 * fresnel;
        float atmosphere = pow(1.0 - fresnel, 3.5);
        
        vec3 finalColor = surfaceColor * limbDarkening;
        finalColor += colorHot * atmosphere * 1.2;
        gl_FragColor = vec4(finalColor, 1.0);
    } else {
        // 内表面
        vec3 innerColor = surfaceColor * 0.6;
        innerColor += colorHot * 0.3 * pow(fresnel, 2.0);
        gl_FragColor = vec4(innerColor, 1.0);
    }
}
`;

// ==========================================
// 2. 太阳风/日冕着色器 (Solar Wind / Corona)
//    独立层：模拟物质抛射和气体逃逸
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
    // 太阳风模拟：沿法线向外流动的噪声
    // 坐标减去 time，让纹理看起来在向外“喷射”
    float flowNoise = snoise(vNormal * 3.5 - vec3(0.0, time * 1.5, 0.0));
    
    // 视线边缘更亮 (Fresnel)，中心透明
    vec3 viewDir = vec3(0.0, 0.0, 1.0); // 简化视线近似
    float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.0);
    
    // 透明度计算：结合流动噪声和菲涅尔效应
    float alpha = smoothstep(0.2, 0.8, flowNoise) * 0.5 * fresnel;
    
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
        this.corona = null; // 太阳风层
        this.baseRadius = 4.0;
        this.targetCutAngle = 0;
        console.log("物理仿真核心已加载：包含沸腾变形、耀斑、太阳风");
    }

    init() {
        // --- A. 创建恒星本体 (Star Body) ---
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
            // 关键：增加网格细分度 (200x200)，否则物理沸腾看起来会像折纸
            const geometry = new THREE.SphereGeometry(this.baseRadius * data.radius, 200, 200);
            
            const uniforms = {
                time: { value: Math.random() * 100 },
                colorHot: { value: new THREE.Color(data.colorHot) },
                colorCool: { value: new THREE.Color(data.colorCool) },
                cutAngle: { value: 0.0 },
                // 物理参数：H包层受对流影响最大，内核受简并压支撑相对稳定
                boilScale: { value: data.name.includes("H") ? 0.08 : 0.01 }, // 变形幅度
                boilSpeed: { value: data.name.includes("H") ? 0.4 : 0.1 }    // 沸腾速度
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

        // --- B. 创建太阳风/日冕层 (Corona) ---
        // 这是一个比恒星稍大的球体，半透明
        const coronaGeo = new THREE.SphereGeometry(this.baseRadius * 1.25, 64, 64);
        const coronaUniforms = {
            time: { value: 0 },
            colorWind: { value: new THREE.Color(0xff5500) } // 橙色恒星风
        };
        const coronaMat = new THREE.ShaderMaterial({
            uniforms: coronaUniforms,
            vertexShader: coronaVertexShader,
            fragmentShader: coronaFragmentShader,
            side: THREE.BackSide, // 渲染背面
            transparent: true,
            depthWrite: false, // 不遮挡内部
            blending: THREE.AdditiveBlending // 发光叠加模式
        });
        
        this.corona = new THREE.Mesh(coronaGeo, coronaMat);
        this.scene.add(this.corona);
    }

    update(deltaTime) {
        // 1. 更新恒星本体
        if (this.layers.length > 0) {
            const currentAngle = this.layers[0].uniforms.cutAngle.value;
            const newAngle = THREE.MathUtils.lerp(currentAngle, this.targetCutAngle, deltaTime * 2.0);

            this.layers.forEach((layer, index) => {
                const speedMultiplier = 1.0 - (index * 0.08); 
                layer.uniforms.time.value += deltaTime * speedMultiplier; 
                layer.uniforms.cutAngle.value = newAngle;
            });
        }

        // 2. 更新太阳风
        if (this.corona) {
            this.corona.material.uniforms.time.value += deltaTime * 0.5;
            // 太阳风轻微呼吸效果 (脉动)
            const pulse = 1.0 + Math.sin(this.corona.material.uniforms.time.value * 2.0) * 0.01;
            this.corona.scale.set(pulse, pulse, pulse);
        }
    }

    toggleCutout(isOpen) {
        this.targetCutAngle = isOpen ? Math.PI / 1.5 : 0.0;
        
        // 当查看内部结构时，隐藏外层的太阳风以防遮挡
        if (this.corona) {
            this.corona.visible = !isOpen; 
        }
    }
}
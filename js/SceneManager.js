import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // 1. 基础组件
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        // 开启色调映射，让高亮部分更真实
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        
        this.init();
    }

    init() {
        // 设置渲染器
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // 设置相机位置
        this.camera.position.set(0, 0, 20);

        // 控制器
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        // 添加背景星星（简易版）
        this.addStarField();

        // --- 后期处理核心：Bloom (辉光) ---
        this.composer = new EffectComposer(this.renderer);
        
        // 1. 渲染原场景
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // 2. 添加虚幻引擎风格的辉光 (UnrealBloom)
        // 参数：分辨率, 强度, 半径, 阈值
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 1.5, 0.4, 0.85);
        bloomPass.strength = 2.0; // 辉光强度
        bloomPass.radius = 0.5;   // 扩散范围
        bloomPass.threshold = 0.1;// 亮度超过多少才发光
        this.composer.addPass(bloomPass);
    }

    addStarField() {
        // 创建背景粒子
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        for (let i = 0; i < 5000; i++) {
            vertices.push(THREE.MathUtils.randFloatSpread(2000)); // x
            vertices.push(THREE.MathUtils.randFloatSpread(2000)); // y
            vertices.push(THREE.MathUtils.randFloatSpread(2000)); // z
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const particles = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x888888, size: 0.7 }));
        this.scene.add(particles);
    }

    render() {
        this.controls.update();
        // 使用 composer 渲染而不是 renderer，这样才会有后期特效
        this.composer.render();
    }

    onWindowResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        this.composer.setSize(this.width, this.height);
    }
}

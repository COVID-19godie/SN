import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { ProgenitorStar } from './objects/ProgenitorStar.js';

try {
    const sceneManager = new SceneManager('canvas-container');
    const star = new ProgenitorStar(sceneManager.scene);
    star.init(); 

    // [新增]: 移除加载遮罩的逻辑
    // 给 2 秒钟的缓冲时间，确保 Shader 编译完成，画面完全准备好
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.opacity = '0'; // 淡出动画
            setTimeout(() => loader.style.display = 'none', 500); // 彻底移除
        }
    }, 2000);

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const deltaTime = clock.getDelta();
        
        if (star) star.update(deltaTime);
        if (sceneManager) sceneManager.render();
    }

    window.addEventListener('resize', () => {
        if (sceneManager) sceneManager.onWindowResize();
    }, false);

    animate();

    // ==========================================
    // UI 事件绑定 (控制教学参数)
    // ==========================================
    
    // 1. 沸腾速度 (Boil Speed)
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    speedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        star.setParams('boilSpeed', val);
        speedVal.innerText = val.toFixed(1);
    });

    // 2. 变形幅度 (Turbulence/Scale)
    const scaleSlider = document.getElementById('scale-slider');
    const scaleVal = document.getElementById('scale-val');
    scaleSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        star.setParams('boilScale', val);
        scaleVal.innerText = val.toFixed(2);
    });

    // 3. 耀斑强度 (Flare Intensity)
    const flareSlider = document.getElementById('flare-slider');
    const flareVal = document.getElementById('flare-val');
    flareSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        star.setParams('flareIntensity', val);
        flareVal.innerText = val.toFixed(1);
    });

    // 4. 自转速度 (Rotation)
    const rotSlider = document.getElementById('rot-slider');
    const rotVal = document.getElementById('rot-val');
    rotSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        star.setParams('rotationSpeed', val);
        rotVal.innerText = val.toFixed(2);
    });

    // 5. 剖面开关
    const btn = document.getElementById('structure-btn');
    btn.addEventListener('click', () => {
        const isOpening = btn.innerText.includes("Open");
        if (isOpening) {
            star.toggleCutout(true);
            btn.innerText = "Close Cutaway View";
            btn.style.borderColor = "#00ffaa"; 
            btn.style.color = "#aaffdd";
        } else {
            star.toggleCutout(false);
            btn.innerText = "Open Cutaway View";
            btn.style.borderColor = "#ffaa00"; 
            btn.style.color = "#fff";
        }
    });

} catch (error) {
    console.error("Main.js 运行出错:", error);
}
import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { ProgenitorStar } from './objects/ProgenitorStar.js';

try {
    // 1. 初始化场景
    const sceneManager = new SceneManager('canvas-container');

    // 2. 初始化恒星
    const star = new ProgenitorStar(sceneManager.scene);
    star.init(); 

    // 3. 动画循环
    const clock = new THREE.Clock();
    let timeScale = 1.0; // 默认时间流速

    function animate() {
        requestAnimationFrame(animate);
        
        // 获取上一帧间隔，并乘以时间倍率
        const rawDelta = clock.getDelta();
        const scaledDelta = rawDelta * timeScale;
        
        // 更新恒星逻辑
        if (star) star.update(scaledDelta);
        
        // 渲染
        if (sceneManager) sceneManager.render();
    }

    // 4. 窗口大小自适应
    window.addEventListener('resize', () => {
        if (sceneManager) sceneManager.onWindowResize();
    }, false);

    // 5. 启动动画
    animate();

    // ==========================================
    // 6. UI 事件绑定
    // ==========================================
    
    // A. 时间流速滑杆
    const timeSlider = document.getElementById('time-slider');
    const timeValue = document.getElementById('time-value');
    
    if (timeSlider && timeValue) {
        timeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            timeScale = val;
            timeValue.innerText = val.toFixed(1) + "x";
        });
    }

    // B. 剖面开关按钮
    const btn = document.getElementById('structure-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            const isOpening = btn.innerText.includes("INITIALIZE");
            if (isOpening) {
                star.toggleCutout(true);
                btn.innerText = "CLOSE STRUCTURE VIEW";
                btn.style.borderLeft = "4px solid #00ffaa"; 
                btn.style.color = "#aaffdd";
            } else {
                star.toggleCutout(false);
                btn.innerText = "INITIALIZE CUTAWAY VIEW";
                btn.style.borderLeft = "4px solid #ffaa00"; 
                btn.style.color = "#ddd";
            }
        });
    }

} catch (error) {
    console.error("Main.js 运行出错:", error);
}
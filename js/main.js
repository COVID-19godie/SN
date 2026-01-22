import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { ProgenitorStar } from './objects/ProgenitorStar.js';

try {
    const sceneManager = new SceneManager('canvas-container');
    const star = new ProgenitorStar(sceneManager.scene);
    
    // 初始化
    star.init(); 

    // 2秒后强制移除 Loading 遮罩
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if (loader) {
             loader.style.opacity = '0'; 
             setTimeout(() => loader.style.display = 'none', 500);
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

    // --- UI 事件绑定 ---
    // 使用 setTimeout 确保 DOM 元素已经渲染
    setTimeout(() => {
        const speedSlider = document.getElementById('speed-slider');
        const speedVal = document.getElementById('speed-val');
        if(speedSlider && speedVal) {
            speedSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                star.setParams('boilSpeed', val);
                speedVal.innerText = val.toFixed(1);
            });
        }

        const scaleSlider = document.getElementById('scale-slider');
        const scaleVal = document.getElementById('scale-val');
        if(scaleSlider && scaleVal) {
            scaleSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                star.setParams('boilScale', val);
                scaleVal.innerText = val.toFixed(2);
            });
        }

        const flareSlider = document.getElementById('flare-slider');
        const flareVal = document.getElementById('flare-val');
        if(flareSlider && flareVal) {
            flareSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                star.setParams('flareIntensity', val);
                flareVal.innerText = val.toFixed(1);
            });
        }

        const rotSlider = document.getElementById('rot-slider');
        const rotVal = document.getElementById('rot-val');
        if(rotSlider && rotVal) {
            rotSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                star.setParams('rotationSpeed', val);
                rotVal.innerText = val.toFixed(2);
            });
        }

        const btn = document.getElementById('structure-btn');
        if(btn) {
            btn.addEventListener('click', () => {
                console.log('按钮被点击了: ' + btn.innerText); // 调试日志
                
                // 【核心修复】：忽略大小写进行判断
                // CSS 的 uppercase 会让 innerText 变成全大写，导致 includes("Open") 失败
                const currentText = btn.innerText.toUpperCase();
                const isOpening = currentText.includes("OPEN");

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
            // 确保鼠标样式正确
            btn.style.cursor = 'pointer';
        }
    }, 100);

} catch (error) {
    console.error("Main.js 运行出错:", error);
    const loader = document.getElementById('loading-screen');
    if(loader) loader.style.display = 'none';
}
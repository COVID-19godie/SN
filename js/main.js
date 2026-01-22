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

    function animate() {
        requestAnimationFrame(animate);
        const deltaTime = clock.getDelta();
        
        // 更新恒星逻辑 (如自转、切割动画)
        if (star) star.update(deltaTime);
        
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
    // 6. 绑定按钮逻辑 (关键修复)
    // ==========================================
    const btn = document.getElementById('structure-btn');
    
    if (btn) {
        // 先移除旧的事件 (防止重复绑定，虽在刷新后不重要但好习惯)
        // 绑定点击事件
        btn.addEventListener('click', () => {
            console.log("按钮被点击了！"); // 调试信息
            
            const isOpening = btn.innerText.includes("INITIALIZE");

            if (isOpening) {
                // 打开
                star.toggleCutout(true);
                btn.innerText = "CLOSE STRUCTURE VIEW";
                btn.style.borderLeft = "4px solid #00ffaa"; 
                btn.style.color = "#aaffdd";
            } else {
                // 关闭
                star.toggleCutout(false);
                btn.innerText = "INITIALIZE CUTAWAY VIEW";
                btn.style.borderLeft = "4px solid #ffaa00"; 
                btn.style.color = "#ddd";
            }
        });
    } else {
        console.error("未找到 ID 为 'structure-btn' 的按钮，请检查 HTML");
    }

} catch (error) {
    console.error("Main.js 运行出错:", error);
}
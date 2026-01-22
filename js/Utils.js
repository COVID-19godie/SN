// Utils.js - 工具模块
// 这里可以放置物理计算、数学工具等辅助函数

export class Utils {
    /**
     * 黑体辐射颜色计算（根据温度返回RGB颜色）
     * @param {number} kelvin - 温度（开尔文）
     * @returns {THREE.Color} - Three.js 颜色对象
     */
    static blackbodyColor(kelvin) {
        // 简化的黑体辐射颜色映射
        // 实际应用中可能需要更精确的普朗克定律计算
        
        let color = new THREE.Color();
        
        if (kelvin < 1000) kelvin = 1000;
        if (kelvin > 40000) kelvin = 40000;
        
        // 使用近似算法将温度映射到RGB
        const temp = kelvin / 100;
        
        let red, green, blue;
        
        // 计算红色分量
        if (temp <= 66) {
            red = 255;
        } else {
            red = temp - 60;
            red = 329.698727446 * Math.pow(red, -0.1332047592);
            red = Math.min(255, Math.max(0, red));
        }
        
        // 计算绿色分量
        if (temp <= 66) {
            green = temp;
            green = 99.4708025861 * Math.log(green) - 161.1195681661;
        } else {
            green = temp - 60;
            green = 288.1221695283 * Math.pow(green, -0.0755148492);
        }
        green = Math.min(255, Math.max(0, green));
        
        // 计算蓝色分量
        if (temp >= 66) {
            blue = 255;
        } else if (temp <= 19) {
            blue = 0;
        } else {
            blue = temp - 10;
            blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
            blue = Math.min(255, Math.max(0, blue));
        }
        
        color.setRGB(red / 255, green / 255, blue / 255);
        return color;
    }
    
    /**
     * 线性插值
     * @param {number} a - 起始值
     * @param {number} b - 结束值
     * @param {number} t - 插值系数 (0-1)
     * @returns {number} - 插值结果
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    /**
     * 将值限制在指定范围内
     * @param {number} value - 输入值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} - 限制后的值
     */
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    
    /**
     * 生成随机数
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} - 随机数
     */
    static randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    /**
     * 度转弧度
     * @param {number} degrees - 角度（度）
     * @returns {number} - 弧度
     */
    static degToRad(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    /**
     * 弧度转度
     * @param {number} radians - 弧度
     * @returns {number} - 角度（度）
     */
    static radToDeg(radians) {
        return radians * (180 / Math.PI);
    }
}

export default Utils;

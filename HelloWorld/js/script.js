// 获取文本元素
const helloText = document.getElementById('helloText');

// 定义科技感颜色数组
const colors = [
    { color: '#00ffff', shadow: 'rgba(0, 255, 255, 0.8)' },      // 青色
    { color: '#00ff88', shadow: 'rgba(0, 255, 136, 0.8)' },      // 青绿色
    { color: '#00ff00', shadow: 'rgba(0, 255, 0, 0.8)' },        // 绿色
    { color: '#88ff00', shadow: 'rgba(136, 255, 0, 0.8)' },      // 黄绿色
    { color: '#ffff00', shadow: 'rgba(255, 255, 0, 0.8)' },      // 黄色
    { color: '#ff8800', shadow: 'rgba(255, 136, 0, 0.8)' },      // 橙色
    { color: '#ff00ff', shadow: 'rgba(255, 0, 255, 0.8)' },      // 洋红色
    { color: '#8a2be2', shadow: 'rgba(138, 43, 226, 0.8)' },     // 蓝紫色
    { color: '#0088ff', shadow: 'rgba(0, 136, 255, 0.8)' },      // 蓝色
    { color: '#ff0088', shadow: 'rgba(255, 0, 136, 0.8)' }       // 玫瑰色
];

let currentColorIndex = 0;

// 改变颜色的函数
function changeColor() {
    const currentColor = colors[currentColorIndex];

    // 更新文本颜色和阴影
    helloText.style.color = currentColor.color;
    helloText.style.textShadow = `
        0 0 10px ${currentColor.shadow},
        0 0 20px ${currentColor.shadow.replace('0.8', '0.6')},
        0 0 30px ${currentColor.shadow.replace('0.8', '0.4')},
        0 0 40px ${currentColor.shadow.replace('0.8', '0.2')},
        0 0 70px ${currentColor.shadow.replace('0.8', '0.1')},
        0 0 100px ${currentColor.shadow.replace('0.8', '0.05')}
    `;

    // 移动到下一个颜色
    currentColorIndex = (currentColorIndex + 1) % colors.length;
}

// 初始化颜色
changeColor();

// 每1秒改变一次颜色
setInterval(changeColor, 1000);

// 添加鼠标悬停效果
helloText.addEventListener('mouseenter', () => {
    helloText.style.transform = 'scale(1.1) translateY(-20px)';
});

helloText.addEventListener('mouseleave', () => {
    helloText.style.transform = 'scale(1) translateY(0)';
});

# HelloWorld - 动态艺术字展示

一个使用 HTML、CSS 和 JavaScript 创建的动态艺术字展示页面。

## 功能特点

- 大型艺术字展示 "Hello World !"
- 文字颜色每1秒自动变化一次（10种科技感配色）
- 发光阴影效果，增强视觉冲击力
- 科技感动态背景（渐变 + 网格动画）
- 文字浮动动画效果
- 鼠标悬停交互效果
- 响应式设计，支持各种屏幕尺寸

## 文件结构

```
HelloWorld/
├── index.html          # 主页面
├── css/
│   └── style.css      # 样式文件
├── js/
│   └── script.js      # JavaScript 脚本
├── images/            # 图片资源目录（可选）
└── README.md          # 项目说明
```

## 使用方法

1. 直接在浏览器中打开 `index.html` 文件
2. 或者使用本地服务器运行（推荐）

### 使用本地服务器（推荐）

如果你已安装 Python：

```bash
# Python 3
python -m http.server 8000

# 然后在浏览器访问 http://localhost:8000
```

如果你已安装 Node.js：

```bash
# 安装 http-server
npm install -g http-server

# 运行
http-server

# 然后在浏览器访问显示的地址
```

## 技术栈

- HTML5
- CSS3 (动画、渐变、阴影效果)
- JavaScript (ES6+)

## 颜色主题

项目使用10种科技感配色循环变换：
- 青色 (Cyan)
- 青绿色 (Turquoise)
- 绿色 (Green)
- 黄绿色 (Lime)
- 黄色 (Yellow)
- 橙色 (Orange)
- 洋红色 (Magenta)
- 蓝紫色 (Blue Violet)
- 蓝色 (Blue)
- 玫瑰色 (Rose)

## 自定义背景图片（可选）

如果想使用自己的科技感背景图片：

1. 将图片放入 `images/` 目录
2. 在 `css/style.css` 中修改 body 样式：

```css
body {
    background: url('../images/your-image.jpg') no-repeat center center fixed;
    background-size: cover;
}
```

## 浏览器兼容性

- Chrome (推荐)
- Firefox
- Safari
- Edge

## 作者

JackT

## 许可证

MIT License

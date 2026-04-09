// 知识星球网站主JavaScript文件

document.addEventListener('DOMContentLoaded', function() {
    // 移动端导航菜单切换
    initMobileMenu();
    
    // 点赞功能
    initLikeButtons();
    
    // 分享功能
    initShareButtons();
    
    // 平滑滚动
    initSmoothScroll();
    
    // 代码块复制功能
    initCodeCopy();
    
    // 图片懒加载
    initLazyLoad();
    
    // 阅读进度指示器
    initReadingProgress();
});

/**
 * 移动端菜单切换
 */
function initMobileMenu() {
    const toggleBtn = document.querySelector('.navbar-toggle');
    const menu = document.querySelector('.navbar-menu');
    
    if (!toggleBtn || !menu) return;
    
    toggleBtn.addEventListener('click', function() {
        menu.classList.toggle('active');
        this.classList.toggle('active');
        
        // 动画汉堡菜单图标
        const spans = this.querySelectorAll('span');
        if (menu.classList.contains('active')) {
            spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
        } else {
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    });
    
    // 点击菜单外区域关闭菜单
    document.addEventListener('click', function(event) {
        if (!menu.contains(event.target) && !toggleBtn.contains(event.target)) {
            menu.classList.remove('active');
            toggleBtn.classList.remove('active');
            
            const spans = toggleBtn.querySelectorAll('span');
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    });
}

/**
 * 点赞功能
 */
function initLikeButtons() {
    const likeButtons = document.querySelectorAll('.btn-like, .like-btn');
    
    likeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const postId = this.dataset.postId || 'default';
            const likeCount = this.querySelector('.like-count');
            
            // 从localStorage获取点赞状态
            const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '{}');
            const isLiked = likedPosts[postId];
            
            if (isLiked) {
                // 取消点赞
                likedPosts[postId] = false;
                this.classList.remove('liked');
                if (likeCount) {
                    const currentCount = parseInt(likeCount.textContent) || 0;
                    likeCount.textContent = Math.max(0, currentCount - 1);
                }
            } else {
                // 点赞
                likedPosts[postId] = true;
                this.classList.add('liked');
                if (likeCount) {
                    const currentCount = parseInt(likeCount.textContent) || 0;
                    likeCount.textContent = currentCount + 1;
                }
            }
            
            // 保存到localStorage
            localStorage.setItem('likedPosts', JSON.stringify(likedPosts));
            
            // 动画效果
            this.style.transform = 'scale(1.1)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 200);
            
            // 更新图标
            const icon = this.querySelector('i');
            if (icon) {
                icon.classList.toggle('far');
                icon.classList.toggle('fas');
            }
        });
        
        // 初始化点赞状态
        const postId = button.dataset.postId || 'default';
        const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '{}');
        if (likedPosts[postId]) {
            button.classList.add('liked');
            const icon = button.querySelector('i');
            if (icon) {
                icon.classList.remove('far');
                icon.classList.add('fas');
            }
        }
    });
}

/**
 * 分享功能
 */
function initShareButtons() {
    const shareButtons = document.querySelectorAll('.share-btn');
    
    shareButtons.forEach(button => {
        button.addEventListener('click', function() {
            const platform = this.dataset.platform;
            const url = this.dataset.url || window.location.href;
            const title = this.dataset.title || document.title;
            const text = this.dataset.text || document.querySelector('meta[name="description"]')?.content || '';
            
            let shareUrl = '';
            
            switch(platform) {
                case 'twitter':
                    shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
                    break;
                case 'linkedin':
                    shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
                    break;
                case 'reddit':
                    shareUrl = `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
                    break;
                case 'telegram':
                    shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
                    break;
                case 'whatsapp':
                    shareUrl = `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`;
                    break;
                default:
                    // 使用Web Share API（如果支持）
                    if (navigator.share) {
                        navigator.share({
                            title: title,
                            text: text,
                            url: url
                        });
                        return;
                    }
                    break;
            }
            
            if (shareUrl) {
                window.open(shareUrl, '_blank', 'width=600,height=400');
            }
        });
    });
}

/**
 * 平滑滚动
 */
function initSmoothScroll() {
    // 内部链接平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            
            const targetElement = document.querySelector(href);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // 更新URL（不刷新页面）
                if (history.pushState) {
                    history.pushState(null, null, href);
                }
            }
        });
    });
}

/**
 * 代码块复制功能
 */
function initCodeCopy() {
    document.querySelectorAll('pre').forEach(pre => {
        // 创建复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '<i class="far fa-copy"></i>';
        copyBtn.title = '复制代码';
        
        // 插入到pre元素
        pre.style.position = 'relative';
        copyBtn.style.position = 'absolute';
        copyBtn.style.top = '0.5rem';
        copyBtn.style.right = '0.5rem';
        copyBtn.style.padding = '0.25rem 0.5rem';
        copyBtn.style.background = 'rgba(255,255,255,0.1)';
        copyBtn.style.border = 'none';
        copyBtn.style.borderRadius = '0.25rem';
        copyBtn.style.color = '#e2e8f0';
        copyBtn.style.cursor = 'pointer';
        copyBtn.style.fontSize = '0.875rem';
        copyBtn.style.transition = 'all 0.2s';
        
        pre.appendChild(copyBtn);
        
        // 复制功能
        copyBtn.addEventListener('click', function() {
            const code = pre.querySelector('code')?.textContent || pre.textContent;
            
            navigator.clipboard.writeText(code).then(() => {
                // 显示成功提示
                const originalHTML = this.innerHTML;
                this.innerHTML = '<i class="fas fa-check"></i>';
                this.style.background = '#10b981';
                
                setTimeout(() => {
                    this.innerHTML = originalHTML;
                    this.style.background = 'rgba(255,255,255,0.1)';
                }, 2000);
            }).catch(err => {
                console.error('复制失败:', err);
                this.style.background = '#ef4444';
                setTimeout(() => {
                    this.style.background = 'rgba(255,255,255,0.1)';
                }, 2000);
            });
        });
        
        // 悬停效果
        pre.addEventListener('mouseenter', () => {
            copyBtn.style.opacity = '1';
        });
        
        pre.addEventListener('mouseleave', () => {
            copyBtn.style.opacity = '0.5';
        });
        
        copyBtn.style.opacity = '0.5';
    });
}

/**
 * 图片懒加载
 */
function initLazyLoad() {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    } else {
        // 降级方案
        images.forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
    }
}

/**
 * 阅读进度指示器
 */
function initReadingProgress() {
    const article = document.querySelector('.post-single');
    if (!article) return;
    
    // 创建进度条
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.style.position = 'fixed';
    progressBar.style.top = '0';
    progressBar.style.left = '0';
    progressBar.style.width = '0%';
    progressBar.style.height = '3px';
    progressBar.style.background = 'var(--primary-color)';
    progressBar.style.zIndex = '9999';
    progressBar.style.transition = 'width 0.1s';
    
    document.body.appendChild(progressBar);
    
    // 计算阅读进度
    function updateProgress() {
        const articleHeight = article.offsetHeight;
        const windowHeight = window.innerHeight;
        const scrollTop = window.scrollY;
        const articleTop = article.offsetTop;
        
        if (scrollTop >= articleTop) {
            const scrolled = scrollTop - articleTop;
            const progress = Math.min((scrolled / (articleHeight - windowHeight)) * 100, 100);
            progressBar.style.width = progress + '%';
        } else {
            progressBar.style.width = '0%';
        }
    }
    
    // 监听滚动
    window.addEventListener('scroll', updateProgress);
    updateProgress();
}

/**
 * 主题切换（预留功能）
 */
function initThemeToggle() {
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    themeToggle.title = '切换主题';
    themeToggle.style.position = 'fixed';
    themeToggle.style.bottom = '2rem';
    themeToggle.style.right = '2rem';
    themeToggle.style.zIndex = '1000';
    
    document.body.appendChild(themeToggle);
    
    themeToggle.addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        this.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });
    
    // 初始化主题
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

// 错误处理
window.addEventListener('error', function(e) {
    console.error('JavaScript错误:', e.error);
});

// 控制台欢迎信息
console.log(`
✨ 欢迎来到知识星球！
🌐 网站: https://helloliying.github.io/knowledge-planet/
📂 源码: https://github.com/helloliying/knowledge-planet
💡 提示: 这是一个基于Hugo的个人知识管理网站
`);
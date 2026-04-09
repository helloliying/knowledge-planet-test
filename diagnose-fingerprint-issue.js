// 诊断指纹信息显示问题
console.log('🔍 开始诊断指纹信息显示问题...');

// 检查localStorage中的指纹数据
const sharedData = localStorage.getItem('ks_shared_trajectory_data');
console.log('1. 检查共享数据是否存在:', sharedData ? '✅ 存在' : '❌ 不存在');

if (sharedData) {
    try {
        const data = JSON.parse(sharedData);
        console.log('2. 解析共享数据:', data ? '✅ 成功' : '❌ 失败');
        
        if (data) {
            console.log('3. 检查指纹数据:', data.fingerprint ? '✅ 存在' : '❌ 不存在');
            
            if (data.fingerprint) {
                console.log('4. 指纹数据结构:', {
                    hash: data.fingerprint.hash || '无',
                    browser: data.fingerprint.browser ? '有' : '无',
                    screen: data.fingerprint.screen ? '有' : '无',
                    parsedUA: data.fingerprint.parsedUA ? '有' : '无',
                    timestamp: data.fingerprint.timestamp || '无'
                });
                
                console.log('5. 指纹哈希值:', data.fingerprint.hash || '无哈希值');
                
                // 检查是否包含哈希字段
                if (data.fingerprint.hash) {
                    console.log('✅ 指纹哈希值存在:', data.fingerprint.hash);
                } else {
                    console.log('❌ 问题: 指纹数据缺少hash字段');
                    console.log('完整指纹数据:', JSON.stringify(data.fingerprint, null, 2));
                }
            } else {
                console.log('❌ 问题: 共享数据中无fingerprint字段');
                console.log('共享数据字段:', Object.keys(data));
            }
        }
    } catch (error) {
        console.error('❌ 解析共享数据失败:', error);
    }
}

// 检查页面元素
const fingerprintInfoElement = document.getElementById('fingerprint-info');
console.log('6. 检查页面元素:', fingerprintInfoElement ? '✅ 找到元素' : '❌ 找不到元素');

// 检查定时器是否运行
console.log('7. 检查定时器状态:', '需要手动检查displayFingerprintInfo函数');

// 手动运行显示函数
console.log('\n🚀 手动运行displayFingerprintInfo函数...');
if (typeof displayFingerprintInfo === 'function') {
    try {
        displayFingerprintInfo();
        console.log('✅ 函数执行成功');
    } catch (error) {
        console.error('❌ 函数执行失败:', error);
    }
} else {
    console.log('❌ displayFingerprintInfo函数未定义');
}

// 检查函数定义
console.log('\n📋 检查函数定义:');
console.log('displayFingerprintInfo类型:', typeof displayFingerprintInfo);

// 检查localStorage大小
console.log('\n📊 localStorage使用情况:');
try {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        const size = (key.length + value.length) * 2; // 近似字节数
        totalSize += size;
        if (key.startsWith('ks_')) {
            console.log(`  ${key}: ${Math.round(size/1024*100)/100} KB`);
        }
    }
    console.log(`总大小: ${Math.round(totalSize/1024*100)/100} KB`);
} catch (error) {
    console.log('无法计算localStorage大小:', error);
}

console.log('\n🔍 诊断完成。请查看上面的结果。');
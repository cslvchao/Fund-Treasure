// 存储基金列表
let funds = JSON.parse(localStorage.getItem('funds') || '[]');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    renderFunds();
    if (funds.length > 0) {
        updateAllFunds();
        setInterval(updateAllFunds, 60000); // 每分钟更新
    }
});

// 添加基金
function addFund() {
    const code = document.getElementById('fundCode').value.trim();
    const amount = parseFloat(document.getElementById('holdAmount').value);
    
    if (!code || !amount || amount <= 0) {
        alert('请输入有效的基金代码和持有金额');
        return;
    }
    
    if (funds.find(f => f.code === code)) {
        alert('该基金已添加');
        return;
    }
    
    funds.push({ 
        code, 
        amount, 
        name: '', 
        estimateRate: 0, 
        holdings: [],
        expanded: false,
        date: ''  // 持仓日期
    });
    saveFunds();
    
    document.getElementById('fundCode').value = '';
    document.getElementById('holdAmount').value = '';
    
    renderFunds();
    updateFund(code);
}

// 删除基金
function deleteFund(code) {
    if (confirm('确定删除该基金吗？')) {
        funds = funds.filter(f => f.code !== code);
        saveFunds();
        renderFunds();
        updateSummary();
    }
}

// 切换持仓显示
function toggleHoldings(code) {
    const fund = funds.find(f => f.code === code);
    if (fund) {
        fund.expanded = !fund.expanded;
        saveFunds();
        renderFunds();
    }
}

// 保存到本地存储
function saveFunds() {
    localStorage.setItem('funds', JSON.stringify(funds));
}

// 渲染基金列表
function renderFunds() {
    const container = document.getElementById('fundList');
    const summary = document.getElementById('summary');
    
    if (funds.length === 0) {
        container.innerHTML = '<div class="loading">暂无基金，请添加</div>';
        summary.style.display = 'none';
        return;
    }
    
    summary.style.display = 'block';
    container.innerHTML = funds.map(fund => `
        <div class="fund-card" id="fund-${fund.code}">
            <div class="fund-header">
                <div>
                    <div class="fund-name">${fund.name || '加载中...'}</div>
                    <div class="fund-code">${fund.code}</div>
                </div>
                <div>
                    <button class="expand-btn" onclick="toggleHoldings('${fund.code}')">
                        ${fund.expanded ? '收起' : '查看'}持仓
                    </button>
                    <button class="delete-btn" onclick="deleteFund('${fund.code}')">删除</button>
                </div>
            </div>
            <div class="fund-data">
                <div class="data-item">
                    <span class="data-label">持有金额</span>
                    <span class="data-value">¥${fund.amount.toFixed(2)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">估算涨跌幅</span>
                    <span class="data-value ${fund.estimateRate >= 0 ? 'positive' : 'negative'}">
                        ${fund.estimateRate >= 0 ? '+' : ''}${fund.estimateRate.toFixed(2)}%
                    </span>
                </div>
                <div class="data-item">
                    <span class="data-label">估算盈亏</span>
                    <span class="data-value ${fund.estimateRate >= 0 ? 'positive' : 'negative'}">
                        ¥${(fund.amount * fund.estimateRate / 100).toFixed(2)}
                    </span>
                </div>
                <div class="data-item">
                    <span class="data-label">重仓股数量</span>
                    <span class="data-value">${fund.holdings.length}只</span>
                </div>
            </div>
            <div class="holdings ${fund.expanded ? 'show' : ''}">
                <div class="holdings-title">前十大重仓股${fund.date ? ` (截至${fund.date})` : ''}</div>
                <div class="holdings-header">
                    <span class="header-name">股票名称（代码）</span>
                    <span class="header-ratio">持仓占比</span>
                    <span class="header-change">今日涨跌</span>
                </div>
                ${fund.holdings.map(h => `
                    <div class="holding-item">
                        <span class="stock-name">${h.name} (${h.code})</span>
                        <span class="stock-ratio">${h.ratio}%</span>
                        <span class="stock-change ${h.change >= 0 ? 'positive' : 'negative'}">
                            ${h.change >= 0 ? '+' : ''}${h.change.toFixed(2)}%
                        </span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// 获取基金持仓信息
async function getFundHoldings(code) {
    try {
        // 通过代理服务器获取持仓数据
        const response = await fetch(`http://localhost:3000/api/fund/holdings/${code}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log(`获取基金 ${code} 持仓数据:`, data);
        
        // 如果名称为空或是默认名称，尝试单独获取名称
        if (!data.name || data.name === `基金${code}`) {
            try {
                const nameResponse = await fetch(`http://localhost:3000/api/fund/name/${code}`);
                const nameData = await nameResponse.json();
                data.name = nameData.name;
            } catch (e) {
                console.log('获取基金名称失败，使用默认名称');
            }
        }
        
        return data;
    } catch (error) {
        console.error('获取持仓失败:', error);
        // 如果代理服务器未启动，返回空数组
        return { name: `基金${code}`, holdings: [] };
    }
}

// 获取股票实时行情
async function getStockPrice(stockCode) {
    try {
        // 通过代理服务器获取股票行情
        const response = await fetch(`http://localhost:3000/api/stock/price/${stockCode}`);
        const data = await response.json();
        return data.change || 0;
    } catch (error) {
        console.error(`获取股票 ${stockCode} 行情失败:`, error);
        return 0;
    }
}

// 更新单个基金
async function updateFund(code) {
    const fund = funds.find(f => f.code === code);
    if (!fund) return;
    
    try {
        // 如果没有持仓数据，先获取
        if (fund.holdings.length === 0) {
            const holdingsData = await getFundHoldings(code);
            fund.holdings = holdingsData.holdings || [];
            fund.name = holdingsData.name || `基金${code}`;
            fund.date = holdingsData.date || '';  // 保存持仓日期
            
            // 如果API获取失败，给出提示
            if (fund.holdings.length === 0) {
                console.error(`基金 ${code} 未能获取到持仓数据`);
                alert(`无法获取基金 ${code} 的持仓数据，请检查：\n1. 基金代码是否正确\n2. 代理服务器是否正常运行\n3. 网络连接是否正常`);
                // 删除这个基金
                funds = funds.filter(f => f.code !== code);
                saveFunds();
                renderFunds();
                return;
            }
            
            console.log(`基金 ${code} 获取到 ${fund.holdings.length} 只重仓股`);
        }
        
        // 获取所有重仓股的实时涨跌
        let totalWeightedChange = 0;
        let totalWeight = 0;
        
        for (const holding of fund.holdings) {
            const change = await getStockPrice(holding.code);
            holding.change = change;
            totalWeightedChange += change * holding.ratio;
            totalWeight += holding.ratio;
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 计算加权平均涨跌幅
        fund.estimateRate = totalWeight > 0 ? totalWeightedChange / totalWeight : 0;
        
        saveFunds();
        renderFunds();
        updateSummary();
    } catch (error) {
        console.error(`更新基金 ${code} 失败:`, error);
    }
}

// 更新所有基金
async function updateAllFunds() {
    for (const fund of funds) {
        await updateFund(fund.code);
    }
    
    const now = new Date();
    document.getElementById('updateTime').textContent = 
        `最后更新: ${now.toLocaleTimeString('zh-CN')}`;
}

// 更新汇总信息
function updateSummary() {
    const totalHold = funds.reduce((sum, f) => sum + f.amount, 0);
    const totalProfit = funds.reduce((sum, f) => sum + (f.amount * f.estimateRate / 100), 0);
    
    document.getElementById('totalHold').textContent = `¥${totalHold.toFixed(2)}`;
    const profitEl = document.getElementById('totalProfit');
    profitEl.textContent = `¥${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}`;
    profitEl.className = totalProfit >= 0 ? 'positive' : 'negative';
}

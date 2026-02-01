// Node.js 代理服务器 - 用于解决跨域问题
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

// 获取基金持仓信息 - 获取最新季度数据
app.get('/api/fund/holdings/:code', async (req, res) => {
    try {
        const { code } = req.params;
        console.log(`\n[获取持仓] 基金代码: ${code}`);
        
        // 获取当前年份和季度，尝试获取最新数据
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        // 确定最近的季度末月份
        let targetYear = currentYear;
        let targetMonth;
        
        // 当前是2026年1月，最新应该是2025年12月
        if (currentMonth <= 3) {
            // 第1季度，尝试上一年第4季度
            targetYear = currentYear - 1;  // 2025
            targetMonth = 12;
        } else if (currentMonth <= 6) {
            targetYear = currentYear;
            targetMonth = 3;
        } else if (currentMonth <= 9) {
            targetYear = currentYear;
            targetMonth = 6;
        } else {
            targetYear = currentYear;
            targetMonth = 9;
        }
        
        console.log(`[尝试获取] ${targetYear}年${targetMonth}月的持仓数据`);
        
        // 使用FundArchivesDatas获取指定季度的持仓数据
        const apiUrl = `http://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10&year=${targetYear}&month=${targetMonth}`;
        console.log(`[API] ${apiUrl}`);
        
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `http://fundf10.eastmoney.com/ccmx_${code}.html`
            },
            timeout: 10000
        });
        
        const html = response.data;
        
        // 提取content内容
        const contentMatch = html.match(/content:"([^"]+)"/);
        if (!contentMatch) {
            console.log('[警告] 未找到content数据');
            return res.json({
                code,
                name: `基金${code}`,
                holdings: [],
                error: '未找到持仓数据'
            });
        }
        
        // 解码HTML实体
        let content = contentMatch[1]
            .replace(/\\"/g, '"')
            .replace(/\\\//g, '/')
            .replace(/\\r\\n/g, '')
            .replace(/\\n/g, '');
        
        // 使用cheerio解析HTML
        const $ = cheerio.load(content);
        
        // 获取基金名称
        const fundName = $('a[title]').first().attr('title') || `基金${code}`;
        console.log(`[基金名称] ${fundName}`);
        
        // 查找第一个有数据的表格（最新一期）
        const holdings = [];
        let holdingDate = '';
        let found = false;
        
        $('.box').each((boxIdx, box) => {
            if (found) return false;
            
            // 获取持仓日期
            const dateText = $(box).find('.right.lab2 font, .right font').text().trim();
            
            const table = $(box).find('table tbody');
            const rows = table.find('tr');
            
            console.log(`[表格${boxIdx + 1}] 日期: ${dateText}, 数据行数: ${rows.length}`);
            
            if (rows.length > 0) {
                holdingDate = dateText;
                
                rows.each((i, row) => {
                    if (holdings.length >= 10) return false;
                    
                    const cols = $(row).find('td');
                    
                    // 2025年第4季度的表格有9列（多了最新价和涨跌幅）
                    // 其他季度的表格有7列
                    let stockCode, stockName, ratioText, ratio;
                    
                    if (cols.length >= 9) {
                        // 新格式：序号、代码、名称、最新价、涨跌幅、相关资讯、占比、持股数、市值
                        stockCode = $(cols[1]).text().trim();
                        stockName = $(cols[2]).text().trim();
                        ratioText = $(cols[6]).text().trim().replace('%', '');
                        ratio = parseFloat(ratioText);
                    } else if (cols.length >= 7) {
                        // 旧格式：序号、代码、名称、相关资讯、占比、持股数、市值
                        stockCode = $(cols[1]).text().trim();
                        stockName = $(cols[2]).text().trim();
                        ratioText = $(cols[4]).text().trim().replace('%', '');
                        ratio = parseFloat(ratioText);
                    }
                    
                    if (stockCode && stockName && !isNaN(ratio)) {
                        holdings.push({
                            code: stockCode,
                            name: stockName,
                            ratio: ratio
                        });
                        console.log(`[持仓${holdings.length}] ${stockName}(${stockCode}) ${ratio}%`);
                    }
                });
                
                if (holdings.length > 0) {
                    found = true;
                }
            }
        });
        
        if (holdings.length === 0) {
            console.log('[警告] 未能解析出持仓数据，尝试获取上一季度数据');
            
            // 如果当前季度没有数据，尝试上一季度
            let prevYear = targetYear;
            let prevMonth = targetMonth - 3;
            if (prevMonth <= 0) {
                prevMonth = 12;
                prevYear = targetYear - 1;
            }
            
            console.log(`[尝试获取] ${prevYear}年${prevMonth}月的持仓数据`);
            
            const prevApiUrl = `http://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10&year=${prevYear}&month=${prevMonth}`;
            const prevResponse = await axios.get(prevApiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': `http://fundf10.eastmoney.com/ccmx_${code}.html`
                },
                timeout: 10000
            });
            
            const prevHtml = prevResponse.data;
            const prevContentMatch = prevHtml.match(/content:"([^"]+)"/);
            
            if (prevContentMatch) {
                let prevContent = prevContentMatch[1]
                    .replace(/\\"/g, '"')
                    .replace(/\\\//g, '/')
                    .replace(/\\r\\n/g, '')
                    .replace(/\\n/g, '');
                
                const $prev = cheerio.load(prevContent);
                const prevFundName = $prev('a[title]').first().attr('title') || fundName;
                
                $prev('.box').first().find('table tbody tr').each((i, row) => {
                    if (holdings.length >= 10) return false;
                    
                    const cols = $prev(row).find('td');
                    if (cols.length >= 5) {
                        const stockCode = $prev(cols[1]).text().trim();
                        const stockName = $prev(cols[2]).text().trim();
                        const ratioText = $prev(cols[4]).text().trim().replace('%', '');
                        const ratio = parseFloat(ratioText);
                        
                        if (stockCode && stockName && !isNaN(ratio)) {
                            holdings.push({
                                code: stockCode,
                                name: stockName,
                                ratio: ratio
                            });
                        }
                    }
                });
                
                holdingDate = $prev('.box').first().find('.right.lab2 font, .right font').text().trim();
            }
        }
        
        if (holdings.length === 0) {
            console.log('[警告] 未能解析出持仓数据');
            return res.json({
                code,
                name: fundName,
                holdings: [],
                error: '该基金暂无持仓数据'
            });
        }
        
        console.log(`[成功] 获取到 ${holdings.length} 只重仓股，持仓日期: ${holdingDate}`);
        
        res.json({
            code,
            name: fundName,
            holdings,
            date: holdingDate
        });
        
    } catch (error) {
        console.error('[错误] 获取持仓失败:', error.message);
        res.json({ 
            code: req.params.code,
            name: `基金${req.params.code}`,
            holdings: [],
            error: `获取失败: ${error.message}`
        });
    }
});

// 获取股票实时行情
app.get('/api/stock/price/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const market = code.startsWith('6') || code.startsWith('5') ? 'sh' : 'sz';
        const fullCode = `${market}${code}`;
        
        const response = await axios.get(`https://hq.sinajs.cn/list=${fullCode}`, {
            headers: {
                'Referer': 'https://finance.sina.com.cn'
            },
            timeout: 5000,
            responseType: 'arraybuffer'
        });
        
        // 将GBK编码转换为UTF-8
        const responseText = iconv.decode(Buffer.from(response.data), 'gbk');
        
        const dataMatch = responseText.match(/="([^"]+)"/);
        if (!dataMatch) {
            return res.json({ code, change: 0 });
        }
        
        const data = dataMatch[1].split(',');
        if (data.length < 4) {
            return res.json({ code, change: 0 });
        }
        
        const currentPrice = parseFloat(data[3]);
        const prevClose = parseFloat(data[2]);
        const change = ((currentPrice - prevClose) / prevClose) * 100;
        
        res.json({ 
            code,
            currentPrice,
            prevClose,
            change: isNaN(change) ? 0 : change
        });
    } catch (error) {
        console.error(`[错误] 获取股价失败 ${req.params.code}:`, error.message);
        res.json({ code: req.params.code, change: 0 });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  基金估值代理服务器已启动`);
    console.log(`  运行在 http://localhost:${PORT}`);
    console.log(`  自动获取最新季度持仓数据`);
    console.log(`========================================\n`);
});

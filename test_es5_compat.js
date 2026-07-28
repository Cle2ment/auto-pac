#!/usr/bin/env node

/**
 * ES5 / JScript 5.8 兼容性检查
 *
 * Windows 系统级 PAC 求值（WinHTTP AutoProxy，Windows 10 为 JScript 5.8）
 * 仅支持 ES3 + JSON，不支持 let/const/箭头函数等 ES6+ 语法，也不存在
 * Map/Set/Promise 等全局对象与 Array.prototype.map/forEach 等 ES5 数组扩展。
 * 此脚本作为 CI 门禁，防止 pac-template 引入不兼容语法后回归。
 *
 * 用法: node test_es5_compat.js   (依赖: npm install acorn --no-save)
 */

const fs = require('fs');
const path = require('path');

let acorn;
try {
    acorn = require('acorn');
} catch (e) {
    console.error('❌ 缺少依赖 acorn，请先运行: npm install acorn --no-save --no-package-lock');
    process.exit(1);
}

const pacFilePath = path.join(__dirname, 'cardo.pac');
const source = fs.readFileSync(pacFilePath, 'utf8');

let failed = false;

// 1) ES5 语法解析（捕获 let/const/箭头函数/class/模板字符串/展开/解构等）
try {
    acorn.parse(source, { ecmaVersion: 5 });
    console.log('✅ ES5 语法解析通过');
} catch (e) {
    failed = true;
    console.error(`❌ ES5 语法解析失败: ${e.message}`);
}

// 2) 禁用标识符扫描（ES6+ 全局对象 / JScript 5.8 缺失的方法）
// 先剥掉行注释降低误报（本文件字符串字面量中不含 //，剥离是安全的）
const stripped = source.replace(/\/\/[^\n]*/g, '');

const bannedPatterns = [
    { re: /\bnew\s+(Map|Set|WeakMap|WeakSet|Promise|Proxy|Symbol|Reflect)\b/g, label: 'ES6+ 全局构造器' },
    { re: /\b(Array\.from|Array\.of|Array\.isArray|Object\.assign|Object\.keys|Object\.create|Object\.freeze|Object\.defineProperties)\b/g, label: 'JScript 5.8 缺失的静态方法' },
    // 注意: indexOf/lastIndexOf 不在此列 —— String.prototype 版本是 ES3，模板中只用于字符串
    { re: /\.(map|forEach|filter|reduce|reduceRight|every|some|find|findIndex|includes|trim|trimStart|trimEnd|startsWith|endsWith|padStart|padEnd|repeat|flat|flatMap)\s*\(/g, label: 'JScript 5.8 缺失的实例方法' },
];

for (const { re, label } of bannedPatterns) {
    let m;
    while ((m = re.exec(stripped)) !== null) {
        failed = true;
        const line = stripped.slice(0, m.index).split('\n').length;
        console.error(`❌ ${label}: 第 ${line} 行 — ${m[0]}`);
    }
}

if (failed) {
    console.error('\n兼容性检查未通过：cardo.pac 必须保持 JScript 5.8（ES3+JSON）可执行');
    process.exit(1);
}
console.log('✅ 无禁用标识符，JScript 5.8 兼容');

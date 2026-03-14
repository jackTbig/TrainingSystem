import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = 'http://localhost:5173'
const DIR = path.join(process.cwd(), 'test-results')
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR)

const results = []

async function login(page) {
  await page.goto(`${BASE}/login`)
  await page.waitForSelector('input[type="text"], input[placeholder*="用户名"]', { timeout: 10000 })
  await page.fill('input[type="text"], input[placeholder*="用户名"]', 'admin')
  await page.fill('input[type="password"]', 'Admin@123')
  await page.click('button[type="submit"], button.ant-btn-primary')
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 })
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(DIR, `${name}.png`), fullPage: true })
}

async function test(page, name, url, checks) {
  const r = { name, url, passed: [], failed: [], errors: [] }
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(800)
    await shot(page, name)

    for (const [desc, fn] of checks) {
      try {
        await fn(page)
        r.passed.push(desc)
      } catch (e) {
        r.failed.push(`${desc}: ${e.message.split('\n')[0]}`)
      }
    }
  } catch (e) {
    r.errors.push(e.message.split('\n')[0])
    try { await shot(page, `${name}-error`) } catch {}
  }
  results.push(r)
  const status = r.errors.length ? '💥' : r.failed.length ? '⚠️ ' : '✅'
  console.log(`${status} ${name}`)
  if (r.failed.length) r.failed.forEach(f => console.log(`     ✗ ${f}`))
  if (r.errors.length) r.errors.forEach(e => console.log(`     💥 ${e}`))
}

async function tryClick(page, selector, timeout = 5000) {
  if (selector.includes(':has-text') || selector.includes(':has(')) {
    // Playwright-specific selector — use locator with force
    await page.locator(selector).last().click({ timeout, force: true })
  } else {
    // Native CSS — JS click bypasses Playwright actionability checks
    const count = await page.evaluate((sel) => document.querySelectorAll(sel).length, selector)
    if (count === 0) throw new Error(`No elements found for: ${selector}`)
    await page.evaluate((sel) => {
      const els = document.querySelectorAll(sel)
      els[els.length - 1].click()
    }, selector)
  }
}

async function hasText(page, text) {
  await page.locator(`text=${text}`).first().waitFor({ timeout: 5000 })
}

async function hasSelector(page, sel) {
  await page.locator(sel).first().waitFor({ timeout: 5000 })
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  console.log('🔐 Logging in...')
  try {
    await login(page)
    console.log('✅ Login OK\n')
  } catch (e) {
    console.error('❌ Login failed:', e.message)
    await browser.close(); process.exit(1)
  }

  // ── 首页 ──────────────────────────────────────────────
  await test(page, '01-dashboard', '/dashboard', [
    ['显示欢迎标题', p => hasText(p, '欢迎回来')],
    ['显示活跃用户卡片', p => hasText(p, '活跃用户')],
    ['显示文档总数卡片', p => hasText(p, '文档总数')],
    ['显示知识点卡片', p => hasText(p, '知识点')],
    ['显示题目数量卡片', p => hasText(p, '题目数量')],
  ])

  // ── 系统管理 ──────────────────────────────────────────
  await test(page, '02-users', '/system/users', [
    ['页面标题"用户管理"', p => hasText(p, '用户管理')],
    ['显示用户列表', p => hasSelector(p, '.ant-table')],
    ['显示admin用户', p => hasText(p, 'admin')],
    ['新建用户按钮', p => hasSelector(p, 'button.ant-btn-primary')],
    ['点击新建用户弹出Modal', async p => {
      await tryClick(p, 'button.ant-btn-primary')
      await page.waitForTimeout(500)
      await hasSelector(p, '.ant-modal-content')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }],
  ])

  await test(page, '03-roles', '/system/roles', [
    ['页面标题"角色权限"', p => hasText(p, '角色权限')],
    ['显示角色列表', p => hasSelector(p, '.ant-table')],
    ['显示admin角色', p => hasSelector(p, '.ant-table-row')],
    ['新建角色按钮', p => hasSelector(p, 'button.ant-btn-primary')],
    ['点击权限按钮打开抽屉', async p => {
      await page.locator('.ant-table-row').first().waitFor({ timeout: 5000 })
      // Find the non-disabled 权限 button (admin role button is disabled)
      await p.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.ant-table-row button'))
        const btn = btns.find(b => b.textContent.includes('权限') && !b.disabled)
        if (!btn) throw new Error('No enabled 权限 button found')
        btn.click()
      })
      await hasText(p, '配置权限')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }],
  ])

  await test(page, '04-departments', '/system/departments', [
    ['页面标题"部门管理"', p => hasText(p, '部门管理')],
    ['显示部门树区域', p => hasText(p, '部门树')],
    ['新建部门按钮', p => hasSelector(p, 'button.ant-btn-primary')],
    ['点击新建部门弹出Modal', async p => {
      await tryClick(p, 'button.ant-btn-primary')
      await page.waitForTimeout(500)
      await hasSelector(p, '.ant-modal-content')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }],
  ])

  // ── 知识库 ────────────────────────────────────────────
  await test(page, '05-documents', '/documents', [
    ['页面标题"文档管理"', p => hasText(p, '文档管理')],
    ['显示文件表格', p => hasSelector(p, '.ant-table')],
    ['上传按钮存在', p => hasSelector(p, 'button.ant-btn-primary')],
    ['点击上传按钮弹出Modal', async p => {
      await tryClick(p, 'button.ant-btn-primary')
      await page.waitForTimeout(500)
      await hasSelector(p, '.ant-modal-content')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }],
  ])

  await test(page, '06-knowledge-candidates', '/knowledge-points/candidates', [
    ['页面标题"候选知识点"', p => hasText(p, '候选知识点')],
    ['显示内容区域', p => hasSelector(p, '.ant-collapse, .ant-empty, .ant-spin')],
    ['状态筛选器', p => hasText(p, '待审核')],
  ])

  await test(page, '07-knowledge-points', '/knowledge-points', [
    ['页面标题"知识点管理"', p => hasText(p, '知识点管理')],
    ['显示知识点树或空状态', p => hasSelector(p, '.ant-tree, .ant-empty, h4')],
    ['新建顶级分类按钮', p => hasSelector(p, 'button.ant-btn-primary')],
    ['点击新建分类弹出Modal', async p => {
      await tryClick(p, 'button.ant-btn-primary')
      await page.waitForTimeout(500)
      await hasSelector(p, '.ant-modal-content')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }],
  ])

  // ── 内容生产 ──────────────────────────────────────────
  await test(page, '08-courses', '/courses', [
    ['页面标题"课程管理"', p => hasText(p, '课程管理')],
    ['显示课程列表', p => hasSelector(p, '.ant-table')],
    ['新建课程按钮', p => hasSelector(p, 'button.ant-btn-primary')],
    ['点击新建课程弹出Modal', async p => {
      await tryClick(p, 'button.ant-btn-primary')
      await page.waitForTimeout(500)
      await hasSelector(p, '.ant-modal-content')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }],
  ])

  await test(page, '09-questions', '/questions', [
    ['页面标题"题库管理"', p => hasText(p, '题库管理')],
    ['显示题目列表', p => hasSelector(p, '.ant-table')],
    ['显示题目数据', p => hasSelector(p, '.ant-table-row')],
    ['新建题目按钮', p => hasSelector(p, 'button.ant-btn-primary')],
    ['点击新建题目弹出Modal', async p => {
      await tryClick(p, 'button.ant-btn-primary')
      await page.waitForTimeout(500)
      await hasSelector(p, '.ant-modal-content')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }],
    ['点击AI生成弹出Modal', async p => {
      await p.reload({ waitUntil: 'networkidle', timeout: 10000 })
      await p.waitForTimeout(500)
      await p.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('AI'))
        if (!btn) throw new Error('AI button not found')
        btn.click()
      })
      await p.waitForTimeout(800)
      await hasSelector(p, '.ant-modal-content')
      await p.keyboard.press('Escape')
      await p.waitForTimeout(300)
    }],
  ])

  await test(page, '10-reviews', '/reviews', [
    ['页面标题"审核任务"', p => hasText(p, '审核任务')],
    ['显示表格', p => hasSelector(p, '.ant-table')],
    ['存在筛选器', p => hasSelector(p, '.ant-select')],
  ])

  await test(page, '11-publish-records', '/publish-records', [
    ['页面标题"发布记录"', p => hasText(p, '发布记录')],
    ['显示表格', p => hasSelector(p, '.ant-table')],
    ['状态筛选器', p => hasSelector(p, '.ant-select')],
  ])

  // ── 培训考试 ──────────────────────────────────────────
  await test(page, '12-training-tasks', '/training-tasks', [
    ['页面标题"培训任务"', p => hasText(p, '培训任务')],
    ['显示任务列表', p => hasSelector(p, '.ant-table')],
    ['新建任务按钮', p => hasSelector(p, 'button.ant-btn-primary')],
    ['点击新建任务弹出Modal', async p => {
      await tryClick(p, 'button.ant-btn-primary')
      await page.waitForTimeout(500)
      await hasSelector(p, '.ant-modal-content')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }],
  ])

  await test(page, '13-exams', '/exams', [
    ['页面标题"考试管理"', p => hasText(p, '考试管理')],
    ['显示考试列表', p => hasSelector(p, '.ant-table')],
    ['新建考试按钮', p => hasSelector(p, 'button.ant-btn-primary')],
    ['点击新建考试弹出Modal', async p => {
      await tryClick(p, 'button.ant-btn-primary')
      await page.waitForTimeout(500)
      await hasSelector(p, '.ant-modal-content')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }],
  ])

  await test(page, '14-my-exams', '/my-exams', [
    ['页面标题"我的考试"', p => hasText(p, '我的考试')],
    ['页面可正常加载', p => hasSelector(p, 'h4, .ant-empty, .ant-card')],
  ])

  await test(page, '15-my-training', '/my-training', [
    ['页面标题"我的培训"', p => hasText(p, '我的培训')],
    ['页面可正常加载', p => hasSelector(p, 'h4, .ant-empty, .ant-card')],
  ])

  // ── 系统审计 ──────────────────────────────────────────
  await test(page, '16-async-jobs', '/async-jobs', [
    ['页面标题"异步任务"', p => hasText(p, '异步任务')],
    ['显示表格', p => hasSelector(p, '.ant-table')],
    ['状态筛选器', p => hasText(p, '状态')],
    ['任务类型筛选器', p => hasText(p, '任务类型')],
  ])

  await test(page, '17-audit-logs', '/audit-logs', [
    ['页面标题"审计日志"', p => hasText(p, '审计日志')],
    ['显示表格', p => hasSelector(p, '.ant-table')],
    ['关键词搜索框', p => hasSelector(p, 'input[placeholder*="操作"]')],
    ['资源类型筛选器', p => hasText(p, '资源类型')],
  ])

  await browser.close()

  // ── 报告 ──────────────────────────────────────────────
  console.log('\n' + '='.repeat(50))
  console.log('TEST REPORT')
  console.log('='.repeat(50))
  const total = results.reduce((s, r) => s + r.passed.length + r.failed.length, 0)
  const passed = results.reduce((s, r) => s + r.passed.length, 0)
  const failed = results.reduce((s, r) => s + r.failed.length, 0)
  const errored = results.filter(r => r.errors.length).length
  console.log(`Pages: ${results.length} | Checks: ${total} | Passed: ${passed} | Failed: ${failed} | Page errors: ${errored}`)
  console.log(`Screenshots: ${DIR}`)

  if (failed > 0 || errored > 0) {
    console.log('\nFailed details:')
    results.filter(r => r.failed.length || r.errors.length).forEach(r => {
      console.log(`  [${r.name}]`)
      r.failed.forEach(f => console.log(`    ✗ ${f}`))
      r.errors.forEach(e => console.log(`    💥 ${e}`))
    })
  }

  process.exit(failed > 0 || errored > 0 ? 1 : 0)
})()

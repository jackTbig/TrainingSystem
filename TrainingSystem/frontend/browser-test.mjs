/**
 * Playwright UI Browser Test
 * Tests: Users-Roles, Departments-Users, Exams paper assignment, MyExams start exam
 */
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const API  = 'http://localhost:8000/api/v1'
let pass = 0, fail = 0
const failures = []

function check(name, ok, detail = '') {
  if (ok) { console.log(`  ✓ ${name}`); pass++ }
  else     { console.log(`  ✗ ${name}  [${detail}]`); fail++; failures.push(`${name}: ${detail}`) }
}

async function login(page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[placeholder*="用户名"], input[name="username"]', 'admin')
  await page.fill('input[type="password"]', 'Admin@123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 8000 })
}

async function section(name) {
  console.log(`\n${'='.repeat(55)}\n  ${name}\n${'='.repeat(55)}`)
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(10000)

  // suppress console noise
  page.on('console', () => {})
  page.on('pageerror', () => {})

  try {
    // ── 1. Login ────────────────────────────────────────────────
    await section('1. 登录')
    await login(page)
    check('成功跳转到 dashboard', page.url().includes('dashboard'))

    // ── 2. Users → Assign Roles ─────────────────────────────────
    await section('2. 用户管理 — 分配角色')
    await page.goto(`${BASE}/system/users`)
    await page.waitForSelector('table tbody tr', { timeout: 8000 })
    const userRows = await page.$$('table tbody tr')
    check('用户列表有数据', userRows.length > 0, `${userRows.length}行`)

    // Find "分配角色" button in first row
    const roleBtn = await page.$('table tbody tr:first-child button:has-text("分配角色")')
    check('分配角色按钮存在', !!roleBtn)
    if (roleBtn) {
      await roleBtn.click()
      await page.waitForSelector('.ant-drawer-content', { timeout: 5000 })
      check('角色抽屉打开', await page.isVisible('.ant-drawer-content'))

      // Check if roles are listed
      const checkboxes = await page.$$('.ant-drawer-content .ant-checkbox-wrapper')
      check('角色列表显示', checkboxes.length > 0, `${checkboxes.length}个角色`)

      // Check first role if unchecked
      if (checkboxes.length > 0) {
        const isChecked = await checkboxes[0].evaluate(el => el.querySelector('input')?.checked)
        if (!isChecked) await checkboxes[0].click()
        // Save — the button is in ant-drawer-header-extra
        const saveBtn = await page.$('.ant-drawer-header-extra button, .ant-drawer-extra button, button:has-text("保存")')
        if (saveBtn) {
          await saveBtn.click()
          await page.waitForTimeout(1500)
          check('角色保存成功', !(await page.isVisible('.ant-drawer-content')))
        } else {
          await page.keyboard.press('Escape')
          check('角色保存成功', false, '未找到保存按钮')
        }
      }
    }

    // ── 3. Departments → Members ─────────────────────────────────
    await section('3. 部门管理 — 成员管理')
    await page.goto(`${BASE}/system/departments`)
    await page.waitForSelector('.ant-tree', { timeout: 8000 })
    check('部门树显示', await page.isVisible('.ant-tree'))

    // Wait for tree items to fully render (non-aria-hidden ones)
    await page.waitForTimeout(500)
    const deptNodes = await page.$$('.ant-tree-node-content-wrapper')
    check('部门树有节点', deptNodes.length > 0, `${deptNodes.length}个节点`)
    if (deptNodes.length > 0) {
      // Click using bounding box coordinates to reliably trigger React events
      const box = await deptNodes[0].boundingBox()
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      } else {
        await deptNodes[0].click({ force: true })
      }
      await page.waitForTimeout(1500)
      // Drawer opens automatically on node click
      const drawerVisible = await page.isVisible('.ant-drawer-open, .ant-drawer-content-wrapper')
      check('点击部门节点打开成员管理抽屉', drawerVisible)
      if (drawerVisible) {
        const memberTable = await page.$('.ant-drawer .ant-table')
        check('成员管理抽屉含表格', !!memberTable)
        const addBtn = await page.$('.ant-drawer button:has-text("添加"), .ant-drawer .ant-btn-primary')
        check('添加成员按钮存在', !!addBtn)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      }
    }

    // ── 4. Exams → Assign Paper ──────────────────────────────────
    await section('4. 考试管理 — 关联试卷')
    await page.goto(`${BASE}/exams`)
    await page.waitForSelector('table', { timeout: 8000 })
    await page.waitForTimeout(1000)

    // Check for "关联试卷" buttons (published exams without paper)
    const assignBtns = await page.$$('button:has-text("关联试卷")')
    check('有待关联试卷的考试', assignBtns.length > 0, `${assignBtns.length}个`)

    if (assignBtns.length > 0) {
      await assignBtns[0].click()
      await page.waitForSelector('.ant-modal', { timeout: 5000 })
      check('关联试卷弹窗打开', await page.isVisible('.ant-modal'))

      // Check paper select exists
      const paperSelect = await page.$('.ant-modal .ant-select')
      check('试卷选择框存在', !!paperSelect)

      if (paperSelect) {
        await paperSelect.click()
        await page.waitForSelector('.ant-select-dropdown', { timeout: 3000 })
        const options = await page.$$('.ant-select-item-option')
        check('试卷选项存在', options.length > 0, `${options.length}个选项`)

        if (options.length > 0) {
          await options[0].click()
          await page.waitForTimeout(300)
          await page.click('.ant-modal-confirm-btns .ant-btn-primary')
          await page.waitForTimeout(1500)
          // Verify no more modal
          const modalGone = !(await page.isVisible('.ant-modal'))
          check('试卷关联成功', modalGone)
        }
      } else {
        await page.keyboard.press('Escape')
      }
    }

    // ── 5. MyExams → Start Exam ──────────────────────────────────
    await section('5. 我的考试 — 开始考试')
    await page.goto(`${BASE}/my-exams`)
    await page.waitForSelector('.ant-card, [class*="empty"]', { timeout: 8000 })
    await page.waitForTimeout(1000)

    const examCards = await page.$$('.ant-card')
    check('我的考试列表有内容', examCards.length > 0, `${examCards.length}张卡片`)

    // Find an exam card with "开始考试" or "继续作答" button
    const startBtn = await page.$('.ant-card button:has-text("开始考试"), .ant-card button:has-text("继续作答")')
    check('"开始考试"或"继续作答"按钮存在', !!startBtn)

    if (startBtn) {
      const btnText = await startBtn.textContent()
      await startBtn.click()
      await page.waitForTimeout(2000)

      const currentUrl = page.url()
      const wentToExam = currentUrl.includes('/exam/') && currentUrl.includes('/take/')
      const hasError = await page.isVisible('.ant-message-error, [class*="ant-result-error"]')
      const hasNoPaper = await page.isVisible('text=未关联试卷')
        || (await page.textContent('body').catch(() => '')).includes('未关联试卷')
        || (await page.textContent('body').catch(() => '')).includes('尚未关联试卷')

      if (wentToExam) {
        check(`点击"${btnText?.trim()}"→ 进入考试页面`, true)
        // Verify paper loaded
        await page.waitForTimeout(1000)
        const paperLoaded = await page.isVisible('.ant-card:has-text("第 1 题")')
          || await page.isVisible('text=第 1 题')
          || await page.isVisible('[class*="Result"]')
        check('试卷加载（题目或错误页）', paperLoaded || await page.isVisible('.ant-result'))
        await page.goBack()
      } else if (hasNoPaper || hasError) {
        // Error shown in place — that's the correct behavior now
        check(`点击"${btnText?.trim()}"→ 显示未关联试卷错误（正确）`, true)
      } else {
        check(`点击"${btnText?.trim()}"→ 进入考试页面`, false, `当前URL: ${currentUrl}`)
      }
    }

    // ── 6. MyExams — Exam with paper works ──────────────────────
    await section('6. 有试卷的考试可以正常开始')
    // The 消防安全知识考试 should have a paper
    await page.goto(`${BASE}/my-exams`)
    await page.waitForTimeout(1500)
    const allStartBtns = await page.$$('.ant-card .ant-btn-primary:has-text("开始考试"), .ant-card .ant-btn-primary:has-text("继续作答")')
    let foundWorkingExam = false
    for (const btn of allStartBtns) {
      const cardTitle = await btn.evaluate(el => {
        const card = el.closest('.ant-card')
        return card?.querySelector('.ant-card-head-title')?.textContent || ''
      })
      await btn.click()
      await page.waitForTimeout(2000)
      if (page.url().includes('/exam/') && page.url().includes('/take/')) {
        // verify questions loaded
        const body = await page.textContent('body').catch(() => '')
        if (body.includes('第 1 题') || body.includes('总分')) {
          check(`「${cardTitle}」考试页面正常加载`, true)
          foundWorkingExam = true
          await page.goBack()
          break
        }
        const hasResultError = await page.isVisible('.ant-result-error')
        if (hasResultError) {
          check(`「${cardTitle}」无试卷错误页显示`, true)
          await page.click('button:has-text("返回我的考试")')
        } else {
          await page.goBack()
        }
      } else {
        // Error msg shown
        await page.goto(`${BASE}/my-exams`)
        await page.waitForTimeout(800)
      }
    }
    if (!foundWorkingExam && allStartBtns.length > 0) {
      check('至少一场考试可正常进入答题页', false, '所有考试均无试卷')
    }

  } catch (err) {
    console.error('Test error:', err.message)
    failures.push(`Exception: ${err.message}`)
    fail++
  } finally {
    await browser.close()
    console.log(`\n${'='.repeat(55)}`)
    console.log(`  测试结果: ${pass}/${pass + fail} 通过  (${fail} 失败)`)
    console.log(`${'='.repeat(55)}`)
    if (failures.length) {
      console.log('\n失败项目:')
      failures.forEach(f => console.log(`  ✗ ${f}`))
    }
    process.exit(fail > 0 ? 1 : 0)
  }
})()

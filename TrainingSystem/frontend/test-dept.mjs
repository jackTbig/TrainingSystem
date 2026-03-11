import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
let pass = 0, fail = 0

const ok = (n, v, d = '') => {
  if (v) { console.log('  ✓', n); pass++ }
  else { console.log('  ✗', n, d ? '[' + d + ']' : ''); fail++ }
}

const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
p.setDefaultTimeout(12000)
p.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) console.log('ERR:', m.text().slice(0, 100)) })

async function goToDepts() {
  await p.goto(`${BASE}/system/departments`)
  await p.waitForSelector('.ant-tree', { timeout: 8000 })
  await p.waitForTimeout(600)
}

// Login
await p.goto(`${BASE}/login`)
await p.fill('input[placeholder*="用户名"]', 'admin')
await p.fill('input[type="password"]', 'Admin@123')
await p.click('button[type="submit"]')
await p.waitForURL('**/dashboard', { timeout: 8000 })

// ── Test 1: Tree renders ─────────────────────────────────────
await goToDepts()
ok('部门树显示', await p.isVisible('.ant-tree'))
const nodes = await p.$$('.ant-tree-node-content-wrapper')
ok('有部门节点', nodes.length > 0, nodes.length + '个')

// ── Test 2: Hover shows action buttons ───────────────────────
await goToDepts()
const node0 = (await p.$$('.ant-tree-node-content-wrapper'))[0]
if (node0) {
  await node0.hover()
  await p.waitForTimeout(500)
  ok('悬停显示编辑按钮', await p.isVisible('[title="编辑部门名称"]'))
  ok('悬停显示添加子部门按钮', await p.isVisible('[title="添加子部门"]'))
  ok('悬停显示删除按钮', await p.isVisible('[title="删除部门"]'))
}

// ── Test 3: Edit modal ───────────────────────────────────────
await goToDepts()
const n3 = (await p.$$('.ant-tree-node-content-wrapper'))[0]
await n3?.hover()
await p.waitForTimeout(400)
const editBtn = await p.$('[title="编辑部门名称"]')
if (editBtn) {
  await editBtn.click()
  await p.waitForTimeout(500)
  ok('编辑弹窗打开', await p.isVisible('.ant-modal'))
  const hasInput = await p.isVisible('.ant-modal input[id="name"]')
  ok('编辑弹窗含名称输入框', hasInput)
}

// ── Test 4: Add child modal ──────────────────────────────────
await goToDepts()
const n4 = (await p.$$('.ant-tree-node-content-wrapper'))[0]
await n4?.hover()
await p.waitForTimeout(400)
const addBtn = await p.$('[title="添加子部门"]')
if (addBtn) {
  await addBtn.click()
  await p.waitForTimeout(500)
  ok('新建子部门弹窗打开', await p.isVisible('.ant-modal'))
  const title = await p.textContent('.ant-modal-title').catch(() => '')
  ok('弹窗标题含"子部门"', title.includes('子部门'), title)
}

// ── Test 5: Delete popconfirm ────────────────────────────────
await goToDepts()
const n5 = (await p.$$('.ant-tree-node-content-wrapper'))[3] // last node (least likely to have children)
await n5?.hover()
await p.waitForTimeout(400)
const delBtn = await p.$('[title="删除部门"]')
if (delBtn) {
  await delBtn.click()
  await p.waitForTimeout(500)
  ok('删除确认框弹出', await p.isVisible('.ant-popconfirm, .ant-popover'))
}

// ── Test 6: Click node → members drawer ─────────────────────
await goToDepts()
const n6 = (await p.$$('.ant-tree-node-content-wrapper'))[0]
await n6?.click()
await p.waitForTimeout(1500)
ok('点击节点打开成员抽屉', await p.isVisible('.ant-drawer'))
if (await p.isVisible('.ant-drawer')) {
  ok('成员表格存在', await p.isVisible('.ant-drawer .ant-table'))
  ok('添加成员按钮存在', await p.isVisible('.ant-drawer button:has-text("添加成员")'))
}

// ── Test 7: Top-level create ────────────────────────────────
await goToDepts()
const createBtn = await p.$('button:has-text("新建顶级部门")')
ok('新建顶级部门按钮存在', !!createBtn)
if (createBtn) {
  await createBtn.click()
  await p.waitForTimeout(500)
  ok('新建顶级部门弹窗打开', await p.isVisible('.ant-modal'))
}

// ── Test 8: Create + Edit + Delete flow ─────────────────────
await goToDepts()
// Create a test department
await (await p.$('button:has-text("新建顶级部门")')).click()
await p.waitForSelector('.ant-modal input', { timeout: 5000 })
await p.waitForTimeout(400)
await p.fill('.ant-modal input', '自动化测试部门_临时')
await p.waitForTimeout(300)
// Try submit via button or Enter key
const createBtnEl = await p.$('.ant-modal button[type="submit"], .ant-modal .ant-btn-primary')
if (createBtnEl) {
  await createBtnEl.click()
} else {
  await p.keyboard.press('Enter')
}
await p.waitForTimeout(1500)
ok('新建部门成功', !(await p.isVisible('.ant-modal')))

// Find and edit the new dept
await goToDepts()
const allNodes = await p.$$('.ant-tree-node-content-wrapper')
let newDeptNode = null
for (const nd of allNodes) {
  const txt = await nd.textContent()
  if (txt?.includes('自动化测试部门_临时')) { newDeptNode = nd; break }
}
ok('新建部门出现在树中', !!newDeptNode)

if (newDeptNode) {
  await newDeptNode.hover()
  await p.waitForTimeout(400)
  const editBtn2 = await p.$('[title="编辑部门名称"]')
  if (editBtn2) {
    await editBtn2.click()
    await p.waitForSelector('.ant-modal input[id="name"]', { timeout: 5000 })
    await p.waitForTimeout(300)
    await p.fill('.ant-modal input[id="name"]', '自动化测试部门_已改名')
    await p.waitForTimeout(300)
    const saveBtnEl = await p.$('.ant-modal button[type="submit"], .ant-modal .ant-btn-primary')
    if (saveBtnEl) await saveBtnEl.click()
    else await p.keyboard.press('Enter')
    await p.waitForTimeout(1500)
    ok('编辑部门名称成功', !(await p.isVisible('.ant-modal')))
  }

  // Delete it
  await goToDepts()
  const nodes2 = await p.$$('.ant-tree-node-content-wrapper')
  let renamedNode = null
  for (const nd of nodes2) {
    const txt = await nd.textContent()
    if (txt?.includes('自动化测试部门_已改名')) { renamedNode = nd; break }
  }
  ok('改名后部门出现在树中', !!renamedNode)

  if (renamedNode) {
    await renamedNode.hover()
    await p.waitForTimeout(400)
    const delBtn2 = await p.$('[title="删除部门"]')
    if (delBtn2) {
      await delBtn2.click()
      await p.waitForTimeout(500)
      // Click confirm in popconfirm
      const confirmBtn = await p.$('.ant-popconfirm .ant-btn-primary, .ant-popover .ant-btn-primary')
      if (confirmBtn) {
        await confirmBtn.click()
        await p.waitForTimeout(1000)
        ok('删除部门成功', !(await p.isVisible('.ant-popconfirm')))
      }
    }
  }
}

console.log(`\n结果: ${pass}/${pass + fail} 通过, ${fail} 失败`)
await b.close()
process.exit(fail > 0 ? 1 : 0)

import { test, expect, type Page } from '@playwright/test'
import { signIn, ALL_PERMISSIONS } from '../fixtures/auth'

test.describe.configure({ timeout: 60000 })

const PERMISSIONS = [...ALL_PERMISSIONS, 'masterdata.access', 'masterdata.bcp_scenario.view', 'masterdata.bcp_scenario.manage']

function master() {
  return {
    version: 'V2',
    conditions: [
      { code: 'k1_main_site', title: 'Kondisi 1: Ruang kerja utama tidak dapat diakses', active: true },
      { code: 'k3_staff_shortage', title: 'Kondisi 3: Kekurangan karyawan', active: true },
    ],
    scenarios: [
      {
        code: 'k1_alternate_site', name: 'Menggunakan lokasi kerja alternatif', condition_code: 'k1_main_site', description: '', active: true,
        procedures: [{ code: 'relocate', name: 'Pindah ke lokasi kerja alternatif', procedure: '- Pindah', form: '', pic: 'Ketua RTF', notes: '', active: true }],
      },
      {
        code: 'k3_staff_shortage', name: 'Kekurangan karyawan', condition_code: 'k3_staff_shortage', description: '', active: true,
        procedures: [{ code: 'report', name: 'Lapor', procedure: '- Laporkan ke IMT', form: '', pic: 'Ketua RTF', notes: '', active: true }],
      },
    ],
  }
}

async function mockMaster(page: Page) {
  await signIn(page, { permissions: PERMISSIONS })
  const puts: unknown[] = []
  let body = master()
  await page.route('**/api/masterdata/bcp-scenarios', async (route) => {
    if (route.request().method() === 'PUT') {
      const sent = route.request().postDataJSON() as { scenarios: ReturnType<typeof master>['scenarios'] }
      puts.push(sent)
      body = { ...body, scenarios: sent.scenarios }
    }
    return route.fulfill({ json: body })
  })
  return puts
}

test('shows scenarios by condition', async ({ page }) => {
  await mockMaster(page)
  await page.goto('/masterdata/bcp-scenarios?condition=k3_staff_shortage')
  await expect(page.getByRole('heading', { name: 'BCP scenario and procedure' })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('textbox', { name: 'Name of scenario Kekurangan karyawan' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name of scenario Menggunakan lokasi kerja alternatif' })).toHaveCount(0)
})

test('adds a procedure and saves', async ({ page }) => {
  const puts = await mockMaster(page)
  await page.goto('/masterdata/bcp-scenarios?condition=k3_staff_shortage')
  await page.getByRole('button', { name: 'Add procedure to Kekurangan karyawan' }).click({ timeout: 30000 })
  await page.getByRole('textbox', { name: 'Name of procedure 2 of Kekurangan karyawan' }).fill('Fasilitasi HRBP')
  await page.getByRole('textbox', { name: 'Procedure 2 of Kekurangan karyawan', exact: true }).fill('- Fasilitasi penambahan karyawan')
  await page.getByRole('textbox', { name: 'PIC of procedure 2 of Kekurangan karyawan' }).fill('IMT / Group Head')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Scenarios saved', { exact: true })).toBeVisible()
  const sent = puts.at(-1) as { scenarios: { code: string, procedures: { name: string, pic: string }[] }[] }
  const staff = sent.scenarios.find((row) => row.code === 'k3_staff_shortage')!
  expect(staff.procedures.at(-1)).toMatchObject({ name: 'Fasilitasi HRBP', pic: 'IMT / Group Head' })
})

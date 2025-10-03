import * as core from '@actions/core'
import {
  getLiveThemeID,
  waitForThemeToBeReady,
  duplicateWithThemeIDUsingCLI,
  generateThemeNameForEnv,
  getPositiveNumberInput,
  ensureThemeExists,
  normalizeThemeId
} from './utils'

async function run(): Promise<void> {
  try {
    const store: string = core.getInput('store', {
      required: true,
      trimWhitespace: true
    })

    const env: string = core.getInput('env', {
      required: true,
      trimWhitespace: true
    })

    const maxWaitMinutes = getPositiveNumberInput('max-wait-minutes', 5)
    const checkIntervalSeconds = getPositiveNumberInput(
      'check-interval-seconds',
      30
    )

    const sourceThemeIdInput = core.getInput('source-theme-id', {
      required: false,
      trimWhitespace: true
    })

    if (sourceThemeIdInput && !/^\d+$/.test(sourceThemeIdInput)) {
      throw new Error(
        'Input "source-theme-id" must be a numeric Shopify theme ID.'
      )
    }

    const themeIdToDuplicate = normalizeThemeId(
      sourceThemeIdInput || (await getLiveThemeID(store))
    )

    if (sourceThemeIdInput) {
      core.info(
        `Using provided theme ID ${themeIdToDuplicate} as duplication source.`
      )
    } else {
      core.info(
        `Using live theme ID ${themeIdToDuplicate} as duplication source.`
      )
    }

    await ensureThemeExists(store, themeIdToDuplicate)

    await waitForThemeToBeReady(store, themeIdToDuplicate, {
      maxWaitMinutes,
      checkIntervalSeconds
    })
    const themeID = await duplicateWithThemeIDUsingCLI(
      store,
      themeIdToDuplicate,
      generateThemeNameForEnv(env)
    )
    core.setOutput('themeId', themeID)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()

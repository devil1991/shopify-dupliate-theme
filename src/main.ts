import * as core from '@actions/core'
import {
  pullLiveTheme,
  cleanRemoteFiles,
  pushUnpublishedTheme,
  generateThemeNameForEnv
} from './utils'

const TEMP_FOLDER = 'duplicate'
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
    core.debug(`store: ${store}`)
    core.debug(`store: ${env}`)
    await pullLiveTheme(store, TEMP_FOLDER)
    const themeID = await pushUnpublishedTheme(
      store,
      TEMP_FOLDER,
      generateThemeNameForEnv(env)
    )
    core.setOutput('themeId', themeID)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  } finally {
    await cleanRemoteFiles(TEMP_FOLDER)
  }
}

run()

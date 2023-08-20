import * as core from '@actions/core'
import {pullLiveTheme, cleanRemoteFiles, pushUnpublishedTheme} from './utils'

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

    await pullLiveTheme(store, TEMP_FOLDER)
    const themeID = await pushUnpublishedTheme(store, TEMP_FOLDER, env)
    core.setOutput('themeId', themeID)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  } finally {
    await cleanRemoteFiles('duplicate')
  }
}

run()

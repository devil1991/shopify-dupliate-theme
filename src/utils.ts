import {debug, getInput, info} from '@actions/core'
import {ExecException, exec as nativeExec} from 'child_process'

export async function execShellCommand(cmd: string): Promise<string | Buffer> {
  return new Promise((resolve, reject) => {
    nativeExec(
      cmd,
      (error: ExecException | null, stdout: string, stderr: string) => {
        if (error) {
          return reject(error)
        }
        resolve(stdout ? stdout : stderr)
      }
    )
  })
}

export type ShopifyTheme = {
  id: number
  name: string
  processing: boolean
  createdAtRuntime: boolean
  role: 'live' | 'unpublished' | 'main' | 'development'
}

export const normalizeThemeId = (themeId: string | number): string => {
  return String(themeId).trim()
}

export function getPositiveNumberInput(
  name: string,
  defaultValue: number
): number {
  const rawValue = getInput(name, {
    required: false,
    trimWhitespace: true
  })

  const value = rawValue ? Number(rawValue) : defaultValue
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Input "${name}" must be a positive number. Received: ${rawValue}`
    )
  }

  return value
}

export const getLiveThemeID = async (store: string): Promise<string> => {
  const themes = await loadAllThemes(store)
  const liveTheme = themes.find(
    (theme: ShopifyTheme) => theme.role === 'live' || theme.role === 'main'
  )
  if (!liveTheme) {
    throw new Error('Failed to get live theme')
  }

  const liveThemeId = normalizeThemeId(liveTheme.id)
  debug(`Live theme ID: ${liveThemeId}`)
  return liveThemeId
}

export const loadAllThemes = async (store: string): Promise<ShopifyTheme[]> => {
  const response = await execShellCommand(
    `shopify theme list --store ${store} --json`
  )
  const responseString = response.toString()
  const responseJSON = JSON.parse(responseString)
  debug(`Found ${responseJSON.length} themes`)
  return responseJSON as ShopifyTheme[]
}

export const checkIfThemeIsProcessing = async (
  store: string,
  themeID: string
): Promise<boolean> => {
  const targetThemeId = normalizeThemeId(themeID)
  const themes = await loadAllThemes(store)
  const theme = themes.find(
    (_theme: ShopifyTheme) => normalizeThemeId(_theme.id) === targetThemeId
  )
  if (!theme) {
    throw new Error(`Failed to find theme with ID: ${targetThemeId}`)
  }
  return theme.processing
}

export const ensureThemeExists = async (
  store: string,
  themeID: string
): Promise<ShopifyTheme> => {
  const targetThemeId = normalizeThemeId(themeID)
  const themes = await loadAllThemes(store)
  const theme = themes.find(
    (_theme: ShopifyTheme) => normalizeThemeId(_theme.id) === targetThemeId
  )

  if (!theme) {
    throw new Error(
      `Theme with ID: ${targetThemeId} does not exist in store ${store}.`
    )
  }

  return theme
}

type WaitForThemeOptions = {
  maxWaitMinutes?: number
  checkIntervalSeconds?: number
}

export const waitForThemeToBeReady = async (
  store: string,
  themeID: string,
  options: WaitForThemeOptions = {}
): Promise<void> => {
  const {maxWaitMinutes = 5, checkIntervalSeconds = 30} = options
  if (checkIntervalSeconds <= 0) {
    throw new Error('checkIntervalSeconds must be greater than zero')
  }

  const totalSeconds = maxWaitMinutes * 60
  if (totalSeconds <= 0) {
    throw new Error('maxWaitMinutes must be greater than zero')
  }

  const maxAttempts = Math.max(
    1,
    Math.ceil(totalSeconds / checkIntervalSeconds)
  )

  info(
    `Waiting up to ${maxWaitMinutes} minute(s) for theme ${themeID} to be ready (checking every ${checkIntervalSeconds} second(s)).`
  )

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isProcessing = await checkIfThemeIsProcessing(store, themeID)
    if (!isProcessing) {
      const elapsedSeconds = (attempt - 1) * checkIntervalSeconds
      info(
        `Theme ${themeID} is ready after waiting ${elapsedSeconds} second(s).`
      )
      return
    }

    const remainingAttempts = maxAttempts - attempt
    info(
      `Theme ${themeID} still processing (attempt ${attempt}/${maxAttempts}). Next check in ${checkIntervalSeconds} second(s).${
        remainingAttempts > 0
          ? ` Remaining attempts: ${remainingAttempts}.`
          : ''
      }`
    )

    if (attempt === maxAttempts) {
      break
    }

    await new Promise(resolve =>
      setTimeout(resolve, checkIntervalSeconds * 1000)
    )
  }

  throw new Error(
    `Theme with ID: ${themeID} is still processing after ${maxWaitMinutes} minute(s).`
  )
}

export const duplicateWithThemeIDUsingCLI = async (
  store: string,
  themeID: string,
  name: string
): Promise<string> => {
  const response = await execShellCommand(
    `shopify theme duplicate --store ${store} --theme ${themeID} --name '${name}' --json`
  )
  const responseString = response.toString()
  const responseJSON = JSON.parse(responseString)
  const newThemeID = responseJSON?.theme?.id || responseJSON?.id
  if (!newThemeID) {
    debug(responseString)
    throw new Error('Failed to duplicate theme')
  }
  debug(`Created new theme with ID: ${newThemeID}`)
  return newThemeID
}

// Patterh for name: [{env}] Latest Snapshot {date is in format MM.DD.YY}
export const generateThemeNameForEnv = (env: string): string => {
  const date = new Date()
  return `[${env}] ${date
    .toLocaleDateString('en-US')
    .replace(/\//g, '.')}`.slice(0, 49)
}

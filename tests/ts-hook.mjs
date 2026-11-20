// Lets `node --test` load the app's .ts files with the extensionless imports
// TypeScript uses ("./dates" rather than "./dates.ts"). Node strips the types
// itself; it just needs help finding the file. Test-only - the app is built by
// Next and never sees this.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[mc]?[jt]sx?$/.test(specifier)) {
      for (const ext of ['.ts', '.tsx']) {
        const url = new URL(specifier + ext, context.parentURL)
        if (existsSync(fileURLToPath(url))) return next(specifier + ext, context)
      }
    }
    return next(specifier, context)
  },
})

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const componentsDir = path.resolve(scriptDir, '../src/components')
const sourceFiles = []

function collectFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectFiles(entryPath)
    else if (entry.isFile() && entry.name.endsWith('.tsx') && !entryPath.includes('__tests__')) sourceFiles.push(entryPath)
  }
}

collectFiles(componentsDir)

const rawPalettePattern = /\b(?:bg|text|border|ring)-(?:blue|red|green|yellow|zinc|gray|slate|indigo|purple|amber|orange|emerald|lime|cyan|teal|violet|rose|pink|stone|neutral)-[a-z0-9/]+/g
const buttonPattern = /<button\b[^>]*>/gs
const findings = []
let buttonCount = 0
let actionButtonCount = 0
let formControlCount = 0
let semanticFormControlCount = 0

function lineNumber(source, offset) {
  return source.slice(0, offset).split('\n').length
}

for (const filePath of sourceFiles) {
  const source = fs.readFileSync(filePath, 'utf8')
  const relativePath = path.relative(path.resolve(scriptDir, '..'), filePath).replaceAll(path.sep, '/')

  for (const match of source.matchAll(rawPalettePattern)) {
    findings.push(`${relativePath}:${lineNumber(source, match.index)} raw palette class "${match[0]}"`)
  }

  for (const match of source.matchAll(buttonPattern)) {
    const openingTag = match[0]
    buttonCount += 1
    const isActionButton = /type=["']submit["']|\b(?:Create|Save|Submit|Approve|Accept|Reject|Cancel|Delete|Remove|Assign|Allocate|Schedule|Book|Confirm|Resolve|Acknowledge|Login|Logout|Refresh|Export|Import)\b/i.test(openingTag)
    if (isActionButton) actionButtonCount += 1
    if (isActionButton && !/\bsoc-(?:btn(?:\b|-)|sidebar-)/.test(openingTag)) {
      findings.push(`${relativePath}:${lineNumber(source, match.index)} action button is missing a soc-btn variant`)
    }
  }

  const formControlPattern = /<(?:input|select|textarea)\b[^>]*>/gs
  for (const match of source.matchAll(formControlPattern)) {
    formControlCount += 1
    if (/\bsoc-field\b/.test(match[0])) semanticFormControlCount += 1
  }
}

console.log(`UI consistency audit: ${sourceFiles.length} component files scanned`)
console.log(`Controls: ${buttonCount} buttons (${actionButtonCount} action buttons), ${formControlCount} form controls (${semanticFormControlCount} use soc-field)`)
console.log(`Findings: ${findings.length}`)

if (findings.length > 0) {
  for (const finding of findings) console.log(`- ${finding}`)
  process.exitCode = 1
} else {
  console.log('No raw palette classes or unstandardized buttons found.')
}

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const sourceRoots = [
  join(process.cwd(), "app"),
  join(process.cwd(), "components"),
]

function findComponentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return findComponentFiles(entryPath)
    return entry.name.endsWith(".tsx") ? [entryPath] : []
  })
}

function findImplicitButtonTypes(filePath: string) {
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const failures: string[] = []

  function visit(node: ts.Node, insideForm = false) {
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : null
    const tagName = opening?.tagName.getText(source)
    const isInsideForm = insideForm || tagName === "form"

    if (isInsideForm && tagName === "Button") {
      const hasExplicitType = opening!.attributes.properties.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(source) === "type"
      )

      if (!hasExplicitType) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart())
        failures.push(`${filePath}:${line + 1}`)
      }
    }

    ts.forEachChild(node, (child) => visit(child, isInsideForm))
  }

  visit(source)
  return failures
}

describe("application form buttons", () => {
  it("declares submit or button behavior explicitly", () => {
    const failures = sourceRoots
      .flatMap(findComponentFiles)
      .flatMap(findImplicitButtonTypes)

    expect(failures).toEqual([])
  })
})

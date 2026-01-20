import fs from 'fs'
import path from 'path'
import ts from 'typescript'

type ApiField = {
  name: string
  type?: string
  optional?: boolean
  enum?: string[]
}

type ApiSchemaField = {
  name: string
  type: string
  optional?: boolean
  fields?: ApiSchemaField[]
  enum?: string[]
}

type ApiSchema = {
  type: string
  fields?: ApiSchemaField[]
  enum?: string[]
}

type ApiCatalogEntry = {
  key: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  description: string
  permissions: string[]
  mode: 'read' | 'write' | 'export'
  pathParams: ApiField[]
  queryParams: ApiField[]
  bodyFields: ApiField[]
  responseSchema?: ApiSchema
  source: string
}

const projectRoot = path.resolve(__dirname, '..')
const apiRoot = path.join(projectRoot, 'app', 'api')

const methodSet = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const exportPathHints = ['export', 'pdf', 'zip', 'download', 'excel', 'xlsx', 'csv']

const listRouteFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...listRouteFiles(resolved))
      continue
    }
    if (entry.isFile() && entry.name === 'route.ts') {
      results.push(resolved)
    }
  }
  return results
}

const toApiPath = (filePath: string) => {
  const rel = path.relative(apiRoot, filePath)
  const segments = rel.split(path.sep)
  segments.pop()
  const mapped = segments.map((segment) => {
    if (segment.startsWith('[[...') && segment.endsWith(']]')) {
      const name = segment.slice(5, -2)
      return `:${name}*`
    }
    if (segment.startsWith('[...') && segment.endsWith(']')) {
      const name = segment.slice(4, -1)
      return `:${name}*`
    }
    if (segment.startsWith('[') && segment.endsWith(']')) {
      const name = segment.slice(1, -1)
      return `:${name}`
    }
    return segment
  })
  return `/api/${mapped.join('/')}`
}

const detectMode = (method: string, pathText: string) => {
  if (method !== 'GET') return 'write'
  const lower = pathText.toLowerCase()
  if (exportPathHints.some((hint) => lower.includes(hint))) return 'export'
  return 'read'
}

const normalizeType = (value?: string) => value?.trim()

const isGenericStringType = (value?: string) => {
  const normalized = normalizeType(value)
  return normalized === 'string' || normalized === 'string[]' || !normalized
}

const mergeFieldType = (left?: string, right?: string) => {
  if (!left) return right
  if (!right) return left
  if (left === right) return left
  if (isGenericStringType(left) && !isGenericStringType(right)) return right
  if (isGenericStringType(right) && !isGenericStringType(left)) return left
  return left
}

const mergeFieldList = (base: ApiField[], extra: ApiField[]) => {
  const map = new Map<string, ApiField>()
  const insert = (field: ApiField) => {
    const existing = map.get(field.name)
    if (!existing) {
      map.set(field.name, { ...field })
      return
    }
    map.set(field.name, {
      name: field.name,
      type: mergeFieldType(existing.type, field.type),
      optional: existing.optional && field.optional ? true : existing.optional ?? field.optional,
      enum: existing.enum ?? field.enum,
    })
  }
  base.forEach(insert)
  extra.forEach(insert)
  return Array.from(map.values())
}

const uniqueByName = (fields: ApiField[]) => mergeFieldList(fields, [])

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const inferParamTypeByName = (name: string, isArray: boolean): string => {
  if (/id$/i.test(name)) return isArray ? 'number[]' : 'number'
  if (/ids$/i.test(name)) return 'number[]'
  if (/^(page|pageSize|limit|offset|size|count|sequence|min|max|year|month)$/i.test(name)) {
    return isArray ? 'number[]' : 'number'
  }
  if (/date/i.test(name)) return isArray ? 'date[]' : 'date'
  return isArray ? 'string[]' : 'string'
}

const parsePrismaEnums = (schemaText: string) => {
  const enums: Record<string, string[]> = {}
  const enumRegex = /enum\s+(\w+)\s*\{([\s\S]*?)\}/g
  let match: RegExpExecArray | null
  while ((match = enumRegex.exec(schemaText))) {
    const [, enumName, body] = match
    const values: string[] = []
    body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//') && !line.startsWith('@@') && !line.startsWith('@'))
      .forEach((line) => {
        const value = line.split(/\s+/)[0]
        if (value) values.push(value)
      })
    if (values.length) {
      enums[enumName] = values
    }
  }
  return enums
}

const loadPrismaEnums = () => {
  const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma')
  if (!fs.existsSync(schemaPath)) return {}
  return parsePrismaEnums(fs.readFileSync(schemaPath, 'utf8'))
}

const findEnumByType = (typeText: string | undefined, enumMap: Record<string, string[]>) => {
  if (!typeText) return undefined
  for (const [name, values] of Object.entries(enumMap)) {
    const regex = new RegExp(`\\b${name}\\b`)
    if (regex.test(typeText)) {
      return values
    }
  }
  return undefined
}

const inferParamTypeFromText = (
  text: string,
  name: string,
  kind: 'get' | 'getAll' | 'has',
): string => {
  if (kind === 'has') return 'boolean'
  const escaped = escapeRegex(name)
  const isArray = kind === 'getAll'
  const assertions = [
    new RegExp(
      `searchParams\\s*\\.getAll\\(\\s*['"]${escaped}['"]\\s*\\)[\\s\\S]{0,80}?\\bas\\s+([A-Za-z0-9_]+)\\[]`,
      'm',
    ),
    new RegExp(
      `searchParams\\s*\\.get\\(\\s*['"]${escaped}['"]\\s*\\)[\\s\\S]{0,80}?\\bas\\s+([A-Za-z0-9_]+)`,
      'm',
    ),
  ]
  for (const regex of assertions) {
    const match = text.match(regex)
    if (match?.[1]) {
      return isArray ? `${match[1]}[]` : match[1]
    }
  }

  const numberPatterns = [
    new RegExp(
      `toNumber\\(\\s*[^\\n]*searchParams\\s*\\.get\\(\\s*['"]${escaped}['"]\\s*\\)`,
      'm',
    ),
    new RegExp(
      `Number\\(\\s*[^\\n]*searchParams\\s*\\.get\\(\\s*['"]${escaped}['"]\\s*\\)`,
      'm',
    ),
    new RegExp(
      `parseInt\\(\\s*[^\\n]*searchParams\\s*\\.get\\(\\s*['"]${escaped}['"]\\s*\\)`,
      'm',
    ),
    new RegExp(
      `parseFloat\\(\\s*[^\\n]*searchParams\\s*\\.get\\(\\s*['"]${escaped}['"]\\s*\\)`,
      'm',
    ),
  ]
  if (numberPatterns.some((regex) => regex.test(text))) {
    return isArray ? 'number[]' : 'number'
  }

  const numberArrayPatterns = [
    new RegExp(
      `toNumberArray\\(\\s*[^\\n]*searchParams\\s*\\.getAll\\(\\s*['"]${escaped}['"]\\s*\\)`,
      'm',
    ),
    new RegExp(
      `parseIdList\\(\\s*[^\\n]*searchParams\\s*\\.getAll\\(\\s*['"]${escaped}['"]\\s*\\)`,
      'm',
    ),
    new RegExp(
      `searchParams\\s*\\.getAll\\(\\s*['"]${escaped}['"]\\s*\\)[\\s\\S]{0,80}?\\.map\\([^\\)]*Number`,
      'm',
    ),
    new RegExp(
      `searchParams\\s*\\.getAll\\(\\s*['"]${escaped}['"]\\s*\\)[\\s\\S]{0,80}?\\.map\\([^\\)]*parseInt`,
      'm',
    ),
    new RegExp(
      `searchParams\\s*\\.getAll\\(\\s*['"]${escaped}['"]\\s*\\)[\\s\\S]{0,80}?\\.map\\([^\\)]*parseFloat`,
      'm',
    ),
  ]
  if (numberArrayPatterns.some((regex) => regex.test(text))) {
    return 'number[]'
  }

  const booleanPatterns = [
    new RegExp(
      `searchParams\\s*\\.get\\(\\s*['"]${escaped}['"]\\s*\\)\\s*===\\s*['"](true|false|1|0)['"]`,
      'm',
    ),
    new RegExp(
      `\\bBoolean\\(\\s*[^\\n]*searchParams\\s*\\.get\\(\\s*['"]${escaped}['"]\\s*\\)`,
      'm',
    ),
    new RegExp(
      `includes\\(\\s*searchParams\\s*\\.get\\(\\s*['"]${escaped}['"]\\s*\\)`,
      'm',
    ),
  ]
  if (booleanPatterns.some((regex) => regex.test(text))) {
    return 'boolean'
  }

  const enumPatterns = [
    new RegExp(
      `toPaymentStatuses\\(\\s*[^\\n]*searchParams\\s*\\.getAll\\(\\s*['"]${escaped}['"]\\s*\\)`,
      'm',
    ),
  ]
  if (enumPatterns.some((regex) => regex.test(text))) {
    return 'PaymentStatus[]'
  }

  return inferParamTypeByName(name, isArray)
}

const extractSearchParamsFromText = (text: string): ApiField[] => {
  const results: ApiField[] = []
  const getRegex = /(?:\w+\.)*searchParams\s*\.get\(\s*['"]([^'"]+)['"]\s*\)/g
  const getAllRegex = /(?:\w+\.)*searchParams\s*\.getAll\(\s*['"]([^'"]+)['"]\s*\)/g
  const hasRegex = /(?:\w+\.)*searchParams\s*\.has\(\s*['"]([^'"]+)['"]\s*\)/g
  let match: RegExpExecArray | null
  while ((match = getRegex.exec(text))) {
    results.push({
      name: match[1],
      type: inferParamTypeFromText(text, match[1], 'get'),
      optional: true,
    })
  }
  while ((match = getAllRegex.exec(text))) {
    results.push({
      name: match[1],
      type: inferParamTypeFromText(text, match[1], 'getAll'),
      optional: true,
    })
  }
  while ((match = hasRegex.exec(text))) {
    results.push({
      name: match[1],
      type: inferParamTypeFromText(text, match[1], 'has'),
      optional: true,
    })
  }
  return results
}

const applyEnumValues = (fields: ApiField[], enumMap: Record<string, string[]>) =>
  fields.map((field) => {
    const enumValues = findEnumByType(field.type, enumMap)
    if (!enumValues) return field
    return { ...field, enum: enumValues }
  })

const collectBodyFieldsFromText = (text: string): ApiField[] => {
  const fields: ApiField[] = []
  const destructuringRegex = /const\s+\{([^}]+)\}\s*=\s*await\s+request\.json\(\)/g
  let match: RegExpExecArray | null
  while ((match = destructuringRegex.exec(text))) {
    const names = match[1]
      .split(',')
      .map((item) => item.trim().split(':')[0])
      .filter(Boolean)
    names.forEach((name) => fields.push({ name, type: 'unknown', optional: true }))
  }
  const assignedRegex = /const\s+(\w+)\s*=\s*await\s+request\.json\(\)/g
  while ((match = assignedRegex.exec(text))) {
    const varName = match[1]
    const propRegex = new RegExp(`\\b${varName}\\.([a-zA-Z0-9_]+)`, 'g')
    let propMatch: RegExpExecArray | null
    while ((propMatch = propRegex.exec(text))) {
      fields.push({ name: propMatch[1], type: 'unknown', optional: true })
    }
  }
  const formDataRegex = /const\s+(\w+)\s*=\s*await\s+request\.formData\(\)/g
  while ((match = formDataRegex.exec(text))) {
    const varName = match[1]
    const getRegex = new RegExp(`${varName}\\s*\\.get\\(\\s*['"]([^'"]+)['"]\\s*\\)`, 'g')
    const getAllRegex = new RegExp(`${varName}\\s*\\.getAll\\(\\s*['"]([^'"]+)['"]\\s*\\)`, 'g')
    let propMatch: RegExpExecArray | null
    while ((propMatch = getRegex.exec(text))) {
      fields.push({ name: propMatch[1], type: 'string | File', optional: true })
    }
    while ((propMatch = getAllRegex.exec(text))) {
      fields.push({ name: propMatch[1], type: 'Array<string | File>', optional: true })
    }
  }
  return fields
}

const inferPathParamType = (name: string) => {
  if (/id$/i.test(name)) return 'number'
  if (/ids$/i.test(name)) return 'number[]'
  return 'string'
}

const collectPathParams = (pathText: string): ApiField[] => {
  const matches = pathText.match(/:([a-zA-Z0-9_]+)\*?/g) ?? []
  return matches.map((match) => ({
    name: match.replace(':', '').replace('*', ''),
    type: match.endsWith('*') ? 'string[]' : inferPathParamType(match.replace(':', '').replace('*', '')),
    optional: false,
  }))
}

const buildSchema = (
  type: ts.Type,
  checker: ts.TypeChecker,
  depth: number,
  visited: Set<number>,
  enumMap: Record<string, string[]>,
): ApiSchema => {
  const typeId = (type as { id?: number }).id
  const typeText = checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)
  const enumValues = findEnumByType(typeText, enumMap)
  const symbolName = type.getSymbol()?.getName()
  const isPrimitive =
    (type.flags &
      (ts.TypeFlags.StringLike |
        ts.TypeFlags.NumberLike |
        ts.TypeFlags.BooleanLike |
        ts.TypeFlags.BigIntLike |
        ts.TypeFlags.ESSymbolLike |
        ts.TypeFlags.EnumLike |
        ts.TypeFlags.Null |
        ts.TypeFlags.Undefined |
        ts.TypeFlags.Void |
        ts.TypeFlags.Never |
        ts.TypeFlags.Any |
        ts.TypeFlags.Unknown)) !==
    0
  const isCallable = type.getCallSignatures().length > 0
  const isArray = checker.isArrayType(type) || checker.isTupleType(type)
  const isKnownScalar = symbolName === 'Date' || symbolName === 'Decimal'
  if (depth <= 0) return { type: typeText, enum: enumValues }
  if (isPrimitive || isCallable || isArray || isKnownScalar) {
    return { type: typeText, enum: enumValues }
  }
  if (typeId !== undefined) {
    if (visited.has(typeId)) return { type: typeText, enum: enumValues }
    visited.add(typeId)
  }
  const props = type.getProperties()
  if (!props.length) return { type: typeText, enum: enumValues }
  const fields: ApiSchemaField[] = props.map((prop) => {
    const decl = prop.valueDeclaration ?? prop.declarations?.[0]
    const propType = decl ? checker.getTypeOfSymbolAtLocation(prop, decl) : checker.getDeclaredTypeOfSymbol(prop)
    const optional = (prop.getFlags() & ts.SymbolFlags.Optional) !== 0
    const nested = buildSchema(propType, checker, depth - 1, visited, enumMap)
    const field: ApiSchemaField = {
      name: prop.getName(),
      type: nested.type,
      optional: optional || undefined,
    }
    if (nested.enum) {
      field.enum = nested.enum
    }
    if (nested.fields?.length) {
      field.fields = nested.fields
    }
    return field
  })
  return { type: typeText, fields, enum: enumValues }
}

const findResponseSchema = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  enumMap: Record<string, string[]>,
): ApiSchema | undefined => {
  const candidates: { node: ts.CallExpression; score: number }[] = []
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression
      if (
        ts.isPropertyAccessExpression(expression) &&
        expression.name.getText(sourceFile) === 'json' &&
        expression.expression.getText(sourceFile) === 'NextResponse'
      ) {
        let score = 0
        if (node.arguments.length > 0 && ts.isObjectLiteralExpression(node.arguments[0])) {
          score += node.arguments[0].properties.length
        }
        if (node.arguments.length > 1) {
          const second = node.arguments[1]
          if (ts.isObjectLiteralExpression(second)) {
            const statusProp = second.properties.find(
              (prop) => ts.isPropertyAssignment(prop) && prop.name.getText(sourceFile) === 'status',
            )
            if (statusProp) {
              const statusValue = statusProp.getText(sourceFile)
              if (/4\d\d|5\d\d/.test(statusValue)) {
                score -= 5
              }
            }
          }
        }
        candidates.push({ node, score })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (!candidates.length) return undefined
  const best = candidates.sort((a, b) => b.score - a.score)[0]
  const arg = best.node.arguments[0]
  if (!arg) return undefined
  const type = checker.getTypeAtLocation(arg)
  return buildSchema(type, checker, 2, new Set(), enumMap)
}

const detectBinaryResponse = (text: string) => {
  const lower = text.toLowerCase()
  if (lower.includes('application/pdf')) return 'application/pdf'
  if (lower.includes('application/zip')) return 'application/zip'
  if (lower.includes('application/vnd.openxmlformats')) return 'application/vnd.openxmlformats'
  if (lower.includes('application/vnd.ms-excel')) return 'application/vnd.ms-excel'
  if (lower.includes('text/csv')) return 'text/csv'
  if (lower.includes('application/octet-stream')) return 'application/octet-stream'
  return undefined
}

const extractPermissions = (text: string) => {
  const permissions = new Set<string>()
  const regex = /hasPermission\(\s*['"]([^'"]+)['"]\s*\)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text))) {
    permissions.add(match[1])
  }
  const anyRegex = /hasAnyPermission\(([^)]+)\)/g
  while ((match = anyRegex.exec(text))) {
    const args = match[1]
    const strRegex = /['\"]([^'\"]+)['\"]/g
    let argMatch: RegExpExecArray | null
    while ((argMatch = strRegex.exec(args))) {
      permissions.add(argMatch[1])
    }
  }
  return Array.from(permissions)
}

const extractImportedFunctionNames = (sourceFile: ts.SourceFile) => {
  const names: Array<{ name: string; module: string }> = []
  sourceFile.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !node.importClause?.namedBindings) return
    if (!ts.isNamedImports(node.importClause.namedBindings)) return
    const moduleName = (node.moduleSpecifier as ts.StringLiteral).text
    node.importClause.namedBindings.elements.forEach((element) => {
      names.push({ name: element.name.getText(sourceFile), module: moduleName })
    })
  })
  return names
}

const resolveModuleFile = (moduleName: string, containingFile: string, options: ts.CompilerOptions) => {
  const { resolvedModule } = ts.resolveModuleName(moduleName, containingFile, options, ts.sys)
  return resolvedModule?.resolvedFileName
}

const findFunctionBodyText = (
  sourceFile: ts.SourceFile,
  functionName: string,
): string | null => {
  let found: string | null = null
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName && node.body) {
      found = node.body.getText(sourceFile)
      return
    }
    if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((decl) => {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.text === functionName &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          const body = decl.initializer.body
          found = body.getText(sourceFile)
        }
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

const collectSearchParamsFromImportedParsers = (
  sourceFile: ts.SourceFile,
  containingFile: string,
  options: ts.CompilerOptions,
) => {
  const text = sourceFile.getFullText()
  const parserMatches = text.match(/parse[A-Za-z0-9_]*\s*\(\s*searchParams\b/g) || []
  if (!parserMatches.length) return []
  const parserNames = Array.from(new Set(parserMatches.map((match) => match.split('(')[0].trim())))
  const imports = extractImportedFunctionNames(sourceFile)
  const results: ApiField[] = []
  parserNames.forEach((parserName) => {
    const imported = imports.find((item) => item.name === parserName)
    if (!imported) return
    const resolved = resolveModuleFile(imported.module, containingFile, options)
    if (!resolved || !fs.existsSync(resolved)) return
    const fileText = fs.readFileSync(resolved, 'utf8')
    const fileSource = ts.createSourceFile(resolved, fileText, ts.ScriptTarget.Latest, true)
    const bodyText = findFunctionBodyText(fileSource, parserName)
    if (bodyText) {
      results.push(...extractSearchParamsFromText(bodyText))
    }
  })
  return results
}

const generateCatalog = () => {
  const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json')
  if (!configPath) {
    throw new Error('tsconfig.json not found')
  }
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectRoot)
  const routeFiles = listRouteFiles(apiRoot)
  const enumMap = loadPrismaEnums()
  const program = ts.createProgram({
    rootNames: routeFiles,
    options: parsedConfig.options,
  })
  const checker = program.getTypeChecker()
  const entries: ApiCatalogEntry[] = []

  routeFiles.forEach((filePath) => {
    const sourceFile = program.getSourceFile(filePath)
    if (!sourceFile) return
    const pathText = toApiPath(filePath)
    const text = sourceFile.getFullText()
    const permissions = extractPermissions(text)
    const queryParams = applyEnumValues(
      mergeFieldList(
        extractSearchParamsFromText(text),
        collectSearchParamsFromImportedParsers(sourceFile, filePath, parsedConfig.options),
      ),
      enumMap,
    )
    const bodyFields = applyEnumValues(uniqueByName(collectBodyFieldsFromText(text)), enumMap)
    const responseSchema = findResponseSchema(sourceFile, checker, enumMap)
    const binaryType = detectBinaryResponse(text)
    const resolvedResponseSchema = binaryType
      ? { type: `Binary (${binaryType})` }
      : responseSchema ?? { type: 'Response' }
    const pathParams = applyEnumValues(collectPathParams(pathText), enumMap)

    sourceFile.forEachChild((node) => {
      if (!ts.isFunctionDeclaration(node) || !node.name) return
      const method = node.name.text.toUpperCase()
      if (!methodSet.has(method)) return
      const entry: ApiCatalogEntry = {
        key: `${method.toLowerCase()}:${pathText}`,
        method: method as ApiCatalogEntry['method'],
        path: pathText,
        description: `${method} ${pathText}`,
        permissions,
        mode: detectMode(method, pathText),
        pathParams,
        queryParams,
        bodyFields,
        responseSchema: resolvedResponseSchema,
        source: path.relative(projectRoot, filePath),
      }
      entries.push(entry)
    })
  })

  entries.sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method)
    return a.path.localeCompare(b.path)
  })

  const outputPath = path.join(projectRoot, 'lib', 'ai-chat', 'adapters', 'dailywork', 'apiCatalog.ts')
  const content = `// This file is generated by scripts/generate-api-docs.ts. Do not edit manually.\n\nexport type ApiField = {\n  name: string\n  type?: string\n  optional?: boolean\n  enum?: string[]\n}\n\nexport type ApiSchemaField = {\n  name: string\n  type: string\n  optional?: boolean\n  fields?: ApiSchemaField[]\n  enum?: string[]\n}\n\nexport type ApiSchema = {\n  type: string\n  fields?: ApiSchemaField[]\n  enum?: string[]\n}\n\nexport type ApiCatalogEntry = {\n  key: string\n  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'\n  path: string\n  description: string\n  permissions: string[]\n  mode: 'read' | 'write' | 'export'\n  pathParams: ApiField[]\n  queryParams: ApiField[]\n  bodyFields: ApiField[]\n  responseSchema?: ApiSchema\n  source: string\n}\n\nexport const dailyworkApiCatalog: ApiCatalogEntry[] = ${JSON.stringify(entries, null, 2)}\n`
  fs.writeFileSync(outputPath, content, 'utf8')
}

generateCatalog()
